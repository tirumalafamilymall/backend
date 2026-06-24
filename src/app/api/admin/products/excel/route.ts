import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseExcelBuffer } from '@/lib/excel'
import { generateSlug } from '@/lib/slug'
import { Department } from '@prisma/client'
import { getAdminFromRequest } from '@/lib/auth'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const admin = await getAdminFromRequest(req)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return NextResponse.json({ error: 'Invalid file type. Only .xlsx, .xls, .csv allowed' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { products, errors: parseErrors } = parseExcelBuffer(buffer)

    if (products.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No valid products found in file',
        parse_errors: parseErrors,
      }, { status: 400 })
    }

    // ── Step 1: Group flat rows into Parent -> Variants ──────────────────
    const groupedProducts = new Map<string, any>()

    for (const item of products) {
      const code = item.product_code
if (!groupedProducts.has(code)) {
        // First time seeing this code: Set up the Parent Blueprint
        groupedProducts.set(code, {
          parentData: {
            product_code:  code,
            name:          item.name,
            department:    item.department as Department,
            category:      item.category,
            subcategory:   item.subcategory,
            brand:         item.brand,
            slug:          generateSlug(item.name, code),
           sales_channel: (item.sales_channel && ['INSTA_LIVE', 'INSTA-LIVE', 'INSTALIVE', 'INSTA LIVE'].includes(String(item.sales_channel).trim().toUpperCase())) ? 'INSTA_LIVE' : 'MAIN_STORE',
          },
          variants: []
        })
      }

      // Generate a fallback SKU if not provided in Excel
      const fallbackSku = `${code}-${item.size || 'BASE'}-${item.color || 'BASE'}`.replace(/\s+/g, '').toUpperCase()

      // Add this specific row as a Child Variant
      groupedProducts.get(code).variants.push({
        size:       item.size,
        color:      item.color,
        base_price: item.base_price,
        stock:      (item.stock !== undefined && item.stock !== null && item.stock !== '') ? Number(item.stock) : 1,
        sku:        item.sku || fallbackSku,
        barcode:    item.barcode,
        image:      item.image || null,
      })
    }

// ── Step 2: Process Database Upserts ─────────────────────────────────
  let parentProcessed = 0
  let variantsCreated = 0
  let variantsUpdated = 0
  const failedRows: any[] = []

  for (const [code, group] of groupedProducts.entries()) {
    try {
      await prisma.$transaction(async (tx) => {
        const parent = await tx.product.upsert({
          where: { product_code: code },
          create: group.parentData,
          update: {
            name:          group.parentData.name,
            department:    group.parentData.department,
            category:      group.parentData.category,
            subcategory:   group.parentData.subcategory,
            brand:         group.parentData.brand,
            sales_channel: group.parentData.sales_channel,
            is_deleted:    false,
            is_active:     true,
          }
        })
        parentProcessed++

        for (const v of group.variants) {
          const existingVariant = await tx.productVariant.findFirst({
            where: { product_id: parent.id, size: v.size, color: v.color }
          })

          if (existingVariant) {
            await tx.productVariant.update({
              where: { id: existingVariant.id },
              data: {
                base_price: v.base_price,
                stock:      v.stock,
                sku:        v.sku,
                barcode:    v.barcode,
                image:      v.image || null,
              }
            })
            variantsUpdated++
          } else {
            await tx.productVariant.create({
              data: {
                product_id: parent.id,
                size:       v.size,
                color:      v.color,
                base_price: v.base_price,
                stock:      v.stock,
                sku:        v.sku,
                barcode:    v.barcode,
                image:      v.image || null,
              }
            })
            variantsCreated++
          }
        }
      })
    } catch (err: any) {
      console.error(`Failed processing group ${code}:`, err)
      failedRows.push({ product_code: code, error: err.message })
    }
  }

    return NextResponse.json({
      success: true,
      summary: {
        total_excel_rows: products.length,
        created: variantsCreated, // Sending accurate counts to frontend
        updated: variantsUpdated,
        failed: failedRows.length,
        parse_errors: parseErrors.length,
      },
      parse_errors: parseErrors,
      failed_rows: failedRows,
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Excel upload failed' }, { status: 500 })
  }
}