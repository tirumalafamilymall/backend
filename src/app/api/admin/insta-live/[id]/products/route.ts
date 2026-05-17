import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminFromRequest } from '@/lib/auth' // 🔥 Added import

export async function POST(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  // 🔥 Security Check
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = await _context.params
  try {
    const { product_id } = await req.json()

    if (!product_id) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

    const product = await prisma.product.findFirst({ 
      where: { 
        OR: [
          { id: product_id },
          { slug: product_id }
        ]
      },
      include: { variants: true } 
    })
    
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const rawLink = await prisma.instaLiveProduct.create({
      data: { insta_live_id: params.id, product_id: product.id },
      include: { 
        product: { include: { variants: true } }
      },
    })

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