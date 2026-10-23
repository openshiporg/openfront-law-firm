import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { s3ForcePathStyle } from '@/features/keystone/lib/s3-storage'

/** Document files live in the deployment's bucket (the same five S3_* settings as E-commerce). */
function settings() {
  const bucket = process.env.S3_BUCKET_NAME
  const region = process.env.S3_REGION
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!bucket || !region || !endpoint || !accessKeyId || !secretAccessKey) return null
  return { bucket, client: new S3Client({ region, endpoint, forcePathStyle: s3ForcePathStyle(endpoint), credentials: { accessKeyId, secretAccessKey } }) }
}

export function documentStorageConfigured() {
  return settings() !== null
}

export async function putDocumentObject(key: string, body: Uint8Array, contentType: string) {
  const storage = settings()
  if (!storage) throw new Error('File storage is not configured.')
  await storage.client.send(new PutObjectCommand({ Bucket: storage.bucket, Key: key, Body: body, ContentType: contentType }))
}

/** Short-lived download link; the bucket itself stays private. */
export async function documentDownloadUrl(key: string, fileName: string) {
  const storage = settings()
  if (!storage) return null
  const safeName = fileName.replace(/[^\w.\- ]+/g, '_')
  return getSignedUrl(storage.client, new GetObjectCommand({ Bucket: storage.bucket, Key: key, ResponseContentDisposition: `attachment; filename="${safeName}"` }), { expiresIn: 300 })
}
