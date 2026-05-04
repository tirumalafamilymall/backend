import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/products
// Query params:
//   category, subcategory, brand, color, size  → filters
//   min_price, max_price                        → price range
//   in_stock                                    → true/false
//   search                                      → name/brand keyword
//   sort                                        → price_asc, price_desc, newest
//   page, limit                                 → pagination
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const category    = searchParams.get('category')
    const subcategory = searchParams.get('subcategory')
    const brand       = searchParams.get('brand')
    const color       = searchParams.get('color')
    const size        = searchParams.get('size')
    const min_price   = searchParams.get('min_price')
    const max_price   = searchParams.get('max_price')
    const in_stock    = searchParams.get('in_stock')
    const search      = searchParams.get('search')
    const sort        = searchParams.get('sort') || 'newest'
    const page        = parseInt(searchParams.get('page') || '1')
    const limit       = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

    const where: any = {
      is_active: true,
      ...(category    && { category:    { equals: category,    mode: 'insensitive' } }),
      ...(subcategory && { subcategory: { equals: subcategory, mode: 'insensitive' } }),
      ...(brand       && { brand:       { equals: brand,       mode: 'insensitive' } }),
      ...(color       && { color:       { equals: color,       mode: 'insensitive' } }),
      ...(size        && { size:        { equals: size,        mode: 'insensitive' } }),
      ...(in_stock === 'true' && { stock: { gt: 0 } }),
      ...((min_price || max_price) && {
        base_price: {
          ...(min_price && { gte: parseFloat(min_price) }),
          ...(max_price && { lte: parseFloat(max_price) }),
        },
      }),
      ...(search && {
        OR: [
          { name:  { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ],
      }),
    }

    const orderBy =
      sort === 'price_asc'  ? { base_price: 'asc'  as const } :
      sort === 'price_desc' ? { base_price: 'desc' as const } :
                              { created_at: 'desc' as const }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id:           true,
          product_code: true,
          name:         true,
          category:     true,
          subcategory:  true,
          brand:        true,
          base_price:   true,
          color:        true,
          size:         true,
          stock:        true,
          images:       true,
          created_at:   true,
        },
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
      products,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}