import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DEFAULT DATA (In case the admin hasn't saved anything yet)
const DEFAULT_STOREFRONT = {
  heroSlider: [
    { img: 'https://via.placeholder.com/1400x700?text=Hero+1', href: '/collections/women' }
  ],
  shopByCategory: Array(6).fill({ name: 'Category', href: '/collections/women', img: 'https://via.placeholder.com/400x500' }),
  discoverStyle: { women: '', men: '', kids: '' },
  flashSale: { img: 'https://via.placeholder.com/1400x300?text=Flash+Sale' },
  newSeason: Array(5).fill({ title: 'Trending', desc: 'Description', href: '/collections/women', img: 'https://via.placeholder.com/500x500', big: false })
}

export async function GET() {
  try {
    const storefront = await prisma.storefront.findUnique({
      where: { id: 'home_page' }
    })

    if (!storefront) {
      return NextResponse.json({ success: true, content: DEFAULT_STOREFRONT })
    }

    return NextResponse.json({ success: true, content: storefront.content })
  } catch (error) {
    console.error('Fetch Storefront Error:', error)
    return NextResponse.json({ error: 'Failed to fetch storefront data' }, { status: 500 })
  }
}