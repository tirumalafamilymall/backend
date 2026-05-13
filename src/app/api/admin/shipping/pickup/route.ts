import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { schedulePickup } from '@/lib/shiprocket'
import { getAdminFromRequest } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const admin = await getAdminFromRequest(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { order_id, shipment_id } = await req.json()

    if (!shipment_id) {
      return NextResponse.json({ error: 'shipment_id is required' }, { status: 400 })
    }

    // Call Shiprocket to notify the courier
    const pickupData = await schedulePickup(shipment_id)

    // Update order status if necessary (e.g., to indicate pickup is requested)
    const updatedOrder = await prisma.order.update({
      where: { id: order_id },
      data: { status: 'SHIPPED' } // Or a custom status like 'PICKUP_SCHEDULED'
    })

    return NextResponse.json({
      success: true,
      message: 'Pickup scheduled successfully',
      pickup: pickupData,
      order: updatedOrder
    })

  } catch (error: any) {
    console.error("Pickup Error:", error?.response?.data || error)
    return NextResponse.json({ error: 'Failed to schedule pickup' }, { status: 500 })
  }
}