import { NextResponse } from 'next/server'
import { checkServiceability } from '@/lib/shiprocket'

// GET /api/shipping/serviceability?pincode=500001&cod=true
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const pincode = searchParams.get('pincode')
    const cod = false

    if (!pincode || pincode.length !== 6 || isNaN(Number(pincode))) {
      return NextResponse.json({ error: 'Valid 6-digit pincode is required' }, { status: 400 })
    }

    // Your store's pickup pincode — add to .env
    const pickup_postcode = process.env.STORE_PINCODE!

    const data = await checkServiceability(pickup_postcode, pincode, 0.5, cod)

    const available_couriers = data?.data?.available_courier_companies || []
    const is_serviceable     = available_couriers.length > 0
    const cod_available      = available_couriers.some((c: any) => c.cod === 1)

    return NextResponse.json({
      success:          true,
      is_serviceable,
      cod_available,
      couriers:         available_couriers.length,
      estimated_days:   available_couriers[0]?.estimated_delivery_days || null,
    })
  } catch (error: any) {
    console.error(error?.response?.data || error)
    return NextResponse.json(
      { error: 'Failed to check serviceability' },
      { status: 500 }
    )
  }
}