import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH /api/admin/insta-live/:id — update post
// Body: { title?, instagram_url?, thumbnail?, is_active?, product_ids? }
export async function PATCH(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const params = await _context.params
  try {
    const { title, instagram_url, thumbnail, is_active, product_ids } = await req.json()

    const post = await prisma.instaLive.findUnique({ where: { id: params.id } })
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    // If product_ids provided, replace all linked products
    if (product_ids !== undefined) {
      await prisma.instaLiveProduct.deleteMany({
        where: { insta_live_id: params.id },
      })

      if (product_ids.length > 0) {
        await prisma.instaLiveProduct.createMany({
          data: product_ids.map((product_id: string) => ({
            insta_live_id: params.id,
            product_id,
          })),
        })
      }
    }

    const updated = await prisma.instaLive.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(instagram_url && { instagram_url }),
        ...(thumbnail && { thumbnail }),
        ...(is_active !== undefined && { is_active }),
      },
      include: {
        products: {
          include: { product: true },
        },
      },
    })

    return NextResponse.json({ success: true, post: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}

// DELETE /api/admin/insta-live/:id — delete post
export async function DELETE(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const params = await _context.params
  try {
    const post = await prisma.instaLive.findUnique({ where: { id: params.id } })
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    // InstaLiveProduct rows cascade delete automatically (onDelete: Cascade)
    await prisma.instaLive.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true, message: 'Post deleted' })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}