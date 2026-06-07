import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Only fetch coupons that are active and have an expiration date in the future
    const activeCoupons = await prisma.coupon.findMany({
      where: {
        is_active: true,
        expires_at: {
          gt: new Date() // Must be strictly greater than right now
        }
      },
      // Do not select the internal description or other sensitive admin info if you want to keep it light
      select: {
        id: true,
        name: true,
        code: true,
        discount_percent: true,
        min_order_value: true,
        expires_at: true,
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    return NextResponse.json({ success: true, coupons: activeCoupons })
  } catch (error) {
    console.error("Failed to fetch public coupons:", error)
    return NextResponse.json({ error: 'Failed to fetch active coupons' }, { status: 500 })
  }
}