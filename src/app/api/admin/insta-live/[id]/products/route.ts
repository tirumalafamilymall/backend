import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const params = await _context.params
  try {
    const { product_id } = await req.json()

    if (!product_id) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

    const product = await prisma.product.findUnique({ 
      where: { id: product_id },
      include: { variants: true } // 🔥 Fetch variants to check stats
    })
    
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const rawLink = await prisma.instaLiveProduct.create({
      data: { insta_live_id: params.id, product_id },
      include: { 
        product: { include: { variants: true } } // 🔥 Deep include
      },
    })

    // Aggregating for the UI response
    const prices = rawLink.product.variants.map(v => Number(v.base_price))
    const link = {
      ...rawLink,
      product: {
        ...rawLink.product,
        base_price: prices.length > 0 ? Math.min(...prices) : 0,
        stock: rawLink.product.variants.reduce((sum, v) => sum + v.stock, 0)
      }
    }

    return NextResponse.json({ success: true, link }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Product already linked' }, { status: 409 })
    return NextResponse.json({ error: 'Failed to link product' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  _context: { params: Promise<{ id: string, productId: string }> }
) {
  const params = await _context.params
  try {
    await prisma.instaLiveProduct.deleteMany({
      where: { insta_live_id: params.id, product_id: params.productId },
    })
    return NextResponse.json({ success: true, message: 'Product unlinked' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to unlink product' }, { status: 500 })
  }
}