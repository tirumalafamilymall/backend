import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/admin/orders — get all orders (admin view)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const status = searchParams.get('status')

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    const where = status ? { status: status as any } : {}

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true, user: true },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      orders,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}