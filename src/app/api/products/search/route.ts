import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length < 2) return NextResponse.json({ success: true, products: [] })

    const rawProducts = await prisma.product.findMany({
      where: {
        is_active: true,
        is_deleted: false,
        sales_channel: 'MAIN_STORE',
        OR: [
          { name:         { contains: q, mode: 'insensitive' } },
          { brand:        { contains: q, mode: 'insensitive' } },
          { category:     { contains: q, mode: 'insensitive' } },
          { product_code: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        id:         true,
        slug:       true,
        name:       true,
        category:   true,
        images:     true,
        variants:   true,
      },
    })

    const products = rawProducts.map(p => {
      const stock    = p.variants.reduce((sum, v) => sum + v.stock, 0)
      const prices   = p.variants.map(v => Number(v.base_price))
      const basePrice = prices.length > 0 ? Math.min(...prices) : 0

      // ✅ FIX: Excel-uploaded products store images on variants, not the parent.
      // Check variant images first, then fall back to parent images array.
      const image = p.variants.find(v => v.image)?.image || p.images?.[0] || null

      return {
        id:         p.slug || p.id,
        name:       p.name,
        category:   p.category,
        base_price: basePrice,
        images:     p.images,
        image,        // ✅ single resolved image for ProductCard to use directly
        stock,
      }
    })

    return NextResponse.json({ success: true, products })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}