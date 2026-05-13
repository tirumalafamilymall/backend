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
        // 1. Split filename (e.g. "TF3_HAXA_DUSKY_GREEN" -> ["TF3", "HAXA", ...])
        const parts = img.productCode.toUpperCase().split(/[_-]/)
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
        let targetIds = [product.id] // We use an array to handle multiple sizes
        
        if (colorPart) {
          // 🔥 SMART MATCH: Find ALL variants that contain this color keyword
          // This ensures Size S and Size M both get the same image
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
          targetIds, // 🔥 Plural: stores all variant IDs (S, M, L)
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
            // 🔥 UPDATE ALL MATCHING SIZES AT ONCE
            await prisma.productVariant.updateMany({
              where: { id: { in: update.targetIds } },
              data: { image: update.publicUrl }
            })
          } else {
            // 👗 UPDATE THE PARENT GALLERY
            // Note: Parent updates one by one to use the Prisma 'push' feature
            for (const id of update.targetIds) {
              await prisma.product.update({
                where: { id },
                data: { images: { push: update.publicUrl } }
              })
            }
          }
          successCount++
        } catch (err: any) {
          failed.push({ targetIds: update.targetIds, reason: err.message })
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