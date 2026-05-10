import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'


export async function POST(req: Request) {
  try {
    const { token } = await req.json()
    const decoded = await adminAuth.verifyIdToken(token)

    // Check DB by UID
    let user = await prisma.user.findUnique({
      where: { firebase_uid: decoded.uid },
    })

    // Fallback: Check by email if UID search failed (sometimes helpful during migrations)
    if (!user && decoded.email) {
      user = await prisma.user.findFirst({
        where: { email: decoded.email },
      })
    }

    if (!user || user.role !== 'ADMIN') {
      console.log(`Access denied for: ${decoded.email}. Role is: ${user?.role}`);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}