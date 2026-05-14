import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Department } from '@prisma/client'

// GET /api/admin/products/:id
export async function GET(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const params = await _context.params
  try {
    const product = await prisma.product.findFirst({
      where: {
        is_deleted: false,
        OR: [ { id: params.id }, { slug: params.id } ],
      },
      include: { variants: true }
    })

    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    return NextResponse.json({ success: true, product })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

// PATCH /api/admin/products/:id
export async function PATCH(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const params = await _context.params
  try {
    const body = await req.json()
    const { 
      variant_id, 
      name, department, category, subcategory, brand, images, is_active,
      base_price, color, size, stock, barcode, image,
      sales_channel // 🔥 NEW
    } = body

    // 1. Update the Parent (Common details for all variants)
    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(name        !== undefined && { name }),
        ...(department  !== undefined && { department: department.toUpperCase() as Department }),
        ...(category    !== undefined && { category }),
        ...(subcategory !== undefined && { subcategory }),
        ...(brand       !== undefined && { brand }),
        ...(images      !== undefined && { images }),
        ...(is_active   !== undefined && { is_active }),
        ...(sales_channel !== undefined && { sales_channel }), // 🔥 NEW
      },
    })

    // 2. Update ONLY the specific variant selected in the Admin table
    if (variant_id) {
      await prisma.productVariant.update({
        where: { id: variant_id },
        data: {
          ...(base_price !== undefined && { base_price: parseFloat(base_price) }),
          ...(color      !== undefined && { color }),
          ...(size       !== undefined && { size }),
          ...(stock      !== undefined && { stock: parseInt(stock) }),
          ...(barcode    !== undefined && { barcode }),
          ...(image      !== undefined && { image }), 
        }
      })
    }

    return NextResponse.json({ success: true, product: updatedProduct })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Another variant already exists with this Size and Color.' }, { status: 409 })
    }
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
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const updated = await prisma.product.update({
      where: { id: params.id },
      data:  { is_deleted: true, is_active: false }, 
    })

    return NextResponse.json({ success: true, product: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}