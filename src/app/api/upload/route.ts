import { NextResponse } from 'next/server'
import { uploadToSpaces } from '@/lib/storage'
import { v4 as uuidv4 } from 'uuid'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
    
if (!allowedTypes.includes(file.type)) {
  return NextResponse.json(
    { error: 'Invalid file type' },
    { status: 400 }
  )
}

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = `products/${uuidv4()}-${file.name}`

    const url = await uploadToSpaces(buffer, fileName)

    return NextResponse.json({ url })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}