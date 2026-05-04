import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { trackShipment } from '@/lib/shiprocket'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/shipping/track?order_id=xxx
export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const order_id = searchParams.get('order_id')

    if (!order_id) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
    }

    const order = await prisma.order.findFirst({
      where: { id: order_id, user_id: user.id },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!order.shiprocket_order_id) {
      return NextResponse.json(
        { error: 'Shipment not yet created for this order' },
        { status: 400 }
      )
    }

    const tracking = await trackShipment(order.shiprocket_order_id)

    // Update tracking url if available
    if (tracking?.tracking_data?.track_url) {
      await prisma.order.update({
        where: { id: order.id },
        data: { tracking_url: tracking.tracking_data.track_url },
      })
    }

    return NextResponse.json({ success: true, tracking })
  } catch (error: any) {
    console.error(error?.response?.data || error)
    return NextResponse.json(
      { error: 'Failed to fetch tracking info' },
      { status: 500 }
    )
  }
}