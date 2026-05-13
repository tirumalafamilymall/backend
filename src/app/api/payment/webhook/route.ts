import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

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

      await prisma.order.update({
        where: { id: order.id },
        data: {
          payment_status: 'PAID',
          payment_id: razorpay_payment_id,
          status: 'CONFIRMED',
        },
      })

      // CHANGED: Webhook must also deduct stock from variants if the main route failed!
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

      // CHANGED: Webhook must also clear the user's cart
      const userCart = await prisma.cart.findUnique({ 
        where: { user_id: order.user_id } 
      })
      if (userCart) {
        await prisma.cartItem.deleteMany({ 
          where: { cart_id: userCart.id } 
        })
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