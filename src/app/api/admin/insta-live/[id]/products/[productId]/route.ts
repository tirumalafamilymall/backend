import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminFromRequest } from '@/lib/auth' // 🔥 Added import

export async function DELETE(
  req: Request,
  _context: { params: Promise<{ id: string, productId: string }> }
) {
  // 🔥 Security Check
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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