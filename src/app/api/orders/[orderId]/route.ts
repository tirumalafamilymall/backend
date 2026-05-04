import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(
  req: Request,
  _context: { params: Promise<{ orderId: string }> }
) {
  const params = await _context.params
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const order = await prisma.order.findFirst({
      where: { id: params.orderId, user_id: user.id },
      include: { items: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, order })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}