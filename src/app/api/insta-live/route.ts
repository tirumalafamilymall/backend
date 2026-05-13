import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const with_products = searchParams.get('with_products') === 'true'

    const rawPosts = await prisma.instaLive.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'desc' },
      include: {
        products: {
          include: {
            product: {
              include: { variants: true } // Fetch variants for price/stock
            }
          }
        }
      }
    })

    // Process posts to include aggregated product data
    const posts = rawPosts.map(post => ({
      ...post,
      products: post.products.map(link => {
        const p = link.product
        const prices = p.variants.map(v => Number(v.base_price))
        const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0)
        
        return {
          ...link,
          product: {
            id: p.id,
            slug: p.slug,
            name: p.name,
            images: p.images,
            category: p.category,
            base_price: prices.length > 0 ? Math.min(...prices) : 0,
            stock: totalStock,
            is_active: p.is_active
          }
        }
      })
    }))

    if (with_products) {
      const productMap = new Map()
      for (const post of posts) {
        for (const link of post.products) {
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