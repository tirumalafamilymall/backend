import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Department, SalesChannel } from '@prisma/client'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const department  = searchParams.get('department')
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
    
    // CHANGED: Do not force a fallback to 'MAIN_STORE'. If null, we include both channels.
    const sales_channel = searchParams.get('sales_channel') 

    const variantFilter: any = {}
    if (color) variantFilter.color = { equals: color, mode: 'insensitive' }
    if (size) variantFilter.size = { equals: size, mode: 'insensitive' }
    if (in_stock === 'true') variantFilter.stock = { gt: 0 }
    if (min_price || max_price) {
      variantFilter.base_price = {
        ...(min_price && { gte: parseFloat(min_price) }),
        ...(max_price && { lte: parseFloat(max_price) }),
      }
    }

    const where: any = {
      is_active: true,
      is_deleted: false,
      // CHANGED: Only filter by channel if explicitly requested by the route parameters
      ...(sales_channel && { sales_channel: sales_channel as SalesChannel }), 
      ...(department  && { department: department.toUpperCase() as Department }),
      ...(category    && { category: { equals: category, mode: 'insensitive' } }),
      ...(subcategory && { subcategory: { equals: subcategory, mode: 'insensitive' } }),
      ...(brand       && { brand: { equals: brand, mode: 'insensitive' } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(Object.keys(variantFilter).length > 0 && {
        variants: { some: variantFilter }
      })
    }

    const [rawProducts, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { created_at: 'desc' }, 
        skip: (page - 1) * limit,

        include: { 
          variants: {
            where: { is_active: true }
          } 
        } 
      }),
      prisma.product.count({ where }),
    ])

let products = rawProducts
      .filter(p => p.variants.length > 0) 
      .map(p => {
      const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0)
      const prices = p.variants.map(v => Number(v.base_price))
      const basePrice = prices.length > 0 ? Math.min(...prices) : 0

      return {
        id:           p.id,
        slug:         p.slug,
        product_code: p.product_code,
        name:         p.name,
        category:     p.category,
        subcategory:  p.subcategory,
        brand:        p.brand,
        images:       p.images,
        base_price:   basePrice,
        stock:        totalStock,
        variants:     p.variants,
      }
    })

    if (sort === 'price_asc')  products.sort((a, b) => a.base_price - b.base_price)
    if (sort === 'price_desc') products.sort((a, b) => b.base_price - a.base_price)

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