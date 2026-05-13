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

    let updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        payment_status: 'PAID',
        payment_id:     razorpay_payment_id,
        status:         'CONFIRMED',
      },
      include: { items: true },
    })

    // 1. Deduct stock NOW that payment is successful
    // CHANGED: Deduct from the specific Variant, not the Parent
    await Promise.all(
      updated.items.map((item) => {
        if (item.variant_id) {
          return prisma.productVariant.update({
            where: { id: item.variant_id },
            data:  { stock: { decrement: item.quantity } },
          })
        }
        return Promise.resolve() // Fallback if variant_id is somehow missing
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
          // Need to add awb column to schema if it doesn't exist, using tracking_url as fallback
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
        totalAmount:     Number(updated.total_amount), // Explicitly cast Decimal
        shippingAddress: updated.shipping_address, 
      }).catch(console.error)
    }

    return NextResponse.json({ success: true, order: updated })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 })
  }
}