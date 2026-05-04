import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCart } from '@/lib/cart'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const cart = await getOrCreateCart(user.id)
    return NextResponse.json({ success: true, cart })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { product_id, quantity = 1 } = await req.json()

    if (!product_id) {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
    }

    if (quantity < 1) {
      return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 })
    }

    const product = await prisma.product.findUnique({ where: { id: product_id } })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Stock check
    if (product.stock < quantity) {
      return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
    }

    const cart = await getOrCreateCart(user.id)

    const existingItem = await prisma.cartItem.findFirst({
      where: { cart_id: cart.id, product_id },
    })

    if (existingItem) {
      const newQty = existingItem.quantity + quantity

      if (product.stock < newQty) {
        return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
      }

      const updated = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
        include: { product: true },
      })
      return NextResponse.json({ success: true, item: updated })
    }

    const item = await prisma.cartItem.create({
      data: { cart_id: cart.id, product_id, quantity },
      include: { product: true },
    })

    return NextResponse.json({ success: true, item }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const cart = await prisma.cart.findUnique({ where: { user_id: user.id } })
    if (!cart) return NextResponse.json({ success: true })

    await prisma.cartItem.deleteMany({ where: { cart_id: cart.id } })

    return NextResponse.json({ success: true, message: 'Cart cleared' })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to clear cart' }, { status: 500 })
  }
}