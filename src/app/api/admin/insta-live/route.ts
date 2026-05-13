import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/admin/insta-live — list all
export async function GET() {
  try {
    const rawPosts = await prisma.instaLive.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        products: {
          include: {
            product: { 
              include: { variants: true } // 🔥 CRITICAL: Must include variants
            },
          },
        },
      },
    })

    // Map through posts to calculate display price and stock from variants
    const posts = rawPosts.map(post => ({
      ...post,
      products: post.products.map(link => {
        const p = link.product
        const prices = p.variants.map(v => Number(v.base_price))
        const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0)
        
        return {
          ...link,
          product: {
            ...p,
            // Flatten data for the Admin UI to read easily
            base_price: prices.length > 0 ? Math.min(...prices) : 0,
            stock: totalStock,
          }
        }
      })
    }))

    return NextResponse.json({ success: true, posts })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}

// POST /api/admin/insta-live — create new post
export async function POST(req: Request) {
  try {
    const { title, instagram_url, thumbnail, product_ids } = await req.json()

    if (!instagram_url || !thumbnail) {
      return NextResponse.json(
        { error: 'instagram_url and thumbnail are required' },
        { status: 400 }
      )
    }

    const post = await prisma.instaLive.create({
      data: {
        title: title || null,
        instagram_url,
        thumbnail,
        products: product_ids?.length
          ? {
              create: product_ids.map((product_id: string) => ({ product_id })),
            }
          : undefined,
      },
      include: {
        products: {
          include: {
            product: { include: { variants: true } }, // 🔥 CRITICAL: Must include variants
          },
        },
      },
    })

    return NextResponse.json({ success: true, post }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}