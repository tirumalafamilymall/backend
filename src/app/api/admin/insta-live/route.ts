import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { getAdminFromRequest } from '@/lib/auth' // Add this import

export async function GET(req: Request) {
  // FIX: Verify admin before running prisma code
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const posts = await prisma.instaLive.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        products: {
          include: { product: true },
        },
      },
    })

    return NextResponse.json({ success: true, posts })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}

// POST /api/admin/insta-live — create new post
// Body: { title?, instagram_url, thumbnail, product_ids? }
export async function POST(req: Request) {
  try {
    const { title, instagram_url, thumbnail, product_ids } = await req.json()

    if (!instagram_url || !thumbnail) {
      return NextResponse.json(
        { error: 'instagram_url and thumbnail are required' },
        { status: 400 }
      )
    }

    const post = await prisma.instaLive.create({
      data: {
        title: title || null,
        instagram_url,
        thumbnail,
        products: product_ids?.length
          ? {
              create: product_ids.map((product_id: string) => ({ product_id })),
            }
          : undefined,
      },
      include: {
        products: {
          include: { product: true },
        },
      },
    })

    return NextResponse.json({ success: true, post }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}