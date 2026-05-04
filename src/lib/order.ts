import { prisma } from '@/lib/prisma'

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `TFM-${timestamp}-${random}`
}

export async function calculateCartTotal(cartId: string): Promise<number> {
  const items = await prisma.cartItem.findMany({
    where: { cart_id: cartId },
    include: { product: true },
  })

  return items.reduce((total, item) => {
    return total + item.product.base_price * item.quantity
  }, 0)
}