import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyRazorpaySignature } from '@/lib/razorpay'
import { getUserFromRequest } from '@/lib/auth'
import { sendOrderConfirmationMail } from '@/lib/mailer' // <-- ADDED IMPORT

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

    // 1. Deduct stock NOW that payment is successful
    await Promise.all(
      updated.items.map((item) =>
        prisma.product.update({
          where: { id: item.product_id },
          data:  { stock: { decrement: item.quantity } },
        })
      )
    )

    // 2. Clear the user's cart NOW that payment is successful
    const userCart = await prisma.cart.findUnique({ 
      where: { user_id: user.id } 
    })
    
    if (userCart) {
      await prisma.cartItem.deleteMany({ 
        where: { cart_id: userCart.id } 
      })
    }

    // 3. Send Email using the 'updated' object
    if (user.email) {
      sendOrderConfirmationMail({
        customerEmail:   user.email,
        customerName:    user.name || 'Customer',
        orderNumber:     updated.order_number,
        items:           updated.items,
        totalAmount:     updated.total_amount,
        shippingAddress: updated.shipping_address, // Extracted from 'updated'
      }).catch(console.error)
    }

    return NextResponse.json({ success: true, order: updated })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 })
  }
}