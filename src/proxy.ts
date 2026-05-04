import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET)

export async function proxy(req: NextRequest){
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.split('Bearer ')[1]
  try {
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}

export const config = {
  matcher: '/api/admin/:path*',
}

