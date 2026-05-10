import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid' // <-- Make sure this is here!
import { generateSlug } from '@/lib/slug'
import { getAdminFromRequest } from '@/lib/auth'

// GET /api/admin/products
// Query params: category, brand, is_active, search, page, limit
export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)

    const category  = searchParams.get('category')
    const brand     = searchParams.get('brand')
    const is_active = searchParams.get('is_active')
    const search    = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    const where: any = {
      is_deleted: false,
      ...(category  && { category: { contains: category, mode: 'insensitive' } }),
      ...(brand     && { brand:    { contains: brand,    mode: 'insensitive' } }),
      
      ...(is_active === 'true' && { is_active: true }),
      ...(is_active === 'false' && { is_active: false }),
      
      ...(search && {
        OR: [
          { name:         { contains: search, mode: 'insensitive' } },
          { product_code: { contains: search, mode: 'insensitive' } },
          { barcode:      { contains: search, mode: 'insensitive' } },
          { brand:        { contains: search, mode: 'insensitive' } },
        ],
      }),
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      products,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}


export async function POST(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const body = await req.json()

    const {
      product_code: custom_code,
      name,
      category,
      subcategory,
      brand,
      base_price,
      color,
      size,
      stock,
      barcode,
      images,
    } = body

    if (!name || !category || !base_price) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, base_price' },
        { status: 400 }
      )
    }

    if (isNaN(Number(base_price)) || Number(base_price) <= 0) {
      return NextResponse.json(
        { error: 'Invalid base_price' },
        { status: 400 }
      )
    }

    // THIS IS THE MISSING LOGIC!
    // If the user typed a code, use it. Otherwise, auto-generate.
    const final_product_code = (custom_code && custom_code.trim() !== '') 
      ? custom_code.trim().toUpperCase() 
      : `PROD-${uuidv4().substring(0, 8).toUpperCase()}`

    const product = await prisma.product.create({
      data: {
        name,
        category,
        subcategory: subcategory || null,
        brand:       brand       || null,
        base_price: parseFloat(base_price),
        color:       color       || null,
        size:        size        || null,
        stock: parseInt(stock) || 0,
        barcode:     barcode     || null,
        images:      images      || [],
        product_code: final_product_code, // Now it knows what this variable is!
        slug: generateSlug(name, final_product_code), 
      },
    })

    return NextResponse.json({ success: true, product })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}