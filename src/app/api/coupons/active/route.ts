import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    // 1. Check if the frontend sent a user ID in the URL
    const { searchParams } = new URL(req.url)
    const uid = searchParams.get('uid')
    
    let usedCouponIds: string[] = []

    // 2. If we have a user, look up their past successful orders
    if (uid) {
      const user = await prisma.user.findUnique({ where: { firebase_uid: uid } })
      if (user) {
        const pastOrders = await prisma.order.findMany({
          where: { 
            user_id: user.id, 
            coupon_id: { not: null }, 
            status: { not: 'CANCELLED' } 
          },
          select: { coupon_id: true }
        })
        usedCouponIds = pastOrders.map(o => o.coupon_id as string)
      }
    }

    // 3. Fetch active coupons, EXCLUDING the ones they already used!
    const activeCoupons = await prisma.coupon.findMany({
      where: {
        is_active: true,
        expires_at: { gt: new Date() },
        // 🔥 The Magic Filter: If they have used coupons, exclude those IDs
        ...(usedCouponIds.length > 0 ? { id: { notIn: usedCouponIds } } : {}) 
      },
      select: {
        id: true, name: true, code: true, discount_percent: true, 
        min_order_value: true, expires_at: true
      },
      orderBy: { created_at: 'desc' }
    })

    return NextResponse.json({ success: true, coupons: activeCoupons })
  } catch (error) {
    console.error("Failed to fetch public coupons:", error)
    return NextResponse.json({ error: 'Failed to fetch active coupons' }, { status: 500 })
  }
}