import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePresignedUrl } from '@/lib/storage'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // ── ACTION 1: Generate URLs (INIT) ──────────────────────────
    if (body.action === 'INIT') {
      const { images } = body // { productCode, fileName, mimeType }[]
      
      const productCodes = images.map((img: any) => img.productCode)
      const products = await prisma.product.findMany({
        where: { product_code: { in: productCodes } },
        select: { id: true, product_code: true },
      })

      const productMap = new Map(products.map(p => [p.product_code, p.id]))
      const matched = []
      const unmatched = []

      for (const img of images) {
        const productId = productMap.get(img.productCode)
        if (!productId) {
          unmatched.push({ product_code: img.productCode, status: 'unmatched', reason: 'No product found' })
          continue
        }

        const { uploadUrl, publicUrl } = await generatePresignedUrl(img.fileName, img.mimeType)
        matched.push({
          productCode: img.productCode,
          productId,
          fileName: img.fileName,
          uploadUrl,
          publicUrl
        })
      }

      return NextResponse.json({ success: true, matched, unmatched })
    }

    // ── ACTION 2: Save to Database (COMMIT) ─────────────────────
    if (body.action === 'COMMIT') {
      const { updates } = body // { productId, publicUrl }[]
      
      let successCount = 0
      const failed = []

      // Execute sequentially to avoid connection pooling issues on large batches
      for (const update of updates) {
        try {
          await prisma.product.update({
            where: { id: update.productId },
            data: { images: [update.publicUrl] }
          })
          successCount++
        } catch (err: any) {
          failed.push({ productId: update.productId, reason: err.message })
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