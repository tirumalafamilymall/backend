import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

async function getOrCreateWishlist(userId: string) {
  let wishlist = await prisma.wishlist.findUnique({
    where: { user_id: userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id:           true,
              name:         true,
              images:       true,
              category:     true,
              is_active:    true,
              product_code: true,
              variants:     true, // CHANGED: Must include variants to get price/stock
            },
          },
        },
        orderBy: { created_at: 'desc' },
      },
    },
  })

  if (!wishlist) {
    wishlist = await prisma.wishlist.create({
      data: { user_id: userId },
      include: {
        items: {
          include: { product: { include: { variants: true } } },
        },
      },
    })
  }

  return wishlist
}

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const wishlist = await getOrCreateWishlist(user.id)
    return NextResponse.json({ success: true, wishlist })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { product_id } = await req.json()
    if (!product_id) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

    const product = await prisma.product.findUnique({ where: { id: product_id } })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const wishlist = await getOrCreateWishlist(user.id)

    const item = await prisma.wishlistItem.create({
      data: { wishlist_id: wishlist.id, product_id },
      include: { product: { include: { variants: true } } },
    })

    return NextResponse.json({ success: true, item }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Product already in wishlist' }, { status: 409 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to add to wishlist' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { product_id } = await req.json()
    if (!product_id) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

    const wishlist = await prisma.wishlist.findUnique({
      where: { user_id: user.id },
    })

    if (!wishlist) return NextResponse.json({ error: 'Wishlist not found' }, { status: 404 })

    await prisma.wishlistItem.deleteMany({
      where: { wishlist_id: wishlist.id, product_id },
    })

    return NextResponse.json({ success: true, message: 'Removed from wishlist' })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to remove from wishlist' }, { status: 500 })
  }
}