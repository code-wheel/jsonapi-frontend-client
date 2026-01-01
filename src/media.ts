import { JsonApiResource, JsonApiRelationship } from "./types.js"
import { getFileUrl } from "./url.js"

export interface DrupalImageData {
  src: string
  alt: string
  width?: number
  height?: number
  title?: string
}

export interface DrupalMediaData {
  type: "image" | "video" | "file" | "remote_video" | "audio" | "unknown"
  name: string
  url: string | null
  image?: DrupalImageData
  mimeType?: string
  embedUrl?: string
  resource: JsonApiResource
}

export function findIncluded(
  included: JsonApiResource[] | undefined,
  type: string,
  id: string
): JsonApiResource | undefined {
  return included?.find((item) => item.type === type && item.id === id)
}

export function findIncludedByRelationship(
  included: JsonApiResource[] | undefined,
  relationship: JsonApiRelationship | undefined
): JsonApiResource | undefined {
  if (!relationship?.data || Array.isArray(relationship.data)) {
    return undefined
  }
  return findIncluded(included, relationship.data.type, relationship.data.id)
}

export function findIncludedByRelationshipMultiple(
  included: JsonApiResource[] | undefined,
  relationship: JsonApiRelationship | undefined
): JsonApiResource[] {
  if (!relationship?.data) {
    return []
  }

  const refs = Array.isArray(relationship.data) ? relationship.data : [relationship.data]

  return refs
    .map((ref) => findIncluded(included, ref.type, ref.id))
    .filter((item): item is JsonApiResource => item !== undefined)
}

export function extractImageFromFile(file: JsonApiResource | undefined): DrupalImageData | null {
  if (!file) {
    return null
  }

  const url = getFileUrl(file)
  if (!url) {
    return null
  }

  const attrs = file.attributes as Record<string, unknown> | undefined

  return {
    src: url,
    alt: (attrs?.filename as string) || "",
    width: attrs?.image_style_uri ? undefined : (attrs?.width as number | undefined),
    height: attrs?.image_style_uri ? undefined : (attrs?.height as number | undefined),
  }
}

function getRelationshipMetaString(relationship: JsonApiRelationship | undefined, key: string): string | undefined {
  const data = relationship?.data
  if (!data || Array.isArray(data)) {
    return undefined
  }

  const meta = (data as { meta?: Record<string, unknown> }).meta
  const value = meta?.[key]

  return typeof value === "string" && value.trim() !== "" ? value : undefined
}

export function extractMedia(
  media: JsonApiResource | undefined,
  included: JsonApiResource[] | undefined
): DrupalMediaData | null {
  if (!media) {
    return null
  }

  const attrs = media.attributes as Record<string, unknown> | undefined
  const relationships = media.relationships as Record<string, JsonApiRelationship> | undefined

  const name = (attrs?.name as string) || ""
  const mediaType = media.type.replace("media--", "")

  const result: DrupalMediaData = {
    type: "unknown",
    name,
    url: null,
    resource: media,
  }

  switch (mediaType) {
    case "image": {
      result.type = "image"

      const fileRelationship = relationships?.field_media_image
      const file = findIncludedByRelationship(included, fileRelationship)

      if (file) {
        const imageData = extractImageFromFile(file)
        if (imageData) {
          result.url = imageData.src
          const alt = getRelationshipMetaString(fileRelationship, "alt")
          const title = getRelationshipMetaString(fileRelationship, "title")

          result.image = {
            ...imageData,
            alt: alt || imageData.alt || name,
            title: title || imageData.title,
          }
        }
      }
      break
    }

    case "video": {
      result.type = "video"

      const fileRelationship = relationships?.field_media_video_file
      const file = findIncludedByRelationship(included, fileRelationship)

      if (file) {
        result.url = getFileUrl(file)
        result.mimeType = (file.attributes?.filemime as string) || "video/mp4"
      }
      break
    }

    case "remote_video": {
      result.type = "remote_video"

      const videoUrl = attrs?.field_media_oembed_video as string | undefined
      result.url = videoUrl || null

      if (videoUrl) {
        result.embedUrl = getVideoEmbedUrl(videoUrl)
      }
      break
    }

    case "file":
    case "document": {
      result.type = "file"

      const fileRelationship = relationships?.field_media_file || relationships?.field_media_document
      const file = findIncludedByRelationship(included, fileRelationship)

      if (file) {
        result.url = getFileUrl(file)
        result.mimeType = file.attributes?.filemime as string | undefined
      }
      break
    }

    case "audio": {
      result.type = "audio"

      const fileRelationship = relationships?.field_media_audio_file
      const file = findIncludedByRelationship(included, fileRelationship)

      if (file) {
        result.url = getFileUrl(file)
        result.mimeType = (file.attributes?.filemime as string) || "audio/mpeg"
      }
      break
    }
  }

  return result
}

export function extractMediaField(
  entity: JsonApiResource,
  fieldName: string,
  included: JsonApiResource[] | undefined
): DrupalMediaData[] {
  const relationships = entity.relationships as Record<string, JsonApiRelationship> | undefined
  const relationship = relationships?.[fieldName]

  if (!relationship) {
    return []
  }

  const mediaResources = findIncludedByRelationshipMultiple(included, relationship)

  return mediaResources
    .map((media) => extractMedia(media, included))
    .filter((item): item is DrupalMediaData => item !== null)
}

export function extractPrimaryImage(entity: JsonApiResource, included: JsonApiResource[] | undefined): DrupalImageData | null {
  const commonFields = ["field_image", "field_media_image", "field_media", "field_thumbnail", "field_hero_image"]

  for (const fieldName of commonFields) {
    const media = extractMediaField(entity, fieldName, included)
    const imageMedia = media.find((m) => m.type === "image")
    if (imageMedia?.image) {
      return imageMedia.image
    }
  }

  return null
}

function getVideoEmbedUrl(url: string): string | undefined {
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`
  }

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  }

  return undefined
}

export function parseDrupalMediaTag(html: string): string | null {
  const attr = "data-entity-uuid="
  const start = html.indexOf(attr)
  if (start === -1) {
    return null
  }

  let index = start + attr.length
  while (index < html.length && /\s/.test(html[index])) {
    index += 1
  }

  const quote = html[index]
  if (quote !== "\"" && quote !== "'") {
    return null
  }

  const end = html.indexOf(quote, index + 1)
  if (end === -1) {
    return null
  }

  const uuid = html.slice(index + 1, end)
  return uuid || null
}

export function extractEmbeddedMediaUuids(html: string): string[] {
  const uuids: string[] = []
  const tagStart = "<drupal-media"
  let index = 0

  while (index < html.length) {
    const start = html.indexOf(tagStart, index)
    if (start === -1) {
      break
    }

    const end = html.indexOf(">", start)
    if (end === -1) {
      break
    }

    const tag = html.slice(start, end + 1)
    const uuid = parseDrupalMediaTag(tag)
    if (uuid) {
      uuids.push(uuid)
    }

    index = end + 1
  }

  return uuids
}
