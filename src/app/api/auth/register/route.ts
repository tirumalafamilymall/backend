import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminAuth } from '@/lib/firebase-admin'

export async function POST(req: Request) {
  try {
    // 🔥 UPDATED: Added guest_cart to extraction array
    const { firebase_token, name, guest_cart } = await req.json()

    if (!firebase_token) {
      return NextResponse.json(
        { error: 'firebase_token is required' },
        { status: 400 }
      )
    }

    // Verify token and extract user info from Firebase
    const decoded = await adminAuth.verifyIdToken(firebase_token)

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { firebase_uid: decoded.uid },
    })

    if (!user) {
      // Create new user, prioritizing the explicitly passed name
      user = await prisma.user.create({
        data: {
          firebase_uid: decoded.uid,
          email:        decoded.email || null,
          name:         name || decoded.name || null,
        },
      })
    }

    // 🔥 NEW: Migrate Guest Cart items to DB if any exist
    if (Array.isArray(guest_cart) && guest_cart.length > 0) {
      // 1. Get or create the user's persistent database cart
      let cart = await prisma.cart.findUnique({
        where: { user_id: user.id }
      })

      if (!cart) {
        cart = await prisma.cart.create({
          data: { user_id: user.id }
        })
      }

      // 2. Loop through and create or append items to the database cart
      await Promise.all(
        guest_cart.map(async (item: any) => {
          if (!item.variantId) return

          // Upsert ensuring we increment quantity if the variant is already in the database
          return prisma.cartItem.upsert({
            where: {
              cart_id_variant_id: {
                cart_id: cart!.id,
                variant_id: item.variantId
              }
            },
            update: {
              quantity: { increment: item.qty || 1 }
            },
            create: {
              cart_id: cart!.id,
              variant_id: item.variantId,
              quantity: item.qty || 1
            }
          })
        })
      )
    }

    return NextResponse.json({ success: true, user }, { status: 201 })
  } catch (error: any) {
    if (error.code?.startsWith('auth/')) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    console.error(error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}