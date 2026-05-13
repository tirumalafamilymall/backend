import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const params = await _context.params
  try {
    const { title, instagram_url, thumbnail, is_active, product_ids } = await req.json()

    const postExists = await prisma.instaLive.findUnique({ where: { id: params.id } })
    if (!postExists) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    if (product_ids !== undefined) {
      await prisma.instaLiveProduct.deleteMany({ where: { insta_live_id: params.id } })
      if (product_ids.length > 0) {
        await prisma.instaLiveProduct.createMany({
          data: product_ids.map((pid: string) => ({ insta_live_id: params.id, product_id: pid })),
        })
      }
    }

    const rawUpdated = await prisma.instaLive.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(instagram_url && { instagram_url }),
        ...(thumbnail && { thumbnail }),
        ...(is_active !== undefined && { is_active }),
      },
      include: {
        products: {
          include: { product: { include: { variants: true } } }, // 🔥 Deep nesting
        },
      },
    })

    // Process the variants for each product in the updated post
    const post = {
      ...rawUpdated,
      products: rawUpdated.products.map(link => {
        const p = link.product
        const prices = p.variants.map(v => Number(v.base_price))
        return {
          ...link,
          product: {
            ...p,
            base_price: prices.length > 0 ? Math.min(...prices) : 0,
            stock: p.variants.reduce((sum, v) => sum + v.stock, 0)
          }
        }
      })
    }

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const params = await _context.params
  try {
    const post = await prisma.instaLive.findUnique({ where: { id: params.id } })
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    await prisma.instaLive.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true, message: 'Post deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}