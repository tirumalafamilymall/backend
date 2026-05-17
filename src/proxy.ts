import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID!
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
)

export async function proxy(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.split('Bearer ')[1]

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer:   `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    })

    // 🔥 STRICT EDGE ROLE CHECK
    if ((payload as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-firebase-uid', payload.sub as string)

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }
}

export const config = {
  matcher: '/api/admin/:path*',
}