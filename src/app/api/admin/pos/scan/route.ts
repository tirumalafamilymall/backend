import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminFromRequest } from '@/lib/auth'

export async function POST(req: Request) {
  // 1. Security Check
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { barcode } = body

    if (!barcode || barcode.trim() === '') {
      return NextResponse.json({ error: 'No barcode provided' }, { status: 400 })
    }

    const cleanBarcode = barcode.trim()

    // 2. Find the exact physical item
    const variant = await prisma.productVariant.findFirst({
      where: {
        OR: [
          { barcode: cleanBarcode },
          { sku: cleanBarcode } // Fallback just in case
        ]
      },
      include: {
        product: true // Bring the parent data (Name, Department) for the receipt log
      }
    })

    if (!variant) {
      return NextResponse.json({ 
        error: `Barcode ${cleanBarcode} not found in database.`,
        code: 'NOT_FOUND'
      }, { status: 404 })
    }

    // 3. The Negative Stock Safety Net
    // We allow the scan to proceed so the checkout line doesn't stop, 
    // but we flag it so the manager knows they have an inventory mismatch.
    const isNegativeStock = variant.stock <= 0

    // 4. Deduct the stock
    const updatedVariant = await prisma.productVariant.update({
      where: { id: variant.id },
      data: { stock: { decrement: 1 } }
    })

    // 5. Return the payload to the frontend
    return NextResponse.json({
      success: true,
      message: 'Stock updated',
      item: {
        name: variant.product.name,
        price: variant.base_price,
        color: variant.color,
        size: variant.size,
        new_stock: updatedVariant.stock,
        warning: isNegativeStock ? 'Stock dropped below zero!' : null
      }
    })

  } catch (error) {
    console.error('POS Scan Error:', error)
    return NextResponse.json({ error: 'System error during scan' }, { status: 500 })
  }
}