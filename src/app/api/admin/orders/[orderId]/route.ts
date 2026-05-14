import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendShippingMail } from '@/lib/mailer'

export async function GET(
  req: Request,
  _context: { params: Promise<{ orderId: string }> }
) {
  const params = await _context.params
  try {
    const rawOrder = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: {
        user: { select: { name: true, email: true } },
        items: {
          include: {
            variant: {
              select: {
                image:   true,
                size:    true,
                color:   true,
                product: {
                  select: {
                    images: true,
                  }
                }
              }
            }
          }
        },
      },
    })

    if (!rawOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const order = {
      ...rawOrder,
      total_amount:    Number(rawOrder.total_amount),
      shipping_amount: Number(rawOrder.shipping_amount),
      items: rawOrder.items.map(item => ({
        ...item,
        price: Number(item.price),
        // ✅ FIX: Resolve image from variant first, then parent product images
        image: item.variant?.image || item.variant?.product?.images?.[0] || null,
        // ✅ Also pull size/color from variant if not stored on item directly
        size:  item.size  || item.variant?.size  || null,
        color: item.color || item.variant?.color || null,
      }))
    }

    return NextResponse.json({ success: true, order })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  _context: { params: Promise<{ orderId: string }> }
) {
  const params = await _context.params
  try {
    const { status, tracking_url, shiprocket_order_id } = await req.json()

    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const existing = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: { user: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const rawOrder = await prisma.order.update({
      where: { id: params.orderId },
      data: {
        ...(status              && { status }),
        ...(tracking_url        && { tracking_url }),
        ...(shiprocket_order_id && { shiprocket_order_id }),
      },
      include: {
        // ✅ FIX: Same join in PATCH so the returned order also has images
        items: {
          include: {
            variant: {
              select: {
                image:   true,
                size:    true,
                color:   true,
                product: {
                  select: {
                    images: true,
                  }
                }
              }
            }
          }
        },
      },
    })

    const order = {
      ...rawOrder,
      total_amount:    Number(rawOrder.total_amount),
      shipping_amount: Number(rawOrder.shipping_amount),
      items: rawOrder.items.map(item => ({
        ...item,
        price: Number(item.price),
        image: item.variant?.image || item.variant?.product?.images?.[0] || null,
        size:  item.size  || item.variant?.size  || null,
        color: item.color || item.variant?.color || null,
      }))
    }

    if (status === 'SHIPPED' && existing.user?.email) {
      sendShippingMail({
        customerEmail: existing.user.email,
        customerName:  existing.user.name || 'Customer',
        orderNumber:   existing.order_number,
        trackingUrl:   tracking_url || existing.tracking_url || '',
      }).catch(console.error)
    }

    return NextResponse.json({ success: true, order })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}