import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    // 🔥 CHANGED: Expecting firebaseUid instead of Prisma userId
    const { code, subtotal, firebaseUid } = await req.json()
    
    if (!code || !subtotal || !firebaseUid) {
      return NextResponse.json({ error: 'Missing code, subtotal, or user auth' }, { status: 400 })
    }

    const coupon = await prisma.coupon.findUnique({ 
      where: { code: code.toUpperCase() } 
    })
    
    if (!coupon || !coupon.is_active) {
      return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 })
    }
    if (new Date() > coupon.expires_at) {
      return NextResponse.json({ error: 'Coupon has expired' }, { status: 400 })
    }
    if (subtotal < Number(coupon.min_order_value)) {
      return NextResponse.json({ error: `Min order value is ₹${coupon.min_order_value}` }, { status: 400 })
    }

    // 1. Get the Prisma User ID
    const user = await prisma.user.findUnique({
      where: { firebase_uid: firebaseUid }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 })
    }

    // 2. Check the Order table using the correct Prisma ID
    const pastOrder = await prisma.order.findFirst({
      where: {
        user_id: user.id,
        coupon_id: coupon.id,
        status: { not: 'CANCELLED' }
      }
    })

    if (pastOrder) {
      return NextResponse.json({ error: 'You have already used this coupon code.' }, { status: 403 })
    }

    const discountAmount = (subtotal * Number(coupon.discount_percent)) / 100

    return NextResponse.json({ 
      success: true, 
      discountAmount, 
      percent: Number(coupon.discount_percent), 
      code: coupon.code,
      coupon_id: coupon.id // Sending this back so the checkout can save it!
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to validate coupon' }, { status: 500 })
  }
}