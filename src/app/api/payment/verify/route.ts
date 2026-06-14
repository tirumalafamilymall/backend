import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyRazorpaySignature } from '@/lib/razorpay'
import { getUserFromRequest } from '@/lib/auth'
import { sendOrderConfirmationMail, sendAdminOrderMail } from '@/lib/mailer'
import { createShiprocketOrder, generateAWB, schedulePickup } from '@/lib/shiprocket' 
import { sendOrderConfirmationWhatsApp, sendAdminOrderWhatsApp } from '@/lib/whatsapp'

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
    // 🤖 100% ZERO-TOUCH AUTOMATION INJECTION
    // ==========================================
    try {
      // A. Create the order in Shiprocket
      const shiprocketData = await createShiprocketOrder(updated.id);
      
      // B. Extract the critical shipment ID (with fallback for test mocks)
      const targetShipmentId = shiprocketData.shipment_id || shiprocketData.order_id;
      
      // C. Generate the tracking AWB and request the courier pickup simultaneously
      const awbData = await generateAWB(targetShipmentId);
      await schedulePickup(targetShipmentId); // 🚚 The driver is now officially on the way!

// D. Update your database with the tracking context
const extractedAwb = awbData?.response?.data?.awb_code || null

updated = await prisma.order.update({
  where: { id: updated.id },
  data: {
    shiprocket_order_id: String(targetShipmentId),
    awb_code: extractedAwb ? String(extractedAwb) : null,
    tracking_url: extractedAwb ? `https://shiprocket.co/tracking/${extractedAwb}` : null,
    status: 'SHIPPED',
  },
  include: { items: true }
});

      console.log(`✅ 100% Auto-Shipment Success for Order: ${updated.order_number}`);
    } catch (shipError) {
      console.error("❌ Auto-Shipment Failed, falling back to manual admin dashboard processing:", shipError);
      // Notice we DO NOT throw an error here. If Shiprocket is down, the customer's payment still succeeds and the order stays "CONFIRMED".
    }
    // ==========================================

// 3. Send Notifications (Email & WhatsApp)
    if (user.email) {
      sendOrderConfirmationMail({
        customerEmail:   user.email,
        customerName:    user.name || 'Customer',
        orderNumber:     updated.order_number,
        items:           updated.items,
        totalAmount:     Number(updated.total_amount), 
        shippingAddress: updated.shipping_address as any,
      }).catch(console.error)
    }

    sendAdminOrderMail({
  orderNumber:     updated.order_number,
  customerName:    user.name || 'Customer',
  customerEmail:   user.email || '',
  customerPhone:   (updated.shipping_address as any)?.phone || '',
  items:           updated.items,
  totalAmount:     Number(updated.total_amount),
  shippingAddress: updated.shipping_address as any,
}).catch(console.error)

sendAdminOrderWhatsApp(
  updated.order_number,
  user.name || 'Customer',
  (updated.shipping_address as any)?.phone || '',
  `₹${Number(updated.total_amount).toLocaleString('en-IN')}`,
  updated.items.map(item => ({
    name: item.name,
    quantity: item.quantity,
    size: item.size,
    color: item.color,
  }))
).catch(console.error)

    // 🔥 ADDED: Instantly ping customer's WhatsApp
    const phone = (updated.shipping_address as any)?.phone;
    if (phone) {
      sendOrderConfirmationWhatsApp(
        phone, 
        user.name || 'Valued Customer', 
        updated.order_number, 
        `₹${Number(updated.total_amount).toLocaleString('en-IN')}`
      ).catch(console.error) // Non-blocking!
    }

    return NextResponse.json({ success: true, order: updated })

  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 })
  }
}