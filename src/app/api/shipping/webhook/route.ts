import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendShippingUpdateWhatsApp } from '@/lib/whatsapp'

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()

    if (!rawBody || rawBody.trim() === '' || rawBody === '{}') {
      return NextResponse.json({ success: true })
    }

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ success: true })
    }

    const { order_id, channel_order_id, current_status, awb_code } = body

    const orderNumber = channel_order_id || order_id
    if (!orderNumber) {
      return NextResponse.json({ success: true })
    }

    const order = await prisma.order.findFirst({
      where: { order_number: orderNumber.toString() },
    })

    // Return 200 even if order not found — handles Shiprocket test pings
    if (!order) {
      console.warn(`Webhook: unknown order ${orderNumber}`)
      return NextResponse.json({ success: true })
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
    console.error('Shiprocket Webhook Error:', error)
    return NextResponse.json({ success: true })
  }
}

export async function GET() {
  return NextResponse.json({ success: true, message: 'Webhook endpoint active' })
}