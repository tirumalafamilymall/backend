import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminAuth } from '@/lib/firebase-admin'

export async function PATCH(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const params = await _context.params
  try {
    const { role } = await req.json()

    if (role !== 'ADMIN' && role !== 'USER') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { role },
    })

    // 🔥 CLAUDE'S FIX: Sync the Custom Claim instantly
    if (role === 'ADMIN') {
      await adminAuth.setCustomUserClaims(updatedUser.firebase_uid, { role: 'ADMIN' })
    } else {
      // Strip the claim if demoted
      await adminAuth.setCustomUserClaims(updatedUser.firebase_uid, { role: null })
    }

    return NextResponse.json({ success: true, user: updatedUser })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }
}