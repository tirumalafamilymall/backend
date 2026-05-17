import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyRazorpaySignature } from '@/lib/razorpay'
import { getUserFromRequest } from '@/lib/auth'
import { sendOrderConfirmationMail } from '@/lib/mailer'
import { createShiprocketOrder, generateAWB } from '@/lib/shiprocket' 

// POST /api/payment/verify
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

    // 🔥 ATOMIC UPDATE: Only update if UNPAID
    const updatedOrderResult = await prisma.order.updateMany({
      where: { id: order.id, payment_status: 'UNPAID' },
      data: {
        payment_status: 'PAID',
        payment_id:     razorpay_payment_id,
        status:         'CONFIRMED',
      },
    })

    // If 0, the webhook already processed this payment!
    if (updatedOrderResult.count === 0) {
       const finalOrder = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true }})
       return NextResponse.json({ success: true, order: finalOrder })
    }

    // Now fetch the updated order to process stock and emails
    let updated = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    })

    // 🔥 TS FIX: Tell TypeScript this will never be null at this stage
    if (!updated) {
       return NextResponse.json({ error: 'Failed to retrieve updated order' }, { status: 500 })
    }

    // 1. Deduct stock NOW that payment is successful
    await Promise.all(
      updated.items.map((item) => {
        if (item.variant_id) {
          return prisma.productVariant.update({
            where: { id: item.variant_id },
            data:  { stock: { decrement: item.quantity } },
          })
        }
        return Promise.resolve() 
      })
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

    // ==========================================
    // 🤖 FULL AUTOMATION: SHIPROCKET INJECTION
    // ==========================================
    try {
      const shiprocketData = await createShiprocketOrder(updated.id);
      const awbData = await generateAWB(shiprocketData.shipment_id);

      updated = await prisma.order.update({
        where: { id: updated.id },
        data: {
          shiprocket_order_id: String(shiprocketData.order_id),
          shiprocket_shipment_id: String(shiprocketData.shipment_id),
          tracking_url: awbData.response?.data?.awb_code ? `https://shiprocket.co/tracking/${awbData.response.data.awb_code}` : null,
          status: 'SHIPPED', 
        },
        include: { items: true }
      });

      console.log(`✅ Auto-Shipment Success for Order: ${updated.order_number}`);
    } catch (shipError) {
      console.error("❌ Auto-Shipment Failed, falling back to manual:", shipError);
    }
    // ==========================================

    // 3. Send Email using the 'updated' object
    if (user.email) {
      sendOrderConfirmationMail({
        customerEmail:   user.email,
        customerName:    user.name || 'Customer',
        orderNumber:     updated.order_number,
        items:           updated.items,
        totalAmount:     Number(updated.total_amount), 
        shippingAddress: updated.shipping_address as any, // 🔥 TS FIX: Cast Prisma JsonValue to any
      }).catch(console.error)
    }

    return NextResponse.json({ success: true, order: updated })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 })
  }
}