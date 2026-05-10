import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const orders = await prisma.order.findMany({
      where: {
        NOT: { shiprocket_order_id: null },
        status: { in: ['CONFIRMED', 'SHIPPED'] } // Items in transit or ready to ship
      },
      orderBy: { created_at: 'desc' }
    })

    return NextResponse.json({ success: true, orders })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch shipping queue' }, { status: 500 })
  }
}