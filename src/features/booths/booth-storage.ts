import { boothsByFloor } from "./booth-data"
import type {
  BoothLayoutDraft,
  BoothLayoutRepository,
  LayoutRevision,
} from "./booth-layout-repository"
import { type Booth, type BoothLayout, floorIds, type RoomSizeModes } from "./model"

const legacyStorageKey = "woowacourse-idea-booths.layout.v3"
const draftStorageKey = "woowacourse-idea-booths.layout-draft.v1"
const publishedStorageKey = "woowacourse-idea-booths.layout-published.v1"
const draftUpdatedAtKey = "woowacourse-idea-booths.layout-draft-updated-at.v1"
const publishedAtKey = "woowacourse-idea-booths.layout-published-at.v1"
const roomSizeModesKey = "woowacourse-idea-booths.room-size-modes.v1"

export function cloneDefaultBoothLayout(): BoothLayout {
  return {
    11: boothsByFloor[11].map((booth) => ({ ...booth })),
    12: boothsByFloor[12].map((booth) => ({ ...booth })),
    13: boothsByFloor[13].map((booth) => ({ ...booth })),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isFloorId(value: unknown): value is Booth["floorId"] {
  return value === 11 || value === 12 || value === 13
}

function getRecordValue(record: Record<string, unknown>, key: string): unknown {
  return record[key]
}

function isBooth(value: unknown): value is Booth {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof getRecordValue(value, "id") === "string" &&
    isFloorId(getRecordValue(value, "floorId")) &&
    typeof getRecordValue(value, "boothNumber") === "string" &&
    typeof getRecordValue(value, "projectId") === "string" &&
    typeof getRecordValue(value, "roomName") === "string" &&
    isFiniteNumber(getRecordValue(value, "x")) &&
    isFiniteNumber(getRecordValue(value, "y")) &&
    isFiniteNumber(getRecordValue(value, "width")) &&
    isFiniteNumber(getRecordValue(value, "height"))
  )
}

export function isBoothLayout(value: unknown): value is BoothLayout {
  if (!isRecord(value)) {
    return false
  }

  return floorIds.every((floorId) => {
    const booths = value[String(floorId)]
    return Array.isArray(booths) && booths.every(isBooth)
  })
}

function readStoredLayout(key: string): BoothLayout | null {
  const storedLayout = window.localStorage.getItem(key)
  if (!storedLayout) {
    return null
  }

  try {
    const parsedLayout: unknown = JSON.parse(storedLayout)
    return isBoothLayout(parsedLayout) ? parsedLayout : null
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null
    }
    throw error
  }
}

function readLegacyLayout(): BoothLayout {
  return readStoredLayout(legacyStorageKey) ?? cloneDefaultBoothLayout()
}

function readStoredTimestamp(key: string): string | null {
  const timestamp = window.localStorage.getItem(key)
  return timestamp && !Number.isNaN(Date.parse(timestamp)) ? timestamp : null
}

export class LocalBoothLayoutRepository implements BoothLayoutRepository {
  public readonly mode = "local"

  public async loadDraft(): Promise<LayoutRevision> {
    return {
      layout: readStoredLayout(draftStorageKey) ?? readLegacyLayout(),
      roomSizeModes: loadRoomSizeModes(),
      updatedAt: readStoredTimestamp(draftUpdatedAtKey),
    }
  }

  public async loadPublished(): Promise<LayoutRevision> {
    return {
      layout: readStoredLayout(publishedStorageKey) ?? readLegacyLayout(),
      roomSizeModes: {},
      updatedAt: readStoredTimestamp(publishedAtKey),
    }
  }

  public async saveDraft(draft: BoothLayoutDraft): Promise<string> {
    const updatedAt = new Date().toISOString()
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft.layout))
    window.localStorage.setItem(roomSizeModesKey, JSON.stringify(draft.roomSizeModes))
    window.localStorage.setItem(draftUpdatedAtKey, updatedAt)
    return updatedAt
  }

  public async publishDraft(): Promise<string> {
    const draft = await this.loadDraft()
    const publishedAt = new Date().toISOString()
    window.localStorage.setItem(publishedStorageKey, JSON.stringify(draft.layout))
    window.localStorage.setItem(publishedAtKey, publishedAt)
    return publishedAt
  }
}

function isRoomSizeModes(value: unknown): value is RoomSizeModes {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "boolean")
}

export function loadRoomSizeModes(): RoomSizeModes {
  const storedModes = window.localStorage.getItem(roomSizeModesKey)
  if (!storedModes) {
    return {}
  }

  try {
    const parsedModes: unknown = JSON.parse(storedModes)
    return isRoomSizeModes(parsedModes) ? parsedModes : {}
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {}
    }
    throw error
  }
}
