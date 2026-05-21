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

    // 🔥 FIX 1: Safety check for the environment variable
    const pickup_postcode = process.env.STORE_PINCODE
    if (!pickup_postcode) {
      console.error("❌ ERROR: STORE_PINCODE is missing from your .env file!")
    }

    try {
      // 3. Try real Shiprocket call
      const data = await checkServiceability(pickup_postcode || '500001', pincode, 0.5, cod)
      const available_couriers = data?.data?.available_courier_companies || []

      // 4. If wallet is empty or pincode is totally unserviceable
      if (available_couriers.length === 0) {
        return NextResponse.json({
          success: true,
          is_serviceable: false, 
          error: "Sorry, no couriers are currently available for this route."
        })
      }

      // 🔥 FIX 2: Check both 'rate' and 'freight_charge' formats from Shiprocket
      const best_courier = available_couriers[0]
      const actual_cost = best_courier?.rate || best_courier?.freight_charge || 59

      return NextResponse.json({
        success: true,
        is_serviceable: true,
        shipping_cost: Math.round(Number(actual_cost)),
        couriers: available_couriers.length,
        estimated_days: best_courier?.estimated_delivery_days || null,
      })

    } catch (apiErr: any) {
      // 🔥 FIX 3: Print the ACTUAL error from Shiprocket to your terminal
      console.error("❌ Shiprocket API Error:", apiErr?.response?.data || apiErr.message)
      
      return NextResponse.json({
        success: true,
        is_serviceable: true,
        shipping_cost: 59,
        note: "API failure fallback activated"
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