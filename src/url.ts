import { getDrupalBaseUrlFromOptions } from "./transport.js"

/**
 * Get the Drupal base URL.
 *
 * Defaults to reading `DRUPAL_BASE_URL` from the environment.
 */
export function getDrupalBaseUrl(options?: { baseUrl?: string; envKey?: string }): string {
  return getDrupalBaseUrlFromOptions(options)
}

/**
 * Resolve a Drupal file URL to an absolute URL.
 */
export function resolveFileUrl(
  url: string | null | undefined,
  options?: { baseUrl?: string; envKey?: string }
): string | null {
  if (!url) {
    return null
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }

  if (url.startsWith("data:")) {
    return url
  }

  if (url.startsWith("//")) {
    return `https:${url}`
  }

  const base = getDrupalBaseUrlFromOptions(options)
  const path = url.startsWith("/") ? url : `/${url}`
  return `${base}${path}`
}

export function getFileUrl(
  file: {
    attributes?: {
      uri?: { url?: string; value?: string }
      url?: string
    }
  } | null | undefined,
  options?: { baseUrl?: string; envKey?: string }
): string | null {
  if (!file?.attributes) {
    return null
  }

  const url = file.attributes.uri?.url || file.attributes.uri?.value || file.attributes.url
  return resolveFileUrl(url, options)
}

/**
 * Build a URL with image style derivative.
 */
export function getImageStyleUrl(originalUrl: string, style: string, options?: { baseUrl?: string; envKey?: string }): string {
  const resolved = resolveFileUrl(originalUrl, options)
  if (!resolved) {
    return originalUrl
  }

  if (resolved.includes("/styles/")) {
    return resolved.replace(/\/styles\/[^/]+\//, `/styles/${style}/`)
  }

  const marker = "/files/"
  const markerIndex = resolved.indexOf(marker)
  if (markerIndex !== -1) {
    const basePath = resolved.slice(0, markerIndex + marker.length)
    const filePath = resolved.slice(markerIndex + marker.length)
    return `${basePath}styles/${style}/public/${filePath}`
  }

  return resolved
}
