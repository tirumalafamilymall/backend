import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminFromRequest } from '@/lib/auth'

// GET /api/admin/insta-live (Loads posts for the admin table)
export async function GET(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const posts = await prisma.instaLive.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        products: {
          include: { product: true }
        }
      }
    })
    return NextResponse.json({ success: true, posts })
  } catch (error) {
    console.error('Fetch InstaLive Error:', error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}

// POST /api/admin/insta-live (Creates a new post)
export async function POST(req: Request) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { title, instagram_url, is_active, thumbnail } = body

    if (!instagram_url) {
      return NextResponse.json({ error: 'Instagram URL is required' }, { status: 400 })
    }

    const post = await prisma.instaLive.create({
      data: {
        title: title || '',
        instagram_url,
        is_active: is_active ?? true,
        thumbnail: thumbnail || '📸',
      }
    })

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error('Create InstaLive Error:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}