import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateCart } from '@/lib/cart'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Note: Ensure your lib/cart.ts helper includes: items: { include: { variant: { include: { product: true } } } }
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

    // CHANGED: Expecting variant_id from the frontend
    const { variant_id, quantity = 1 } = await req.json()

    if (!variant_id) {
      return NextResponse.json({ error: 'variant_id is required' }, { status: 400 })
    }

    if (quantity < 1) {
      return NextResponse.json({ error: 'Quantity must be at least 1' }, { status: 400 })
    }

    // CHANGED: Look up the Variant, not the Parent
    const variant = await prisma.productVariant.findUnique({ 
      where: { id: variant_id },
      include: { product: true } 
    })
    
    if (!variant) {
      return NextResponse.json({ error: 'Product variant not found' }, { status: 404 })
    }

    // Stock check against the specific variant
    if (variant.stock < quantity) {
      return NextResponse.json({ error: 'Insufficient stock for this size/color' }, { status: 400 })
    }

    const cart = await getOrCreateCart(user.id)

    // CHANGED: Check if this specific variant is already in the cart
    const existingItem = await prisma.cartItem.findFirst({
      where: { cart_id: cart.id, variant_id },
    })

    if (existingItem) {
      const newQty = existingItem.quantity + quantity

      if (variant.stock < newQty) {
        return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
      }

      const updated = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
        include: { variant: { include: { product: true } } },
      })
      return NextResponse.json({ success: true, item: updated })
    }

    // CHANGED: Create the cart item linked to the variant
    const item = await prisma.cartItem.create({
      data: { cart_id: cart.id, variant_id, quantity },
      include: { variant: { include: { product: true } } },
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