import { NextResponse } from 'next/server'
import { generateLabel, generateManifest } from '@/lib/shiprocket'
import { getAdminFromRequest } from '@/lib/auth'

async function handlePOST(req: Request) {
  try {
    const admin = await getAdminFromRequest(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { shipment_id } = await req.json()

    if (!shipment_id) {
      return NextResponse.json({ error: 'shipment_id is required' }, { status: 400 })
    }

    // Run both independently — don't let one failure block the other
    const labelResult = await generateLabel(shipment_id).catch(err => {
      console.error('Label generation failed:', err?.response?.data || err?.message)
      return null
    })

    const manifestResult = await generateManifest(shipment_id).catch(err => {
      console.error('Manifest generation failed:', err?.response?.data || err?.message)
      return null
    })

    if (!labelResult && !manifestResult) {
      return NextResponse.json({ error: 'Failed to generate label and manifest' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      label: labelResult,
      manifest: manifestResult,
    })
  } catch (error: any) {
    console.error('Label route error:', error?.response?.data || error?.message || error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate label' },
      { status: 500 }
    )
  }
}

export { handlePOST as POST }