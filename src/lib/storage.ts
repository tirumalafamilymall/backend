// src/lib/storage.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

const s3 = new S3Client({
  region: process.env.DO_SPACES_REGION,
  endpoint: `https://${process.env.DO_SPACES_REGION}.digitaloceanspaces.com`,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
})

// Existing backend upload (keep for dev/testing)
export async function uploadToSpaces(file: Buffer, fileName: string) {
  const command = new PutObjectCommand({
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: fileName,
    Body: file,
    ACL: 'public-read',
  })

  await s3.send(command)

  return `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_REGION}.digitaloceanspaces.com/${fileName}`
}

// New: generate presigned URL for direct frontend upload
export async function generatePresignedUrl(
  originalFileName: string,
  contentType: string
) {
  const ext = originalFileName.split('.').pop() || 'jpg'
  const key = `products/${uuidv4()}.${ext}`

  const command = new PutObjectCommand({
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: key,
    ContentType: contentType,
    ACL: 'public-read',
  })

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }) // 5 min expiry

  const publicUrl = `https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_REGION}.digitaloceanspaces.com/${key}`

  return { uploadUrl, publicUrl, key }
}