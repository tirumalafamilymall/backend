import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { generateSlug } from '@/lib/slug'
import { getAdminFromRequest } from '@/lib/auth'
import { Department } from '@prisma/client'

// GET /api/admin/products
export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
          { brand:        { contains: search, mode: 'insensitive' } },
        ],
      }),
    }

    const [rawProducts, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { variants: true } // Fetch the child variants!
      }),
      prisma.product.count({ where }),
    ])

    // Flatten the data for the current UI table
    const products = rawProducts.map(p => {
      const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0)
      const basePrice = p.variants.length > 0 ? Number(p.variants[0].base_price) : 0
      
      return {
        ...p,
        stock: totalStock,
        base_price: basePrice,
        // Grab the first variant's details for the simple edit form
        color: p.variants[0]?.color || '',
        size: p.variants[0]?.size || '',
        barcode: p.variants[0]?.barcode || ''
      }
    })

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

// POST /api/admin/products
export async function POST(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    const body = await req.json()

    const {
      product_code: custom_code,
      name,
      department, // NEW REQUIRED FIELD
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

    if (!name || !category || !base_price || !department) {
      return NextResponse.json(
        { error: 'Missing required fields: name, department, category, base_price' },
        { status: 400 }
      )
    }

    if (!['WOMEN', 'MEN', 'KIDS'].includes(department.toUpperCase())) {
      return NextResponse.json({ error: 'Invalid department. Must be WOMEN, MEN, or KIDS.' }, { status: 400 })
    }

    if (isNaN(Number(base_price)) || Number(base_price) <= 0) {
      return NextResponse.json({ error: 'Invalid base_price' }, { status: 400 })
    }

    const final_product_code = (custom_code && custom_code.trim() !== '') 
      ? custom_code.trim().toUpperCase() 
      : `PROD-${uuidv4().substring(0, 8).toUpperCase()}`

    const fallbackSku = `${final_product_code}-${size || 'BASE'}-${color || 'BASE'}`.replace(/\s+/g, '').toUpperCase()

    // Create Parent AND Child simultaneously
    const product = await prisma.product.create({
      data: {
        product_code: final_product_code,
        name,
        department:   department.toUpperCase() as Department,
        category,
        subcategory:  subcategory || null,
        brand:        brand       || null,
        images:       images      || [],
        slug:         generateSlug(name, final_product_code), 
        variants: {
          create: {
            base_price: parseFloat(base_price),
            stock:      parseInt(stock) || 0,
            color:      color   || null,
            size:       size    || null,
            barcode:    barcode || null,
            sku:        fallbackSku
          }
        }
      },
      include: { variants: true }
    })

    return NextResponse.json({ success: true, product })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}