interface OptimizedImageUrlOptions {
  width: number
  quality?: number
}

// Rewrites a Supabase Storage public URL to use its on-the-fly Image
// Transformation endpoint (/render/image/public/... instead of
// /object/public/...), resizing/compressing at the source instead of
// serving full-size originals — measured ~82% smaller on a real product
// photo (143KB -> 26.5KB at width=200/quality=70). Falls back to the
// original URL for non-Supabase-storage sources or a missing url.
export function optimizedImageUrl(
  url: string,
  { width, quality = 70 }: OptimizedImageUrlOptions
): string {
  if (!url.includes('/storage/v1/object/public/')) return url
  const transformed = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
  const separator = transformed.includes('?') ? '&' : '?'
  return `${transformed}${separator}width=${width}&quality=${quality}`
}
