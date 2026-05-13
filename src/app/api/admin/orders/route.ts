import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const status = searchParams.get('status')
    const payment_status = searchParams.get('payment_status')
    const search = searchParams.get('search')

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    const where: any = {
      ...(status && { status: status as any }),
      ...(payment_status && { payment_status: payment_status as any }),
      ...(search && {
        OR: [
          { order_number: { contains: search, mode: 'insensitive' } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ]
      })
    }

    const [rawOrders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true, user: true },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    // SAFELY CONVERT DECIMALS TO NUMBERS FOR THE FRONTEND
    const orders = rawOrders.map(order => ({
      ...order,
      total_amount: Number(order.total_amount),
      shipping_amount: Number(order.shipping_amount),
      items: order.items.map(item => ({
        ...item,
        price: Number(item.price)
      }))
    }))

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