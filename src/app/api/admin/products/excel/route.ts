import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseExcelBuffer } from '@/lib/excel'
import { v4 as uuidv4 } from 'uuid'
import { generateSlug } from '@/lib/slug'

export const maxDuration = 60

// POST /api/admin/products/excel
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .xlsx, .xls, .csv allowed' },
        { status: 400 }
      )
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

    // ── Step 1: Separate products into updates vs creates ──────────────────
    const toUpdate: typeof products = []
    const toCreate: typeof products = []

    // Only check for existing codes if any products have a code
    const codesInFile = products.map(p => p.product_code).filter(Boolean) as string[]

    // Fetch all existing products with those codes in ONE query
    const existingProducts = codesInFile.length > 0
      ? await prisma.product.findMany({
          where: { product_code: { in: codesInFile } },
          select: { product_code: true },
        })
      : []

    const existingCodes = new Set(existingProducts.map(p => p.product_code))

    for (const item of products) {
      if (item.product_code && existingCodes.has(item.product_code)) {
        toUpdate.push(item)
      } else {
        toCreate.push(item)
      }
    }

    // ── Step 2: Bulk CREATE with createMany (single DB round trip) ─────────
    let created = 0
    const createFailures: any[] = []

    if (toCreate.length > 0) {
      try {
        const createData = toCreate.map(item => {
          const code = item.product_code || `PROD-${uuidv4()}`
          return {
            name:         item.name,
            category:     item.category,
            subcategory:  item.subcategory  || null,
            brand:        item.brand        || null,
            base_price:   item.base_price,
            stock:        item.stock        || 0,
            color:        item.color        || null,
            size:         item.size         || null,
            barcode:      item.barcode      || null,
            images:       item.images       || [],
            product_code: code,
            slug:         generateSlug(item.name, code),
          }
        })

        const result = await prisma.product.createMany({
          data: createData,
          skipDuplicates: true,
        })

        created = result.count
      } catch (err: any) {
        console.error('createMany failed:', err)
        createFailures.push({ error: err.message || 'Bulk create failed' })
      }
    }

    // ── Step 3: UPDATE existing products (loop — these are rare) ──────────
    let updated = 0
    const updateFailures: any[] = []

    for (const item of toUpdate) {
      try {
        await prisma.product.update({
          where: { product_code: item.product_code! },
          data: {
            name:        item.name,
            category:    item.category,
            subcategory: item.subcategory || null,
            brand:       item.brand       || null,
            base_price:  item.base_price,
            stock:       item.stock       || 0,
            color:       item.color       || null,
            size:        item.size        || null,
            barcode:     item.barcode     || null,
          },
        })
        updated++
      } catch (err: any) {
        console.error('update failed:', err)
        updateFailures.push({ error: err.message || 'Update failed', item })
      }
    }

    const allFailures = [...createFailures, ...updateFailures]

    return NextResponse.json({
      success: true,
      summary: {
        total_rows:   products.length,
        created,
        updated,
        failed:       allFailures.length,
        parse_errors: parseErrors.length,
      },
      parse_errors: parseErrors,
      failed_rows:  allFailures,
    })

  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Excel upload failed' },
      { status: 500 }
    )
  }
}