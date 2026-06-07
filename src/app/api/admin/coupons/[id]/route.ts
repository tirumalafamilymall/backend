import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, _context: { params: Promise<{ id: string }> }) {
  const params = await _context.params
  try {
    const data = await req.json()
    const coupon = await prisma.coupon.update({
      where: { id: params.id },
      data: { is_active: data.is_active }
    })
    return NextResponse.json({ success: true, coupon })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 })
  }
}

export async function DELETE(req: Request, _context: { params: Promise<{ id: string }> }) {
  const params = await _context.params
  try {
    await prisma.coupon.delete({
      where: { id: params.id }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 })
  }
}