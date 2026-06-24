import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const [
      total_products,
      active_products,
      out_of_stock_count,
      total_users,
      total_orders,
      pending_orders,
      confirmed_orders,
      shipped_orders,
      revenue_agg,
      recent_orders,
    ] = await Promise.all([
      prisma.product.count({ where: { is_deleted: false } }),
      prisma.product.count({ where: { is_active: true, is_deleted: false } }),
      
      // NEW LOGIC: Count products where ALL variants have 0 stock
      prisma.product.count({ 
        where: { 
          is_active: true, 
          is_deleted: false,
          variants: {
            none: {
              stock: { gt: 0 }
            }
          }
        } 
      }),

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
    ])

    return NextResponse.json({
      success: true,
      stats: {
        products: {
          total:        total_products,
          active:       active_products,
          out_of_stock: out_of_stock_count,
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
          total: Number(revenue_agg._sum.total_amount ?? 0), // Safe Decimal cast
        },
        recent_orders: recent_orders.map(o => ({
          ...o,
          total_amount: Number(o.total_amount) // Safe Decimal cast for list
        })),
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 })
  }
}