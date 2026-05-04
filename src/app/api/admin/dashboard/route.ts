import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [
      total_products,
      active_products,
      out_of_stock,
      total_users,
      total_orders,
      pending_orders,
      confirmed_orders,
      shipped_orders,
      revenue,
      recent_orders,
      low_stock,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { is_active: true } }),
      prisma.product.count({ where: { is_active: true, stock: 0 } }),
      prisma.user.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'CONFIRMED' } }),
      prisma.order.count({ where: { status: 'SHIPPED' } }),
      prisma.order.aggregate({
        where: { payment_status: 'PAID' },
        _sum: { total_amount: true },
      }),
      prisma.order.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          user:  { select: { name: true, email: true } },
          items: true,
        },
      }),
      prisma.product.findMany({
        where: { is_active: true, stock: { lte: 5 } },
        orderBy: { stock: 'asc' },
        take: 10,
        select: {
          id:           true,
          name:         true,
          product_code: true,
          stock:        true,
          category:     true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      stats: {
        products: {
          total:        total_products,
          active:       active_products,
          out_of_stock,
          low_stock,
        },
        users: {
          total: total_users,
        },
        orders: {
          total:     total_orders,
          pending:   pending_orders,
          confirmed: confirmed_orders,
          shipped:   shipped_orders,
        },
        revenue: {
          total: revenue._sum.total_amount ?? 0,
        },
        recent_orders,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 })
  }
}