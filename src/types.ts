export type ResolveResponse =
  | {
      resolved: true
      kind: "entity"
      canonical: string
      entity: {
        type: string
        id: string
        langcode: string
      }
      redirect: { to: string; status?: number } | null
      jsonapi_url: string
      data_url: null
      headless: boolean
      drupal_url: string | null
    }
  | {
      resolved: true
      kind: "view"
      canonical: string
      entity: null
      redirect: { to: string; status?: number } | null
      jsonapi_url: null
      data_url: string
      headless: boolean
      drupal_url: string | null
    }
  | {
      resolved: false
      kind: null
      canonical: null
      entity: null
      redirect: { to: string; status?: number } | null
      jsonapi_url: null
      data_url: null
      headless: false
      drupal_url: null
    }

export type RoutesFeedItem =
  | {
      path: string
      kind: "entity"
      jsonapi_url: string
      data_url: null
    }
  | {
      path: string
      kind: "view"
      jsonapi_url: null
      data_url: string
    }

export interface RoutesFeedResponse {
  data: RoutesFeedItem[]
  links?: {
    self?: string
    next?: string | null
  }
  meta?: Record<string, unknown>
}

export interface JsonApiDocument<T = JsonApiResource> {
  data: T | T[]
  included?: JsonApiResource[]
  links?: JsonApiLinks
  meta?: Record<string, unknown>
}

export interface JsonApiResource {
  type: string
  id: string
  attributes?: Record<string, unknown>
  relationships?: Record<string, JsonApiRelationship>
  links?: JsonApiLinks
}

export interface JsonApiRelationship {
  data: { type: string; id: string } | { type: string; id: string }[] | null
  links?: JsonApiLinks
}

export interface JsonApiLinks {
  self?: string | { href: string }
  related?: string | { href: string }
  next?: string | { href: string }
  prev?: string | { href: string }
}

export interface NodeAttributes {
  drupal_internal__nid: number
  title: string
  created: string
  changed: string
  status: boolean
  path?: {
    alias: string | null
    pid: number | null
    langcode: string
  }
  body?: {
    value: string
    format: string
    processed: string
    summary: string
  }
}
