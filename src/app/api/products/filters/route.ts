import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/products/filters
// Returns all unique values for each filterable field
// Frontend uses this to build filter dropdowns dynamically
export async function GET() {
  try {
    const [categories, subcategories, brands, colors, sizes, priceRange] =
      await Promise.all([
        prisma.product.findMany({
          where: { is_active: true },
          select: { category: true },
          distinct: ['category'],
        }),
        prisma.product.findMany({
          where: { is_active: true, subcategory: { not: null } },
          select: { subcategory: true },
          distinct: ['subcategory'],
        }),
        prisma.product.findMany({
          where: { is_active: true, brand: { not: null } },
          select: { brand: true },
          distinct: ['brand'],
        }),
        prisma.product.findMany({
          where: { is_active: true, color: { not: null } },
          select: { color: true },
          distinct: ['color'],
        }),
        prisma.product.findMany({
          where: { is_active: true, size: { not: null } },
          select: { size: true },
          distinct: ['size'],
        }),
        prisma.product.aggregate({
          where: { is_active: true },
          _min: { base_price: true },
          _max: { base_price: true },
        }),
      ])

    return NextResponse.json({
      success: true,
      filters: {
        categories:   categories.map((p) => p.category),
        subcategories: subcategories.map((p) => p.subcategory),
        brands:       brands.map((p) => p.brand),
        colors:       colors.map((p) => p.color),
        sizes:        sizes.map((p) => p.size),
        price_range: {
          min: priceRange._min.base_price ?? 0,
          max: priceRange._max.base_price ?? 0,
        },
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch filters' }, { status: 500 })
  }
}