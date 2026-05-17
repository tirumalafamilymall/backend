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
        const parts = img.productCode.toUpperCase().split('_')
        const codePart = parts[0]?.trim()
        const colorPart = parts[1]?.trim()

        // 2. Direct lookup for the product
        const product = await prisma.product.findUnique({
          where: { product_code: codePart },
          include: { variants: true }
        })

        if (!product) {
          unmatched.push({ product_code: img.productCode, status: 'unmatched', reason: 'No product code matches' })
          continue
        }

        let targetType = 'PARENT'
        let targetIds = [product.id] 
        
        if (colorPart) {
          const matchingVariants = product.variants.filter(v => 
            v.color && v.color.toUpperCase().includes(colorPart)
          )
          
          if (matchingVariants.length > 0) {
            targetType = 'VARIANT'
            targetIds = matchingVariants.map(v => v.id)
          }
        }

        const { uploadUrl, publicUrl } = await generatePresignedUrl(img.fileName, img.mimeType)
        
        matched.push({
          productCode: img.productCode,
          targetType, 
          targetIds, 
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
          // Safety: Use targetIds if plural exists, otherwise fallback to productId
          const ids = update.targetIds || (update.productId ? [update.productId] : [])
          
          if (ids.length === 0) throw new Error("No IDs provided for update")

          if (update.targetType === 'VARIANT') {
            // 🔥 Update all matching variants (S, M, L) at once
            await prisma.productVariant.updateMany({
              where: { id: { in: ids } },
              data: { image: update.publicUrl }
            })
          } else {
            // 👗 Update the parent product gallery
            for (const id of ids) {
              await prisma.product.update({
                where: { id },
                data: { images: { push: update.publicUrl } }
              })
            }
          }
          successCount++
        } catch (err: any) {
          console.error("Commit failed for update:", update, err.message)
          failed.push({ reason: err.message })
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