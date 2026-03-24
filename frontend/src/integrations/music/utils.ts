/** Extract a usable image URL from MA's image field, which can be a string, an object with `path`, or null. */
export function getImageUrl(image: { path: string } | string | null | undefined): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (typeof image === 'object' && 'path' in image) return image.path
  return null
}
