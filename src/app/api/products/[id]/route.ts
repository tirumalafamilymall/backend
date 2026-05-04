import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/products/:id — single product full detail
export async function GET(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const params = await _context.params
  try {
    const product = await prisma.product.findFirst({
      where: {
        id: params.id,
        is_active: true,
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