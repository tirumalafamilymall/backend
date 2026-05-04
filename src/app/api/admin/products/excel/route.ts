import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseExcelBuffer } from '@/lib/excel'
import { v4 as uuidv4 } from 'uuid'
import { generateSlug } from '@/lib/slug'

// POST /api/admin/products/excel
// Accepts multipart form with Excel file
// Parses, validates, and bulk inserts products
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

    // Batch insert — same logic as bulk upload
    const results = []
    const batchSize = 10

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize)

      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            // If product_code exists in Excel, check for duplicate
            if (item.product_code) {
              const existing = await prisma.product.findUnique({
                where: { product_code: item.product_code },
              })

              if (existing) {
                // Update existing product instead of creating
                const updated = await prisma.product.update({
                  where: { product_code: item.product_code },
                  data: {
                    name:        item.name,
                    category:    item.category,
                    subcategory: item.subcategory,
                    brand:       item.brand,
                    base_price:  item.base_price,
                    stock:       item.stock,
                    color:       item.color,
                    size:        item.size,
                    barcode:     item.barcode,
                  },
                })
                return { success: true, action: 'updated', product: updated }
              }
            }

// Create new product
const code = item.product_code || `PROD-${uuidv4()}`
const product = await prisma.product.create({
data: {
  name: item.name,
  category: item.category,
  subcategory: item.subcategory || null,
  brand: item.brand || null,
  base_price: item.base_price,
  stock: item.stock || 0,
  color: item.color || null,
  size: item.size || null,
  barcode: item.barcode || null,
  images: item.images || [],
  product_code: code,
  slug: generateSlug(item.name, code),
},
})

            return { success: true, action: 'created', product }
          } catch (err: any) {
            console.error(err)
            return {
              success: false,
              error: err.message || 'Insert failed',
              item,
            }
          }
        })
      )

      results.push(...batchResults)
    }

    const created  = results.filter((r) => r.success && r.action === 'created').length
    const updated  = results.filter((r) => r.success && r.action === 'updated').length
    const failed   = results.filter((r) => !r.success)

    return NextResponse.json({
      success: true,
      summary: {
        total_rows:    products.length,
        created,
        updated,
        failed:        failed.length,
        parse_errors:  parseErrors.length,
      },
      parse_errors: parseErrors,
      failed_rows:  failed,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Excel upload failed' },
      { status: 500 }
    )
  }
}