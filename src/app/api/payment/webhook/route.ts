import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyRazorpaySignature } from '@/lib/razorpay'
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
    include: { items: true }, // IMPORTANT
  })

  // Safety check
  if (!order || order.payment_status === 'PAID') {
    return NextResponse.json({ received: true })
  }

  // ✅ Single atomic transaction
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        payment_status: 'PAID',
        payment_id: razorpay_payment_id,
        status: 'CONFIRMED',
      },
    })

    await Promise.all(
      order.items.map((item) =>
        tx.product.update({
          where: { id: item.product_id },
          data: { stock: { decrement: item.quantity } },
        })
      )
    )
  })
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
      // Keep order as PENDING — user can retry payment
      // Optionally notify user here
      console.log(`Payment failed for order: ${order?.order_number}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}