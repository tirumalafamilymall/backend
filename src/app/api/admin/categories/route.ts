import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const uniqueCats = await prisma.product.findMany({
      where: { is_deleted: false },
      select: { category: true },
      distinct: ['category'],
    })
    
    // Extract just the string names and remove any nulls
    const categories = uniqueCats.map(c => c.category).filter(Boolean)
    return NextResponse.json(categories)
  } catch (error) {
    return NextResponse.json([], { status: 500 })
  }
}