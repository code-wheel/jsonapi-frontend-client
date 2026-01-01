import { FetchInit, FetchLike, getDrupalBaseUrlFromOptions, getFetch, mergeHeaders } from "./transport.js"
import type { RoutesFeedItem, RoutesFeedResponse } from "./types.js"

function buildRoutesUrl(input: string, base: string): URL {
  const baseUrl = new URL(base)
  const url = new URL(input, baseUrl)

  if (url.origin !== baseUrl.origin) {
    throw new Error(
      `Refusing to fetch a URL from a different origin (${url.origin}) than base (${baseUrl.origin}). ` +
        "This should not happen for /jsonapi/routes pagination."
    )
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol "${url.protocol}" (expected http/https)`)
  }

  return url
}

function normalizeRoutesItem(value: unknown): RoutesFeedItem | null {
  if (!value || typeof value !== "object") return null
  const item = value as Record<string, unknown>

  const path = item.path
  const kind = item.kind
  const jsonapi_url = item.jsonapi_url
  const data_url = item.data_url

  if (typeof path !== "string" || path.trim() === "" || !path.startsWith("/")) return null
  if (kind !== "entity" && kind !== "view") return null

  if (kind === "entity") {
    if (typeof jsonapi_url !== "string" || jsonapi_url.trim() === "") return null
    if (data_url !== null) return null
    return { path, kind, jsonapi_url, data_url: null }
  }

  if (kind === "view") {
    if (typeof data_url !== "string" || data_url.trim() === "") return null
    if (jsonapi_url !== null) return null
    return { path, kind, jsonapi_url: null, data_url }
  }

  return null
}

function getNextLink(links: unknown): string | null {
  if (!links || typeof links !== "object") return null
  const next = (links as Record<string, unknown>).next
  return typeof next === "string" && next.trim() !== "" ? next : null
}

/**
 * Fetch a single page from the build-time routes feed (/jsonapi/routes).
 *
 * This endpoint is typically protected by X-Routes-Secret. Keep secrets
 * server-side only.
 */
export async function fetchRoutesPage(
  options: {
    baseUrl?: string
    envKey?: string
    langcode?: string
    /**
     * Page size (default: 50). This maps to page[limit] for the first request.
     *
     * Subsequent pages follow links.next from the server.
     */
    limit?: number
    /**
     * Provide a pagination URL (usually links.next from a previous response).
     * If provided, it takes precedence over limit/langcode and is fetched as-is.
     */
    url?: string
    /** Routes feed secret (sent as X-Routes-Secret). */
    secret?: string
    fetch?: FetchLike
    headers?: HeadersInit
    init?: FetchInit
  } = {}
): Promise<RoutesFeedResponse> {
  const base = getDrupalBaseUrlFromOptions({ baseUrl: options.baseUrl, envKey: options.envKey })
  const fetcher = getFetch(options.fetch)

  const url = options.url
    ? buildRoutesUrl(options.url, base)
    : (() => {
        const u = buildRoutesUrl("/jsonapi/routes", base)
        u.searchParams.set("_format", "json")
        u.searchParams.set("page[limit]", String(options.limit ?? 50))
        if (options.langcode) {
          u.searchParams.set("langcode", options.langcode)
        }
        return u
      })()

  const headers = mergeHeaders(options.init?.headers, options.headers)
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/vnd.api+json")
  }

  if (options.secret && typeof options.secret === "string" && options.secret.trim() !== "") {
    headers.set("X-Routes-Secret", options.secret.trim())
  }

  const init: FetchInit = {
    ...options.init,
    headers,
  }

  // This endpoint is secret-protected; disable caching by default.
  if (options.init?.cache === undefined) {
    init.cache = "no-store"
    delete init.next
  }

  const res = await fetcher(url.toString(), init)

  if (!res.ok) {
    throw new Error(`Routes feed failed: ${res.status} ${res.statusText}`)
  }

  const doc = (await res.json()) as unknown
  if (!doc || typeof doc !== "object") {
    throw new Error("Routes feed returned invalid JSON")
  }

  const data = (doc as Record<string, unknown>).data
  const rawItems = Array.isArray(data) ? data : []
  const items = rawItems.map(normalizeRoutesItem).filter((v): v is RoutesFeedItem => v !== null)

  const links = (doc as Record<string, unknown>).links
  const meta = (doc as Record<string, unknown>).meta

  return {
    data: items,
    links: {
      self: typeof (links as any)?.self === "string" ? ((links as any).self as string) : undefined,
      next: getNextLink(links),
    },
    meta: (meta && typeof meta === "object" ? (meta as Record<string, unknown>) : undefined) as RoutesFeedResponse["meta"],
  }
}

/**
 * Iterate all routes by following links.next until it is null.
 */
export async function* iterateRoutes(
  options: Omit<Parameters<typeof fetchRoutesPage>[0], "url"> & { maxPages?: number } = {}
): AsyncGenerator<RoutesFeedItem> {
  const maxPages = options.maxPages ?? 10_000
  let pageUrl: string | undefined = undefined

  for (let i = 0; i < maxPages; i++) {
    const page = await fetchRoutesPage({ ...options, url: pageUrl })

    for (const item of page.data) {
      yield item
    }

    const next = page.links?.next
    if (!next) return
    pageUrl = next
  }

  throw new Error(`Routes feed exceeded maxPages=${maxPages}; aborting pagination`)
}

/**
 * Collect all routes into an array (convenience wrapper around iterateRoutes).
 */
export async function collectRoutes(
  options: Parameters<typeof iterateRoutes>[0] = {}
): Promise<RoutesFeedItem[]> {
  const items: RoutesFeedItem[] = []
  for await (const item of iterateRoutes(options)) {
    items.push(item)
  }
  return items
}
