import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendShippingMail } from '@/lib/mailer'

// GET /api/admin/orders/:orderId
export async function GET(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: {
        items: true,
        user:  { select: { name: true, email: true } },
      },
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

export async function PATCH(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const { status, tracking_url, shiprocket_order_id } = await req.json()

    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Fetch existing order with user before updating
    const existing = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: { user: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const order = await prisma.order.update({
      where: { id: params.orderId },
      data: {
        ...(status             && { status }),
        ...(tracking_url       && { tracking_url }),
        ...(shiprocket_order_id && { shiprocket_order_id }),
      },
      include: { items: true },
    })

    // Send shipping email when status changes to SHIPPED
    if (status === 'SHIPPED' && existing.user?.email) {
      sendShippingMail({
        customerEmail: existing.user.email,
        customerName:  existing.user.name || 'Customer',
        orderNumber:   existing.order_number,
        trackingUrl:   tracking_url || existing.tracking_url || '',
      }).catch(console.error)
    }

    return NextResponse.json({ success: true, order })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}