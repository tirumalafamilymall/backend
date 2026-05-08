import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // We only check for the presence of the Bearer token here.
  // The actual, secure Firebase token verification happens inside 
  // each individual route via getAdminFromRequest()
  return NextResponse.next()
}

export const config = {
  matcher: '/api/admin/:path*',
}