// Shrinks a photo in the browser before upload: phone photos are often
// 3–8 MB, but a sample photo for a quote only needs to be readable.
// Returns a JPEG of at most `maxSide` px (and a tiny thumbnail data URL
// for showing in the cart, which lives in localStorage).

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo.')) }
    img.src = url
  })
}

function draw(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process that photo.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process that photo.'))), 'image/jpeg', quality)
  })
}

export async function preparePhoto(file: File, maxSide = 1600): Promise<{ upload: File; thumb: string }> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo (JPG, PNG or WebP).')
  const img = await loadImage(file)
  const canvas = draw(img, maxSide)
  // Step quality down until it fits comfortably under the 1 MB target.
  let blob = await toBlob(canvas, 0.82)
  for (const q of [0.7, 0.6, 0.5]) {
    if (blob.size <= 1_000_000) break
    blob = await toBlob(canvas, q)
  }
  const thumb = draw(img, 160).toDataURL('image/jpeg', 0.6)
  return { upload: new File([blob], 'photo.jpg', { type: 'image/jpeg' }), thumb }
}
