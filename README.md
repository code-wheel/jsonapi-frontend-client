# `@codewheel/jsonapi-frontend-client`

TypeScript client helpers for Drupal `drupal/jsonapi_frontend`.

This package is **optional**. You can always call `/jsonapi/resolve` directly with `fetch()`.

## Install

```bash
npm i @codewheel/jsonapi-frontend-client
```

## Usage

Set `DRUPAL_BASE_URL` (must be a full `http(s)://` URL), then:

```ts
import { resolvePath, fetchJsonApi } from "@codewheel/jsonapi-frontend-client"

const resolved = await resolvePath("/about-us")
if (resolved.resolved && resolved.kind === "entity") {
  const doc = await fetchJsonApi(resolved.jsonapi_url)
  console.log(doc.data)
}
```

## Astro / Vite (`import.meta.env`)

```ts
import { resolvePath, fetchJsonApi } from "@codewheel/jsonapi-frontend-client"

const baseUrl = import.meta.env.DRUPAL_BASE_URL

const resolved = await resolvePath("/about-us", { baseUrl })
if (resolved.resolved && resolved.kind === "entity") {
  const doc = await fetchJsonApi(resolved.jsonapi_url, { baseUrl })
}
```

## Authentication (optional)

Keep credentials server-side. Pass headers via `options.headers`:

```ts
import { resolvePath } from "@codewheel/jsonapi-frontend-client"

const baseUrl = process.env.DRUPAL_BASE_URL!
const auth = "Basic " + Buffer.from(`${process.env.DRUPAL_BASIC_USERNAME}:${process.env.DRUPAL_BASIC_PASSWORD}`).toString("base64")

await resolvePath("/about-us", {
  baseUrl,
  headers: { Authorization: auth },
})
```

```ts
import { resolvePath } from "@codewheel/jsonapi-frontend-client"

await resolvePath("/about-us", {
  headers: { Authorization: `Bearer ${process.env.DRUPAL_JWT_TOKEN}` },
})
```

### Caching note (Next.js / SSR)

If you pass `Authorization` (or `Cookie`) headers, this client defaults to `cache: "no-store"` unless you explicitly set `options.init.cache`.

## Static builds (SSG) routes feed (optional)

If you enable the secret-protected routes feed in Drupal (`/jsonapi/routes`), you can fetch a complete build-time list of headless paths by following `links.next`:

```ts
import { collectRoutes } from "@codewheel/jsonapi-frontend-client"

const baseUrl = process.env.DRUPAL_BASE_URL!
const secret = process.env.ROUTES_FEED_SECRET!

const routes = await collectRoutes({ baseUrl, secret })
const paths = routes.map((r) => r.path)
```

Keep `ROUTES_FEED_SECRET` server-side only (build environment variables). Do not expose it to browsers.

## Query building (optional)

This client doesn’t require a query builder, but `drupal-jsonapi-params` works well:

```ts
import { DrupalJsonApiParams } from "drupal-jsonapi-params"
import { fetchJsonApi } from "@codewheel/jsonapi-frontend-client"

const baseUrl = process.env.DRUPAL_BASE_URL!

const params = new DrupalJsonApiParams()
  .addFilter("status", "1")
  .addFields("node--article", ["title", "path", "body"])

const url = `/jsonapi/node/article?${params.getQueryString()}`
await fetchJsonApi(url, { baseUrl })
```

## URL safety (recommended)

By default, `fetchJsonApi()` and `fetchView()` refuse to fetch absolute URLs on a different origin than your `DRUPAL_BASE_URL` (to avoid accidental SSRF in server environments).

If you intentionally need to fetch a cross-origin absolute URL, pass `allowExternalUrls: true`:

```ts
import { fetchJsonApi } from "@codewheel/jsonapi-frontend-client"

await fetchJsonApi("https://cms.example.com/jsonapi/node/page/...", {
  allowExternalUrls: true,
})
```
