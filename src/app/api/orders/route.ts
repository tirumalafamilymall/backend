import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { generateOrderNumber } from '@/lib/order'
import { checkServiceability } from '@/lib/shiprocket' 

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

    // 🔥 REMOVED shipping_amount from the request body
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
      include: { items: { include: { variant: { include: { product: true } } } } },
    })

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    let cart_subtotal = 0;

    for (const item of cart.items) {
      if (item.variant.stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for: ${item.variant.product.name} (${item.variant.size || 'Base'})`, variant_id: item.variant_id },
          { status: 400 }
        )
      }
      cart_subtotal += Number(item.variant.base_price) * item.quantity;
    }

    // 🔥 NEW: Server-Side Shipping Calculation
    let server_shipping_amount = 0;
    try {
      const pickup_postcode = process.env.STORE_PINCODE || '532201'; // Fallback to Tekkali pin if env missing
      const shipData = await checkServiceability(pickup_postcode, pincode, 0.5, false); // COD is strictly false
      
      if (shipData?.data?.available_courier_companies?.length > 0) {
        server_shipping_amount = Number(shipData.data.available_courier_companies[0].freight_charge);
      } else {
        server_shipping_amount = 59; // Fallback to mock rate
      }
    } catch (error) {
      console.warn("Shipping calc failed, using fallback:", error);
      server_shipping_amount = 59;
    }

    const total_amount = cart_subtotal + server_shipping_amount

    const order = await prisma.order.create({
      data: {
        order_number:    generateOrderNumber(),
        user_id:         user.id,
        total_amount,    
        shipping_amount: server_shipping_amount, // 🔥 Uses server calculated value
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