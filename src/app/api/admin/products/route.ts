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
    const sales_channel = searchParams.get('sales_channel') // 🔥 NEW: Grab the sales channel
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    const where: any = {
      is_deleted: false,
      ...(sales_channel && { sales_channel }),
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

    // 🔥 FIX: Flatten data to create ONE ROW PER VARIANT for the Admin Table
    const products: any[] = []
    
    rawProducts.forEach(p => {
      if (!p.variants || p.variants.length === 0) {
        // Fallback for products with no variants
        products.push({
          ...p,
          stock: 0,
          base_price: 0,
          color: '',
          size: '',
          barcode: '',
          variant_id: null,
          sku: p.product_code
        })
      } else {
        // Create a distinct row for every size/color combination
        p.variants.forEach(v => {
          products.push({
            ...p, 
            id: p.id,
            variant_id: v.id,
            stock: v.stock,
            base_price: Number(v.base_price),
            color: v.color || '',
            size: v.size || '',
            barcode: v.barcode || '',
            sku: v.sku || '',
            // Use the specific variant image, or fallback to the parent's first image
            image: v.image || (p.images && p.images.length > 0 ? p.images[0] : null),
            is_active: v.is_active,
          })
        })
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
      department,
      category,
      subcategory,
      brand,
      base_price,
      color,
      size,
      stock,
      barcode,
      images,
      sales_channel // 🔥 NEW: Extract sales_channel from the request
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

    // 1. Check if a product with this exact code already exists
    const existingProduct = await prisma.product.findUnique({
      where: { product_code: final_product_code }
    })

  if (existingProduct) {
      // Create the variant AND push the new image to the parent's gallery
      const updatedProduct = await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          // 🔥 Add this line to update the parent's image gallery
          images: images && images.length > 0 ? { push: images[0] } : undefined,
          variants: {
            create: {
              base_price: parseFloat(base_price),
              stock:      parseInt(stock) || 0,
              color:      color   || null,
              size:       size    || null,
              image:      images?.[0] || null,
              barcode:    barcode || null,
              sku:        fallbackSku
            }
          }
        },
        include: { variants: true }
      })

      return NextResponse.json({ success: true, product: updatedProduct }, { status: 201 })
    }

    // 3. PRODUCT DOES NOT EXIST: Create brand new Parent AND Child simultaneously
    const product = await prisma.product.create({
      data: {
        product_code:  final_product_code,
        name,
        department:    department.toUpperCase() as Department,
        category,
        subcategory:   subcategory || null,
        brand:         brand       || null,
        images:        images      || [],
        slug:          generateSlug(name, final_product_code),
        // 🔥 NEW: Save the sales channel (Defaults to MAIN_STORE if none provided)
        sales_channel: sales_channel === 'INSTA_LIVE' ? 'INSTA_LIVE' : 'MAIN_STORE',
        variants: {
          create: {
            base_price: parseFloat(base_price),
            stock:      parseInt(stock) || 0,
            color:      color   || null,
            size:       size    || null,
            image:      images?.[0] || null,
            barcode:    barcode || null,
            sku:        fallbackSku
          }
        }
      },
      include: { variants: true }
    })

    return NextResponse.json({ success: true, product }, { status: 201 })

  } catch (error: any) {
    console.error(error)
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        error: 'A variant with this Size/Color already exists for this product code.' 
      }, { status: 409 })
    }
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}