import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendShippingUpdateWhatsApp } from '@/lib/whatsapp'
import crypto from 'crypto'

// POST /api/shipping/webhook
// Shiprocket calls this to update shipment status automatically
export async function POST(req: Request) {
  try {
const rawBody = await req.text()
const signature = req.headers.get('x-shiprocket-signature')

if (!signature) {
  return NextResponse.json({ error: 'No signature' }, { status: 400 })
}

const secret = process.env.SHIPROCKET_WEBHOOK_SECRET
if (!secret) {
  console.error('SHIPROCKET_WEBHOOK_SECRET is not configured')
  return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
}

const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
if (expectedSignature !== signature) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
}

const body = JSON.parse(rawBody)

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
      'SHIPPED':           'SHIPPED',
      'IN TRANSIT':        'SHIPPED',
      'OUT FOR DELIVERY':  'SHIPPED',
      'DELIVERED':         'DELIVERED',
      'CANCELLED':         'CANCELLED',
      'RTO INITIATED':     'CANCELLED',
      'RTO DELIVERED':     'CANCELLED',
      'PICKUP SCHEDULED':  'CONFIRMED',
      'PICKUP GENERATED':  'CONFIRMED',
      'PICKUP QUEUED':     'CONFIRMED',
      'READY TO SHIP':     'CONFIRMED',
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

      // If the status just changed to SHIPPED and we have a tracking URL, WhatsApp them!
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