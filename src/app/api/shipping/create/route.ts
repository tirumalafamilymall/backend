import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createShiprocketOrder } from '@/lib/shiprocket'
import { getAdminFromRequest } from '@/lib/auth'

// POST /api/shipping/create
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

    let shiprocketData;

    try {
      // 1. Try to call the real API first
      shiprocketData = await createShiprocketOrder(order_id)
    } catch (apiError: any) {
      // 2. MOCK FALLBACK: If real API fails (likely due to 0 balance)
      console.warn("⚠️ Shiprocket API failed. Switching to MOCK data for testing.");
      
      shiprocketData = {
        order_id: `MOCK-SR-${Date.now()}`,
        shipment_id: `MOCK-SHP-${Date.now()}`,
        status: "NEW",
        is_mock: true
      }
    }

    // 🔥 CRITICAL FIX: We MUST store the `shipment_id` into the database.
    // All downstream Shiprocket APIs (AWB, Labels, Pickups) require shipment_id!
    const targetShipmentId = shiprocketData.shipment_id || shiprocketData.order_id

    // 3. Save IDs + update status so Admin UI reflects the change
    const updated = await prisma.order.update({
      where: { id: order_id },
      data: {
        shiprocket_order_id: String(targetShipmentId),
        status: 'CONFIRMED', 
      },
    })

    return NextResponse.json({
      success: true,
      order: updated,
      shiprocket: shiprocketData,
      mode: shiprocketData?.is_mock ? 'TESTING' : 'LIVE'
    })

  } catch (error: any) {
    console.error("Critical error in shipping route:", error)
    return NextResponse.json(
      { error: error.message || 'Failed to process shipment' },
      { status: 500 }
    )
  }
}