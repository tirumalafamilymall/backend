import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendShippingUpdateWhatsApp } from '@/lib/whatsapp'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()

    // Always return 200 for empty/verification pings
    if (!rawBody || rawBody.trim() === '' || rawBody === '{}') {
      return NextResponse.json({ success: true })
    }

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ success: true })
    }

    const { order_id, current_status, etd, awb_code } = body

    // If no order_id it's just a test ping — return 200
    if (!order_id) {
      return NextResponse.json({ success: true })
    }

    if (process.env.SHIPROCKET_WEBHOOK_SECRET) {
      const signature = req.headers.get('x-shiprocket-signature')
      if (!signature) {
        return NextResponse.json({ error: 'No signature' }, { status: 400 })
      }
      const expectedSignature = crypto
        .createHmac('sha256', process.env.SHIPROCKET_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex')
      if (expectedSignature !== signature) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
      }
    }

    const order = await prisma.order.findFirst({
      where: { order_number: order_id },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const statusMap: Record<string, string> = {
      'SHIPPED':          'SHIPPED',
      'IN TRANSIT':       'SHIPPED',
      'OUT FOR DELIVERY': 'SHIPPED',
      'DELIVERED':        'DELIVERED',
      'CANCELLED':        'CANCELLED',
      'RTO INITIATED':    'CANCELLED',
      'RTO DELIVERED':    'CANCELLED',
      'PICKUP SCHEDULED': 'CONFIRMED',
      'PICKUP GENERATED': 'CONFIRMED',
      'PICKUP QUEUED':    'CONFIRMED',
      'READY TO SHIP':    'CONFIRMED',
    }

    const mappedStatus = statusMap[current_status?.toUpperCase()]

    if (mappedStatus) {
      const trackingUrl = awb_code ? `https://shiprocket.co/tracking/${awb_code}` : null

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: mappedStatus as any,
          ...(trackingUrl && { tracking_url: trackingUrl }),
        },
      })

      if (mappedStatus === 'SHIPPED' && trackingUrl) {
        const phone = (order.shipping_address as any)?.phone
        if (phone) {
          sendShippingUpdateWhatsApp(phone, order.order_number, trackingUrl).catch(console.error)
        }
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}