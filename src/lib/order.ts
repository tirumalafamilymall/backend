import { prisma } from '@/lib/prisma'

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString().slice(-8)
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `TFM-${timestamp}-${random}`
}

export async function calculateCartTotal(cartId: string): Promise<number> {
  const items = await prisma.cartItem.findMany({
    where: { cart_id: cartId },
    include: { variant: true }, // CHANGED: Include variant to get price
  })

  return items.reduce((total, item) => {
    // CHANGED: Use variant price and cast Decimal to Number
    const itemPrice = item.variant ? Number(item.variant.base_price) : 0
    return total + (itemPrice * item.quantity)
  }, 0)
}