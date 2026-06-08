import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePresignedUrl } from '@/lib/storage'
import { getAdminFromRequest } from '@/lib/auth'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    // 🔥 Updated logic to use your existing helper
    const admin = await getAdminFromRequest(req)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized or Forbidden' }, { status: 401 })
    }

    const body = await req.json()

    // ── ACTION 1: Generate URLs (INIT) ──────────────────────────
    if (body.action === 'INIT') {
      const { images } = body 
      const matched = []
      const unmatched = []

for (const img of images) {
        let codePart = img.productCode.toUpperCase().trim()
        let colorPart = undefined

        // SMART SPLIT: Supports both Underscore (_) and Hyphen (-)
        if (codePart.includes('_')) {
          const parts = codePart.split('_')
          codePart = parts[0].trim()
          colorPart = parts[1]?.trim()
        } else if (codePart.includes('-')) {
          // Find the LAST hyphen to handle codes like TFM-001-RED
          const lastDash = codePart.lastIndexOf('-')
          const potentialCode = codePart.substring(0, lastDash).trim()
          const potentialColor = codePart.substring(lastDash + 1).trim()
          
          // Safety check: Only accept the color if it's purely letters (e.g., RED, BLUE). 
          // This prevents breaking normal product codes like "TFM-001".
          if (/^[A-Z]+$/.test(potentialColor)) {
            codePart = potentialCode
            colorPart = potentialColor
          }
        }

        // 🔥 FIX: Use findFirst with case-insensitive matching!
        const product = await prisma.product.findFirst({
          where: { 
            product_code: {
              equals: codePart,
              mode: 'insensitive' // This ignores TFM42 vs tfm42 differences
            }
          },
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
            // Update all matching variants (S, M, L) at once
            await prisma.productVariant.updateMany({
              where: { id: { in: ids } },
              data: { image: update.publicUrl }
            })
          } else {
            // Update the parent product gallery
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