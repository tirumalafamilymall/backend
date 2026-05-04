import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminAuth } from '@/lib/firebase-admin'

// POST /api/auth/register
// Called immediately after Firebase signup on frontend
// Body: { firebase_token }
// Creates the User row in our DB linked to Firebase UID
export async function POST(req: Request) {
  try {
    const { firebase_token } = await req.json()

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

    // Create new user
    const user = await prisma.user.create({
      data: {
        firebase_uid: decoded.uid,
        email:        decoded.email        || null,
        name:         decoded.name         || null,
      },
    })

    return NextResponse.json({ success: true, user }, { status: 201 })
  } catch (error: any) {
    // Firebase token invalid or expired
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