import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

// PATCH /api/cart/:itemId — update quantity
export async function PATCH(
  req: Request,
  { params }: { params: { itemId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { quantity } = await req.json()

    if (!quantity || quantity < 1) {
      return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 })
    }

    // Verify item belongs to this user's cart
    const cart = await prisma.cart.findUnique({ where: { user_id: user.id } })
    if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 })

    const item = await prisma.cartItem.findFirst({
      where: { id: params.itemId, cart_id: cart.id },
    })
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const updated = await prisma.cartItem.update({
      where: { id: params.itemId },
      data: { quantity },
      include: { product: true},
    })

    return NextResponse.json({ success: true, item: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

// DELETE /api/cart/:itemId — remove single item
export async function DELETE(
  req: Request,
  { params }: { params: { itemId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const cart = await prisma.cart.findUnique({ where: { user_id: user.id } })
    if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 })

    const item = await prisma.cartItem.findFirst({
      where: { id: params.itemId, cart_id: cart.id },
    })
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    await prisma.cartItem.delete({ where: { id: params.itemId } })

    return NextResponse.json({ success: true, message: 'Item removed' })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 })
  }
}