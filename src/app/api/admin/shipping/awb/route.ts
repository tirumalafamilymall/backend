import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateAWB, schedulePickup } from '@/lib/shiprocket'

// POST /api/admin/shipping/awb
async function handlePOST(req: Request) {
  try {
    const { order_id, shipment_id } = await req.json()

    if (!order_id || !shipment_id) {
      return NextResponse.json(
        { error: 'order_id and shipment_id are required' },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({ where: { id: order_id } })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // 1. Generate AWB (assigns courier + tracking number)
    const awbData = await generateAWB(shipment_id)
    
    // Extract values safely from Shiprocket's standard API response payload
    const extractedAwb = awbData?.response?.awb_code || null
    const extractedTrackUrl = awbData?.response?.tracking_url || null

    if (!extractedAwb) {
      console.error("❌ Shiprocket did not return an AWB code:", awbData)
    }

    // 2. Schedule pickup immediately after AWB
    const pickupData = await schedulePickup(shipment_id)

    // 3. 🔥 FIX 2: Save the tracking data into your Prisma database!
    const updated = await prisma.order.update({
      where: { id: order_id },
      data: { 
        status: 'SHIPPED',
        awb_code: extractedAwb ? String(extractedAwb) : null,
        tracking_url: extractedTrackUrl ? String(extractedTrackUrl) : null
      },
    })

    return NextResponse.json({
      success: true,
      order:   updated,
      awb:     awbData,
      pickup:  pickupData,
    })
  } catch (error: any) {
    console.error(error?.response?.data || error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate AWB' },
      { status: 500 }
    )
  }
}

export { handlePOST as POST }