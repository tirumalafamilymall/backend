import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// This file ONLY handles DELETE requests to /api/admin/insta-live/[id]/products/[productId]
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