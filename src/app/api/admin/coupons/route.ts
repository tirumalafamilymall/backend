import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { created_at: 'desc' }
    })
    return NextResponse.json({ success: true, coupons })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await req.json()

    const existing = await prisma.coupon.findUnique({
      where: { code: data.code.toUpperCase() }
    })
    if (existing) {
      return NextResponse.json({ error: 'Coupon code already exists' }, { status: 400 })
    }

    const coupon = await prisma.coupon.create({
      data: {
        name:             data.name,
        code:             data.code.toUpperCase(),
        description:      data.description || null,
        discount_percent: Number(data.discount_percent),
        min_order_value:  Number(data.min_order_value),
        expires_at:       new Date(data.expires_at)
      }
    })
    return NextResponse.json({ success: true, coupon }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 })
  }
}