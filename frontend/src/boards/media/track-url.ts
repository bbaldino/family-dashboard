export function encodeUriParam(uri: string): string {
  return encodeURIComponent(uri)
}

export function decodeUriParam(param: string): string {
  return decodeURIComponent(param)
}
