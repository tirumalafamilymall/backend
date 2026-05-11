import { NextResponse } from 'next/server'
import { checkServiceability } from '@/lib/shiprocket'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const pincode = searchParams.get('pincode')
    const cod = false

    // 1. Validate Pincode Input first
    if (!pincode || pincode.length !== 6 || isNaN(Number(pincode))) {
      return NextResponse.json({ error: 'Valid 6-digit pincode is required' }, { status: 400 })
    }

    // 2. Define pickup postcode from ENV
    const pickup_postcode = process.env.STORE_PINCODE!

    try {
      // 3. Try real Shiprocket call
      const data = await checkServiceability(pickup_postcode, pincode, 0.5, cod)
      const available_couriers = data?.data?.available_courier_companies || []

      // 4. MOCK FALLBACK: If wallet is empty (0 couriers)
      if (available_couriers.length === 0) {
        return NextResponse.json({
          success: true,
          is_serviceable: true, 
          shipping_cost: 59, // Mock fee based on your screenshot
          couriers: 1,
          estimated_days: 3,
          note: "Testing Mode: Wallet balance 0, using mock rates" 
        })
      }

      // 5. If real couriers ARE found (after you recharge)
      const actual_cost = available_couriers[0]?.freight_charge || 0

      return NextResponse.json({
        success: true,
        is_serviceable: true,
        shipping_cost: Number(actual_cost),
        couriers: available_couriers.length,
        estimated_days: available_couriers[0]?.estimated_delivery_days || null,
      })

    } catch (apiErr) {
      // If Shiprocket API is totally down/unauthorized, still fallback so you can test
      console.error("Shiprocket API Error:", apiErr)
      return NextResponse.json({
        success: true,
        is_serviceable: true,
        shipping_cost: 59,
        note: "Testing Mode: API failure fallback"
      })
    }

  } catch (error: any) {
    console.error("General error:", error)
    return NextResponse.json(
      { error: 'Failed to check serviceability' },
      { status: 500 }
    )
  }
}