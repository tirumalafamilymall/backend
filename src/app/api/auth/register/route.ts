import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminAuth } from '@/lib/firebase-admin'

export async function POST(req: Request) {
  try {
    // 1. Extract BOTH the token and the name from the request
    const { firebase_token, name } = await req.json()

    if (!firebase_token) {
      return NextResponse.json(
        { error: 'firebase_token is required' },
        { status: 400 }
      )
    }

    // Verify token and extract user info from Firebase
    const decoded = await adminAuth.verifyIdToken(firebase_token)

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { firebase_uid: decoded.uid },
    })

    if (existing) {
      return NextResponse.json({ success: true, user: existing })
    }

    // 2. Create new user, prioritizing the explicitly passed name!
    const user = await prisma.user.create({
      data: {
        firebase_uid: decoded.uid,
        email:        decoded.email || null,
        name:         name || decoded.name || null, // <-- Prioritizes the explicit name
      },
    })

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