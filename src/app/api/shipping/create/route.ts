import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createShiprocketOrder } from '@/lib/shiprocket'
import { getAdminFromRequest } from '@/lib/auth'

// POST /api/shipping/create
// Called by admin after order is CONFIRMED + PAID
// Body: { order_id }
export async function POST(req: Request) {
  try {

    const admin = await getAdminFromRequest(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { order_id } = await req.json()

    if (!order_id) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({ where: { id: order_id } })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.payment_status !== 'PAID') {
      return NextResponse.json({ error: 'Order is not paid' }, { status: 400 })
    }

    if (order.shiprocket_order_id) {
      return NextResponse.json(
        { error: 'Shipment already created for this order' },
        { status: 400 }
      )
    }

    const shiprocketData = await createShiprocketOrder(order_id)

    // Save shiprocket order id + update status
    const updated = await prisma.order.update({
      where: { id: order_id },
      data: {
        shiprocket_order_id: String(shiprocketData.order_id),
        status: 'CONFIRMED',
      },
    })

    return NextResponse.json({
      success: true,
      order: updated,
      shiprocket: shiprocketData,
    })
  } catch (error: any) {
    console.error(error?.response?.data || error)
    return NextResponse.json(
      { error: error.message || 'Failed to create shipment' },
      { status: 500 }
    )
  }
}