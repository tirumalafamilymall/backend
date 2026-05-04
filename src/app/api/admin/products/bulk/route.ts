import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { generateSlug } from '@/lib/slug'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Expected an array of products' },
        { status: 400 }
      )
    }

    const results = []
    const batchSize = 10

    for (let i = 0; i < body.length; i += batchSize) {
      const batch = body.slice(i, i + batchSize)

      const batchResults = await Promise.all(
        batch.map(async (item: any) => {
          try {
            if (!item.name || !item.category || !item.base_price) {
              return { success: false, error: 'Missing required fields: name, category, base_price' }
            }
if (isNaN(Number(item.base_price)) || Number(item.base_price) <= 0) {
  return { success: false, error: 'Invalid base_price' }
}
const code = item.product_code ? String(item.product_code) : `PROD-${uuidv4()}`

const product = await prisma.product.create({
  data: {
    name:         item.name,
    category:     item.category,
    subcategory:  item.subcategory || null,
    brand:        item.brand || null,
    base_price:   item.base_price,
    color:        item.color || null,
    size:         item.size || null,
    stock:        item.stock || 0,
    barcode:      item.barcode || null,
    images:       item.images || [],
    product_code: code,
    slug:         generateSlug(item.name, code),
  },
})

            return { success: true, product }
          } catch (err) {
            console.error(err)
            return { success: false, error: 'Insert failed' }
          }
        })
      )

      results.push(...batchResults)
    }

    return NextResponse.json({
      success: true,
      total: results.length,
      results,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Bulk upload failed' }, { status: 500 })
  }
}