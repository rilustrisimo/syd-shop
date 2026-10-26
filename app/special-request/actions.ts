'use server'

import { createServerClient } from '@/lib/supabase/server'

const BUCKET = 'special-request-photos'
const MAX_BYTES = 5 * 1024 * 1024
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export interface UploadResult {
  path?: string
  error?: string
}

/**
 * Uploads one sample photo for a special request to the private bucket
 * under pending/ (the order doesn't exist yet). The photo is already
 * resized in the browser; type and size are checked again here. Returns
 * the storage path, which the cart keeps and checkout re-validates.
 */
export async function uploadSpecialRequestPhoto(formData: FormData): Promise<UploadResult> {
  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) return { error: 'No photo received.' }
  const ext = TYPES[file.type]
  if (!ext) return { error: 'Please upload a JPG, PNG or WebP photo.' }
  if (file.size > MAX_BYTES) return { error: 'That photo is too large (max 5 MB).' }

  const path = `pending/${crypto.randomUUID()}.${ext}`
  const supabase = createServerClient()
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) {
    console.error('Special request photo upload error:', error.message)
    return { error: 'Could not upload the photo. Please try again.' }
  }
  return { path }
}
