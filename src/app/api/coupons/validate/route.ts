import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { code, subtotal } = await req.json()
    if (!code || !subtotal) return NextResponse.json({ error: 'Missing code or subtotal' }, { status: 400 })

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

    const discountAmount = (subtotal * Number(coupon.discount_percent)) / 100

    return NextResponse.json({ 
      success: true, 
      discountAmount, 
      percent: Number(coupon.discount_percent), 
      code: coupon.code 
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to validate coupon' }, { status: 500 })
  }
}