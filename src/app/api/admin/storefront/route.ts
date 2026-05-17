import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminFromRequest } from '@/lib/auth'

export async function POST(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { content } = body

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Upsert means it will create the row if it doesn't exist, or update it if it does!
    const storefront = await prisma.storefront.upsert({
      where: { id: 'home_page' },
      update: { content },
      create: { id: 'home_page', content }
    })

    return NextResponse.json({ success: true, storefront })
  } catch (error) {
    console.error('Update Storefront Error:', error)
    return NextResponse.json({ error: 'Failed to update storefront data' }, { status: 500 })
  }
}