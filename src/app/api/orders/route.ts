import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { generateOrderNumber } from '@/lib/order'

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const orders = await prisma.order.findMany({
      where: { user_id: user.id },
      include: { items: true },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({ success: true, orders })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { shipping_address, notes, shipping_amount = 0 } = await req.json()

    if (!shipping_address) {
      return NextResponse.json({ error: 'shipping_address is required' }, { status: 400 })
    }

    const { name, phone, address, city, state, pincode } = shipping_address
    if (!name || !phone || !address || !city || !state || !pincode) {
      return NextResponse.json(
        { error: 'shipping_address must include name, phone, address, city, state, pincode' },
        { status: 400 }
      )
    }

    // CHANGED: Include the variant and its parent product
    const cart = await prisma.cart.findUnique({
      where: { user_id: user.id },
      include: { items: { include: { variant: { include: { product: true } } } } },
    })

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    let cart_subtotal = 0;

    // CHANGED: Verify stock against the physical variant
    for (const item of cart.items) {
      if (item.variant.stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for: ${item.variant.product.name} (${item.variant.size || 'Base'})`, variant_id: item.variant_id },
          { status: 400 }
        )
      }
      // Safely calculate the total using the variant's Decimal base_price
      cart_subtotal += Number(item.variant.base_price) * item.quantity;
    }

    const total_amount = cart_subtotal + Number(shipping_amount)

    // CHANGED: Snapshot the exact variant details into the OrderItem
    const order = await prisma.order.create({
      data: {
        order_number:    generateOrderNumber(),
        user_id:         user.id,
        total_amount,    
        shipping_amount: Number(shipping_amount), 
        shipping_address,
        notes:           notes || null,
        status:          'PENDING',
        payment_status:  'UNPAID',
        items: {
          create: cart.items.map((item) => ({
            product_id:   item.variant.product.id,
            variant_id:   item.variant.id,
            product_code: item.variant.product.product_code,
            name:         item.variant.product.name,
            category:     item.variant.product.category,
            brand:        item.variant.product.brand || null,
            color:        item.variant.color || null,
            size:         item.variant.size  || null,
            price:        Number(item.variant.base_price),
            quantity:     item.quantity,
            image: item.variant.image || item.variant.product.images?.[0] || null,
          })),
        },
      },
      include: { items: true },
    })

    return NextResponse.json({ success: true, order }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}