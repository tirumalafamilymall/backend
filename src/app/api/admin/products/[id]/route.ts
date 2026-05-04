import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const params = await _context.params
  try {
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { id:   params.id },
          { slug: params.id }, // works for both UUID and slug
        ],
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, product })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

// PATCH /api/admin/products/:id — update any fields
// Body: any subset of product fields
export async function PATCH(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const params = await _context.params
  try {
    const body = await req.json()

    const product = await prisma.product.findUnique({ where: { id: params.id } })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Whitelist updatable fields — never allow id or product_code to change
    const {
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
      is_active,
    } = body

    if (stock !== undefined && stock < 0) {
  return NextResponse.json(
    { error: 'Stock cannot be negative' },
    { status: 400 }
  )
}

    const updated = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(name        !== undefined && { name }),
        ...(category    !== undefined && { category }),
        ...(subcategory !== undefined && { subcategory }),
        ...(brand       !== undefined && { brand }),
        ...(base_price  !== undefined && { base_price }),
        ...(color       !== undefined && { color }),
        ...(size        !== undefined && { size }),
        ...(stock       !== undefined && { stock }),
        ...(barcode     !== undefined && { barcode }),
        ...(images      !== undefined && { images }),
        ...(is_active   !== undefined && { is_active }),
      },
    })

    return NextResponse.json({ success: true, product: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

// DELETE /api/admin/products/:id
export async function DELETE(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const params = await _context.params
  try {
    const product = await prisma.product.findUnique({ where: { id: params.id } })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Soft delete — just deactivate
    // Prevents breaking order history that references this product
    const updated = await prisma.product.update({
      where: { id: params.id },
      data:  { is_active: false },
    })

    return NextResponse.json({ success: true, product: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}