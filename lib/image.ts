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
//
// resize=contain is required: passing width alone (no resize mode) does
// NOT preserve aspect ratio on Supabase's transform endpoint — it keeps
// the ORIGINAL height and only scales width, silently stretching/
// distorting every image whose requested width differs from its source
// width (verified: a 1000x1000 source came back 500x1000 at width=500
// without this param, and correctly 500x500 with it).
export function optimizedImageUrl(
  url: string,
  { width, quality = 70 }: OptimizedImageUrlOptions
): string {
  if (!url.includes('/storage/v1/object/public/')) return url
  const transformed = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
  const separator = transformed.includes('?') ? '&' : '?'
  return `${transformed}${separator}width=${width}&quality=${quality}&resize=contain`
}
