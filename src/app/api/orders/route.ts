import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { generateOrderNumber, calculateCartTotal } from '@/lib/order'
import { sendOrderConfirmationMail } from '@/lib/mailer'

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

    const { shipping_address, notes } = await req.json()

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

    const cart = await prisma.cart.findUnique({
      where: { user_id: user.id },
      include: { items: { include: { product: true } } },
    })

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for: ${item.product.name}`, product_id: item.product_id },
          { status: 400 }
        )
      }
    }

    const total_amount = await calculateCartTotal(cart.id)

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          order_number:    generateOrderNumber(),
          user_id:         user.id,
          total_amount,
          shipping_address,
          notes:           notes || null,
          status:          'PENDING',
          payment_status:  'UNPAID',
          items: {
            create: cart.items.map((item) => ({
              product_id:   item.product_id,
              product_code: item.product.product_code,
              name:         item.product.name,
              category:     item.product.category,
              brand:        item.product.brand || null,
              color:        item.product.color || null,
              size:         item.product.size  || null,
              price:        item.product.base_price,
              quantity:     item.quantity,
              image:        item.product.images?.[0] || null,
            })),
          },
        },
        include: { items: true },
      })

      await Promise.all(
        cart.items.map((item) =>
          tx.product.update({
            where: { id: item.product_id },
            data:  { stock: { decrement: item.quantity } },
          })
        )
      )

      await tx.cartItem.deleteMany({ where: { cart_id: cart.id } })

      return newOrder
    })

    if (user.email) {
      sendOrderConfirmationMail({
        customerEmail:   user.email,
        customerName:    user.name || 'Customer',
        orderNumber:     order.order_number,
        items:           order.items,
        totalAmount:     order.total_amount,
        shippingAddress: shipping_address,
      }).catch(console.error)
    }

    return NextResponse.json({ success: true, order }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}