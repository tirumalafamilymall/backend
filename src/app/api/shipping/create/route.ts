// import { NextResponse } from 'next/server'
// import { prisma } from '@/lib/prisma'
// import { createShiprocketOrder } from '@/lib/shiprocket'
// import { getAdminFromRequest } from '@/lib/auth'

// // POST /api/shipping/create
// // Called by admin after order is CONFIRMED + PAID
// // Body: { order_id }
// export async function POST(req: Request) {
//   try {

//     const admin = await getAdminFromRequest(req)
//     if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//     const { order_id } = await req.json()

//     if (!order_id) {
//       return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
//     }

//     const order = await prisma.order.findUnique({ where: { id: order_id } })

//     if (!order) {
//       return NextResponse.json({ error: 'Order not found' }, { status: 404 })
//     }

//     if (order.payment_status !== 'PAID') {
//       return NextResponse.json({ error: 'Order is not paid' }, { status: 400 })
//     }

//     if (order.shiprocket_order_id) {
//       return NextResponse.json(
//         { error: 'Shipment already created for this order' },
//         { status: 400 }
//       )
//     }

//     const shiprocketData = await createShiprocketOrder(order_id)

//     // Save shiprocket order id + update status
//     const updated = await prisma.order.update({
//       where: { id: order_id },
//       data: {
//         shiprocket_order_id: String(shiprocketData.order_id),
//         status: 'CONFIRMED',
//       },
//     })

//     return NextResponse.json({
//       success: true,
//       order: updated,
//       shiprocket: shiprocketData,
//     })
//   } catch (error: any) {
//     console.error(error?.response?.data || error)
//     return NextResponse.json(
//       { error: error.message || 'Failed to create shipment' },
//       { status: 500 }
//     )
//   }
// }

// Testing code
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createShiprocketOrder } from '@/lib/shiprocket'
import { getAdminFromRequest } from '@/lib/auth'

// POST /api/shipping/create
// TEST VERSION: Includes Mock Fallback for zero-balance testing
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

    // Still verify payment to ensure your checkout logic is sound
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
        is_mock: true // Flag to help you identify test orders in DB
      }
    }

    // 3. Save IDs + update status so Admin UI reflects the change
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
      mode: shiprocketData.is_mock ? 'TESTING' : 'LIVE'
    })

  } catch (error: any) {
    console.error("Critical error in shipping route:", error)
    return NextResponse.json(
      { error: error.message || 'Failed to process shipment' },
      { status: 500 }
    )
  }
}