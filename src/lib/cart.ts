import { prisma } from '@/lib/prisma'

export async function getOrCreateCart(userId: string) {
  let cart = await prisma.cart.findUnique({
    where: { user_id: userId },
    include: {
      items: {
        include: {
          variant: { // CHANGED: Must include variant
            include: {
              product: true, // And the product blueprint
            },
          },
        },
      },
    },
  })

  if (!cart) {
    cart = await prisma.cart.create({
      data: { user_id: userId },
      include: {
        items: {
          include: {
            variant: { 
              include: {
                product: true,
              },
            },
          },
        },
      },
    })
  }

  return cart
}