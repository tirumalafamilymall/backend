import { NextResponse } from 'next/server'
import { generateLabel, generateManifest } from '@/lib/shiprocket'
import { getAdminFromRequest } from '@/lib/auth'

async function handlePOST(req: Request) {
  try {
    const admin = await getAdminFromRequest(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { shipment_id } = await req.json()

    if (!shipment_id) {
      return NextResponse.json(
        { error: 'shipment_id is required' },
        { status: 400 }
      )
    }

    const [label, manifest] = await Promise.all([
      generateLabel(shipment_id),
      generateManifest(shipment_id),
    ])

    return NextResponse.json({
      success:  true,
      label:    label,    // contains label_url to download PDF
      manifest: manifest, // contains manifest_url
    })
  } catch (error: any) {
    console.error(error?.response?.data || error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate label' },
      { status: 500 }
    )
  }
}

export { handlePOST as POST }