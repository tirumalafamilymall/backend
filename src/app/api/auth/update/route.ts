import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

// PATCH /api/auth/update
// Body: { name }
export async function PATCH(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name } = await req.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data:  { name: name.trim() },
    })

    return NextResponse.json({ success: true, user: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}