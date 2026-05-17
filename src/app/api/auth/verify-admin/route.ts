import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { token } = await req.json()
    const decoded = await adminAuth.verifyIdToken(token)

    let user = await prisma.user.findUnique({
      where: { firebase_uid: decoded.uid },
    })

    if (!user && decoded.email) {
      user = await prisma.user.findFirst({
        where: { email: decoded.email },
      })
    }

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 🔥 BOOTSTRAP: Inject the custom claim if it's missing
    if ((decoded as any).role !== 'ADMIN') {
      await adminAuth.setCustomUserClaims(decoded.uid, { role: 'ADMIN' })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}