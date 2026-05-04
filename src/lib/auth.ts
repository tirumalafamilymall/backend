import { adminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'

export async function getUserFromRequest(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null

    const token = authHeader.split('Bearer ')[1]
    const decoded = await adminAuth.verifyIdToken(token)

    const user = await prisma.user.findUnique({
      where: { firebase_uid: decoded.uid },
    })

    return user
  } catch {
    return null
  }
}

export async function getAdminFromRequest(req: Request) {
  const user = await getUserFromRequest(req)

  if (!user) return null
  if (user.role !== 'ADMIN') return null

  return user
}