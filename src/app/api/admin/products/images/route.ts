import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePresignedUrl } from '@/lib/storage'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // ── ACTION 1: Generate URLs (INIT) ──────────────────────────
    if (body.action === 'INIT') {
      const { images } = body 
      const matched = []
      const unmatched = []

      for (const img of images) {
        // 1. Split filename by _ or - (e.g. "TF2_GREEN" -> ["TF2", "GREEN"])
        // We use the raw productCode field which usually contains the filename from the ZIP
        const parts = img.productCode.toUpperCase().split(/[_-]/)
        const codePart = parts[0]?.trim()
        const colorPart = parts[1]?.trim()

        // 2. Fetch the product using the first part of the name
        const product = await prisma.product.findUnique({
          where: { product_code: codePart },
          include: { variants: true }
        })

        if (!product) {
          unmatched.push({ product_code: img.productCode, status: 'unmatched', reason: 'No product code matches' })
          continue
        }

        // 3. Determine if this image is for a specific color (Variant) or the general product (Parent)
        let targetType = 'PARENT'
        let targetId = product.id
        
        if (colorPart) {
          // Check if any variant's color contains our keyword (e.g. "GREEN" in "PRERO - GREEN")
          const variantMatch = product.variants.find(v => 
            v.color && v.color.toUpperCase().includes(colorPart)
          )
          
          if (variantMatch) {
            targetType = 'VARIANT'
            targetId = variantMatch.id
          }
        }

        // 4. Generate the Cloud URL
        const { uploadUrl, publicUrl } = await generatePresignedUrl(img.fileName, img.mimeType)
        
        matched.push({
          productCode: img.productCode,
          targetType, // 🔥 Stores whether it's for Product or Variant
          targetId,   // 🔥 Stores the specific ID to update later
          fileName: img.fileName,
          uploadUrl,
          publicUrl
        })
      }

      return NextResponse.json({ success: true, matched, unmatched })
    }

    // ── ACTION 2: Save to Database (COMMIT) ─────────────────────
    if (body.action === 'COMMIT') {
      const { updates } = body 
      let successCount = 0
      const failed = []

      for (const update of updates) {
        try {
          if (update.targetType === 'VARIANT') {
            // 🔥 Save to the specific Color variant's image field
            await prisma.productVariant.update({
              where: { id: update.targetId },
              data: { image: update.publicUrl }
            })
          } else {
            // 👗 Add to the general product's image gallery
            await prisma.product.update({
              where: { id: update.targetId },
              data: { images: { push: update.publicUrl } }
            })
          }
          successCount++
        } catch (err: any) {
          failed.push({ targetId: update.targetId, reason: err.message })
        }
      }

      return NextResponse.json({ success: true, saved: successCount, failed })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Process failed: ' + (error.message || 'Unknown error') }, { status: 500 })
  }
}