import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/auth/me
// Returns current logged in user's DB record
export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}