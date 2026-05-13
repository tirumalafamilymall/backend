import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Department } from '@prisma/client'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const departmentStr = searchParams.get('department')
    const department = departmentStr ? (departmentStr.toUpperCase() as Department) : undefined

    const baseWhere = {
      is_active: true,
      is_deleted: false,
      sales_channel: 'MAIN_STORE' as const,
      ...(department && { department })
    }

    const [categories, subcategories, brands, colors, sizes, priceRange] =
      await Promise.all([
        prisma.product.findMany({ where: baseWhere, select: { category: true }, distinct: ['category'] }),
        prisma.product.findMany({ where: { ...baseWhere, subcategory: { not: null } }, select: { subcategory: true }, distinct: ['subcategory'] }),
        prisma.product.findMany({ where: { ...baseWhere, brand: { not: null } }, select: { brand: true }, distinct: ['brand'] }),
        
        // Size and Color now live in the Variant table
        prisma.productVariant.findMany({
          where: { product: baseWhere, color: { not: null } },
          select: { color: true },
          distinct: ['color'],
        }),
        prisma.productVariant.findMany({
          where: { product: baseWhere, size: { not: null } },
          select: { size: true },
          distinct: ['size'],
        }),
        prisma.productVariant.aggregate({
          where: { product: baseWhere },
          _min: { base_price: true },
          _max: { base_price: true },
        }),
      ])

    return NextResponse.json({
      success: true,
      filters: {
        categories:    categories.map((p) => p.category),
        subcategories: subcategories.map((p) => p.subcategory),
        brands:        brands.map((p) => p.brand),
        colors:        colors.map((p) => p.color),
        sizes:         sizes.map((p) => p.size),
        price_range: {
          min: Number(priceRange._min.base_price ?? 0),
          max: Number(priceRange._max.base_price ?? 0),
        },
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch filters' }, { status: 500 })
  }
}