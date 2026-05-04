import { NextResponse } from 'next/server'
import { generatePresignedUrl } from '@/lib/storage'
import { getUserFromRequest } from '@/lib/auth'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILES = 10

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)

    // Batch mode: ?files=[{"name":"a.jpg","type":"image/jpeg"}]
    const filesParam = searchParams.get('files')

    if (filesParam) {
      const files = JSON.parse(filesParam)

      if (!Array.isArray(files) || files.length === 0) {
        return NextResponse.json({ error: 'Invalid files param' }, { status: 400 })
      }

      if (files.length > MAX_FILES) {
        return NextResponse.json(
          { error: `Max ${MAX_FILES} files per request` },
          { status: 400 }
        )
      }

      const results = await Promise.all(
        files.map(async (f: { name: string; type: string }) => {
          if (!ALLOWED_TYPES.includes(f.type)) {
            return { error: `Invalid type: ${f.type}` }
          }
          return generatePresignedUrl(f.name, f.type)
        })
      )

      return NextResponse.json({ success: true, results })
    }

    // Single file mode: ?filename=x.jpg&type=image/jpeg
    const filename = searchParams.get('filename')
    const type = searchParams.get('type')

    if (!filename || !type) {
      return NextResponse.json(
        { error: 'filename and type are required' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: jpeg, png, webp, gif' },
        { status: 400 }
      )
    }

    const result = await generatePresignedUrl(filename, type)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to generate presigned URL' },
      { status: 500 }
    )
  }
}