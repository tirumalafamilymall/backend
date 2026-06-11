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

// 1. Let the database do the math FIRST
    const updatedVariant = await prisma.productVariant.update({
      where: { id: variant.id },
      data: { stock: { decrement: 1 } },
      include: { product: true } // 🔥 Added this back so the frontend gets the Name!
    })

    // 2. Evaluate the warning based on the NEW exact reality
    let warning = null
    if (updatedVariant.stock < 0) {
      warning = '⚠️ Stock dropped below zero! Inventory mismatch.'
    } else if (updatedVariant.stock === 0) {
      warning = 'Last unit sold. Variant is now out of stock.'
    }

    // 3. Send the response back to the POS scanner tab
    return NextResponse.json({ 
      success: true, 
      variant: updatedVariant,
      warning 
    })
  } catch (error) {
    console.error('POS Scan Error:', error)
    return NextResponse.json({ error: 'System error during scan' }, { status: 500 })
  }
}