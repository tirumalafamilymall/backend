import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/products/search?q=kurti
// Lightweight — returns minimal fields for search dropdown UI
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, products: [] })
    }

    const products = await prisma.product.findMany({
      where: {
        is_active: true,
        OR: [
          { name:     { contains: q, mode: 'insensitive' } },
          { brand:    { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { barcode:  { contains: q, mode: 'insensitive' } },
          { product_code: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10, // search dropdown max
      select: {
        id:         true,
        name:       true,
        category:   true,
        base_price: true,
        images:     true,
        stock:      true,
      },
    })

    return NextResponse.json({ success: true, products })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}