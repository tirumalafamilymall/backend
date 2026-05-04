import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/insta-live — homepage grid (active posts only, no products)
// GET /api/insta-live?with_products=true — Shop Instagram page (products included)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const with_products = searchParams.get('with_products') === 'true'

    const posts = await prisma.instaLive.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        title: true,
        instagram_url: true,
        thumbnail: true,
        created_at: true,
        ...(with_products && {
          products: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  base_price: true,
                  images: true,
                  category: true,
                  stock: true,
                  is_active: true,
                },
              },
            },
          },
        }),
      },
    })

    // For Shop Instagram page: flatten all unique products across all posts
    if (with_products) {
      const productMap = new Map()
      for (const post of posts) {
        for (const link of (post as any).products || []) {
          if (link.product.is_active) {
            productMap.set(link.product.id, link.product)
          }
        }
      }

      return NextResponse.json({
        success: true,
        posts,
        all_products: Array.from(productMap.values()),
      })
    }

    return NextResponse.json({ success: true, posts })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}