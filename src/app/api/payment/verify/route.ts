import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyRazorpaySignature } from '@/lib/razorpay'
import { getUserFromRequest } from '@/lib/auth'

// POST /api/payment/verify
// Called after Razorpay checkout succeeds on frontend
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id }
export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id,
    } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
    }

    // Verify signature
    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    )

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // Verify order belongs to user
    const order = await prisma.order.findFirst({
      where: { id: order_id, user_id: user.id },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.payment_status === 'PAID') {
      return NextResponse.json({ error: 'Order already paid' }, { status: 400 })
    }

const updated = await prisma.order.update({
  where: { id: order.id },
  data: {
    payment_status: 'PAID',
    payment_id:     razorpay_payment_id,
    status:         'CONFIRMED',
  },
  include: { items: true },
})

return NextResponse.json({ success: true, order: updated })


  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 })
  }
}