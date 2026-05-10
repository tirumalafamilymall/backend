import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/categories
// Public route to fetch all active categories for the frontend shop menus
export async function GET() {
  try {
    const uniqueCats = await prisma.product.findMany({
      where: { 
        is_active: true, 
        is_deleted: false 
      },
      select: { category: true },
      distinct: ['category'],
    })
    
    // Extract just the string names and remove any nulls/blanks
    const categories = uniqueCats
      .map(c => c.category)
      .filter(Boolean)

    return NextResponse.json(categories)
  } catch (error) {
    console.error("Failed to fetch public categories:", error)
    return NextResponse.json([], { status: 500 })
  }
}