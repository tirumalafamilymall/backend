import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/shipping/webhook
// Shiprocket calls this to update shipment status automatically
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Shiprocket sends order_id (our order_number) and current_status
    const { order_id, current_status, etd, awb_code } = body

    if (!order_id) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
    }

    const order = await prisma.order.findFirst({
      where: { order_number: order_id },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Map Shiprocket statuses to our OrderStatus
    const statusMap: Record<string, string> = {
      'SHIPPED':                    'SHIPPED',
      'IN TRANSIT':                 'SHIPPED',
      'OUT FOR DELIVERY':           'SHIPPED',
      'DELIVERED':                  'DELIVERED',
      'CANCELLED':                  'CANCELLED',
      'RTO INITIATED':              'CANCELLED',
      'RTO DELIVERED':              'CANCELLED',
      'PICKUP SCHEDULED':           'CONFIRMED',
      'PICKUP GENERATED':           'CONFIRMED',
      'PICKUP QUEUED':              'CONFIRMED',
      'READY TO SHIP':              'CONFIRMED',
    }

    const mappedStatus = statusMap[current_status?.toUpperCase()]

    if (mappedStatus) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: mappedStatus as any,
          ...(awb_code && {
            tracking_url: `https://shiprocket.co/tracking/${awb_code}`,
          }),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}