import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest('hex')

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
    }

    const event = JSON.parse(rawBody)

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity
      const razorpay_order_id = payment.order_id
      const razorpay_payment_id = payment.id

      const order = await prisma.order.findFirst({
        where: { razorpay_order_id },
        include: { items: true },
      })

      // Safety check
      if (!order || order.payment_status === 'PAID') {
        return NextResponse.json({ received: true })
      }

      // 🔥 ATOMIC UPDATE
      const updatedOrderResult = await prisma.order.updateMany({
        where: { id: order.id, payment_status: 'UNPAID' },
        data: {
          payment_status: 'PAID',
          payment_id: razorpay_payment_id,
          status: 'CONFIRMED',
        },
      })

      if (updatedOrderResult.count === 0) {
        return NextResponse.json({ received: true }) // Already processed by frontend
      }

      // Deduct stock
      await Promise.all(
        order.items.map((item) => {
          if (item.variant_id) {
            return prisma.productVariant.update({
              where: { id: item.variant_id },
              data:  { stock: { decrement: item.quantity } },
            })
          }
          return Promise.resolve()
        })
      )

      // Clear cart
      const userCart = await prisma.cart.findUnique({
        where: { user_id: order.user_id }
      })
      if (userCart) {
        await prisma.cartItem.deleteMany({
          where: { cart_id: userCart.id }
        })
      }

      // Auto-shipment
      try {
        const { createShiprocketOrder, generateAWB, schedulePickup } = await import('@/lib/shiprocket')

        const shiprocketData = await createShiprocketOrder(order.id)
        const targetShipmentId = shiprocketData.shipment_id || shiprocketData.order_id
        const awbData = await generateAWB(targetShipmentId)
        await schedulePickup(targetShipmentId)

        const extractedAwb = awbData?.response?.data?.awb_code || null

        await prisma.order.update({
          where: { id: order.id },
          data: {
            shiprocket_order_id: String(targetShipmentId),
            awb_code:    extractedAwb ? String(extractedAwb) : null,
            tracking_url: extractedAwb ? `https://shiprocket.co/tracking/${extractedAwb}` : null,
            status: 'SHIPPED',
          }
        })

        console.log(`✅ Webhook Auto-Shipment Success for Order: ${order.order_number}`)
      } catch (shipError) {
        console.error('❌ Webhook Auto-Shipment Failed:', shipError)
      }

      // Notifications
      try {
        const { sendOrderConfirmationMail, sendAdminOrderMail } = await import('@/lib/mailer')
        const { sendOrderConfirmationWhatsApp, sendAdminOrderWhatsApp } = await import('@/lib/whatsapp')

        const user = await prisma.user.findUnique({ where: { id: order.user_id } })

        const freshOrder = await prisma.order.findUnique({
          where: { id: order.id },
          include: { items: true }
        })

        if (!freshOrder) throw new Error('Order not found')

        if (user?.email) {
          sendOrderConfirmationMail({
            customerEmail:   user.email,
            customerName:    user.name || 'Customer',
            orderNumber:     freshOrder.order_number,
            items:           freshOrder.items,
            totalAmount:     Number(freshOrder.total_amount),
            shippingAddress: freshOrder.shipping_address as any,
          }).catch(console.error)
        }

        sendAdminOrderMail({
          orderNumber:     freshOrder.order_number,
          customerName:    user?.name || 'Customer',
          customerEmail:   user?.email || '',
          customerPhone:   (freshOrder.shipping_address as any)?.phone || '',
          items:           freshOrder.items,
          totalAmount:     Number(freshOrder.total_amount),
          shippingAddress: freshOrder.shipping_address as any,
        }).catch(console.error)

        sendAdminOrderWhatsApp(
          freshOrder.order_number,
          user?.name || 'Customer',
          (freshOrder.shipping_address as any)?.phone || '',
          `₹${Number(freshOrder.total_amount).toLocaleString('en-IN')}`,
          freshOrder.items.map(item => ({
            name:     item.name,
            quantity: item.quantity,
            size:     item.size,
            color:    item.color,
          }))
        ).catch(console.error)

        const phone = (freshOrder.shipping_address as any)?.phone
        if (phone) {
          sendOrderConfirmationWhatsApp(
            phone,
            user?.name || 'Valued Customer',
            freshOrder.order_number,
            `₹${Number(freshOrder.total_amount).toLocaleString('en-IN')}`
          ).catch(console.error)
        }
      } catch (notifError) {
        console.error('❌ Webhook Notifications Failed:', notifError)
      }
    }

    // Handle payment failed event
    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity
      const razorpay_order_id = payment.order_id

      const order = await prisma.order.findFirst({
        where: { razorpay_order_id },
      })

      if (!order) {
        return NextResponse.json({ received: true })
      }

      console.log(`Payment failed for order: ${order?.order_number}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}