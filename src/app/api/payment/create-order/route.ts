import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { razorpay } from '@/lib/razorpay'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { order_id } = await req.json()

    if (!order_id) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
    }

    // 1. Fetch the order and ensure it belongs to the user
    const order = await prisma.order.findFirst({
      where: { id: order_id, user_id: user.id },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.payment_status === 'PAID') {
      return NextResponse.json({ error: 'Order already paid' }, { status: 400 })
    }

    // 2. Convert amount to Paisa (Razorpay requirement: ₹1 = 100 Paisa)
    // CHANGED: Explicitly cast Decimal to Number
    const amountInPaisa = Math.round(Number(order.total_amount) * 100)

    console.log(`💳 Creating Razorpay Order for TFM Order: ${order.order_number}`)
    console.log(`💰 Total Amount: ₹${Number(order.total_amount)} (${amountInPaisa} Paisa)`)

    // 3. Create the Razorpay Order
    const razorpayOrder = await razorpay.orders.create({
      amount:   amountInPaisa,
      currency: 'INR',
      receipt:  order.order_number,
      notes: {
        order_id: order.id,
        user_id:  user.id,
      },
    })

    // 4. Store the Razorpay ID in our database
    await prisma.order.update({
      where: { id: order.id },
      data:  { razorpay_order_id: razorpayOrder.id },
    })

    // 5. Return everything the frontend needs to open the popup
    return NextResponse.json({
      success:           true,
      razorpay_order_id: razorpayOrder.id,
      amount:            razorpayOrder.amount,
      currency:          razorpayOrder.currency,
      key_id:            process.env.RAZORPAY_KEY_ID, 
    })
  } catch (error: any) {
    console.error("❌ Razorpay Order Creation Failed:", error)
    return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 })
  }
}