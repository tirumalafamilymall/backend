import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function handlePATCH(
  req: Request,
  _context: { params: Promise<{ id: string }> }
) {
  const params = await _context.params
  try {
    const { role } = await req.json()

    if (!['ADMIN', 'USER'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data:  { role },
    })

    return NextResponse.json({ success: true, user: updated })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }
}

export { handlePATCH as PATCH }