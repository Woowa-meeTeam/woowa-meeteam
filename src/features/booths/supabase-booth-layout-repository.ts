import { supabase } from "../../lib/supabase"
import type { BoothLayoutRepository, LayoutRevision } from "./booth-layout-repository"
import { BoothLayoutRepositoryError } from "./booth-layout-repository-error"
import { isBoothLayout } from "./booth-storage"
import { type Booth, type BoothLayout, type FloorId, floorIds, type RoomSizeModes } from "./model"

type LayoutRow = {
  readonly floorNumber: FloorId
  readonly layout: readonly Booth[]
  readonly roomSizeModes: RoomSizeModes
  readonly updatedAt: string | null
}

export class SupabaseBoothLayoutError extends BoothLayoutRepositoryError {
  public override readonly name = "SupabaseBoothLayoutError"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getRecordValue(record: Record<string, unknown>, key: string): unknown {
  return record[key]
}

function isFloorId(value: unknown): value is FloorId {
  return value === 11 || value === 12 || value === 13
}

function readTimestamp(value: unknown): string | null {
  if (value === null) {
    return null
  }
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new SupabaseBoothLayoutError("Supabase 배치 시각이 올바르지 않습니다.")
  }
  return value
}

function parseRoomSizeModes(value: unknown): RoomSizeModes {
  if (!isRecord(value)) {
    throw new SupabaseBoothLayoutError("Supabase 공간별 크기 설정이 올바르지 않습니다.")
  }
  const modes: Record<string, boolean> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "boolean") {
      throw new SupabaseBoothLayoutError("Supabase 공간별 크기 설정이 올바르지 않습니다.")
    }
    modes[key] = entry
  }
  return modes
}

function parseLayoutRow(value: unknown, timestampKey: string): LayoutRow {
  if (!isRecord(value)) {
    throw new SupabaseBoothLayoutError("Supabase 배치 행이 올바르지 않습니다.")
  }
  const floorNumber = getRecordValue(value, "floor_number")
  const floorLayout = getRecordValue(value, "layout")
  if (!isFloorId(floorNumber)) {
    throw new SupabaseBoothLayoutError("Supabase 층 번호가 올바르지 않습니다.")
  }
  const wrappedLayout: unknown = { 11: [], 12: [], 13: [], [floorNumber]: floorLayout }

  if (
    !isBoothLayout(wrappedLayout) ||
    wrappedLayout[floorNumber].some((booth) => booth.floorId !== floorNumber)
  ) {
    throw new SupabaseBoothLayoutError("Supabase 층별 배치 데이터가 올바르지 않습니다.")
  }
  return {
    floorNumber,
    layout: wrappedLayout[floorNumber],
    roomSizeModes: parseRoomSizeModes(getRecordValue(value, "room_size_modes") ?? {}),
    updatedAt: readTimestamp(value[timestampKey]),
  }
}

function parseLayoutRevision(payload: unknown, timestampKey: string): LayoutRevision {
  if (!Array.isArray(payload)) {
    throw new SupabaseBoothLayoutError("Supabase 배치 목록 응답이 올바르지 않습니다.")
  }
  const rows = payload.map((value) => parseLayoutRow(value, timestampKey))
  const findFloor = (floorId: FloorId): LayoutRow => {
    const row = rows.find((candidate) => candidate.floorNumber === floorId)
    if (!row) {
      throw new SupabaseBoothLayoutError(`${floorId}층 배치 데이터가 없습니다.`)
    }
    return row
  }
  const floor11 = findFloor(11)
  const floor12 = findFloor(12)
  const floor13 = findFloor(13)
  const timestamps = rows
    .map((row) => row.updatedAt)
    .filter((timestamp): timestamp is string => timestamp !== null)
    .sort()

  return {
    layout: {
      11: floor11.layout,
      12: floor12.layout,
      13: floor13.layout,
    },
    roomSizeModes: {
      ...floor11.roomSizeModes,
      ...floor12.roomSizeModes,
      ...floor13.roomSizeModes,
    },
    updatedAt: timestamps[timestamps.length - 1] ?? null,
  }
}

export class SupabaseBoothLayoutRepository implements BoothLayoutRepository {
  public readonly mode = "supabase"

  public async loadDraft(): Promise<LayoutRevision> {
    const { data, error } = await supabase
      .from("floor_layout_drafts")
      .select("floor_number,layout,room_size_modes,updated_at")
      .order("floor_number", { ascending: true })
    if (error) {
      throw new SupabaseBoothLayoutError(`Supabase 초안을 불러오지 못했습니다. ${error.message}`)
    }
    return parseLayoutRevision(data, "updated_at")
  }

  public async loadPublished(): Promise<LayoutRevision> {
    const { data, error } = await supabase
      .from("floor_layout_publications")
      .select("floor_number,layout,published_at")
      .order("floor_number", { ascending: true })
    if (error) {
      throw new SupabaseBoothLayoutError(`Supabase 게시본을 불러오지 못했습니다. ${error.message}`)
    }
    return parseLayoutRevision(data, "published_at")
  }

  public async saveDraft(draft: {
    readonly layout: BoothLayout
    readonly roomSizeModes: RoomSizeModes
  }): Promise<string> {
    const layouts = Object.fromEntries(floorIds.map((floorId) => [floorId, draft.layout[floorId]]))
    const roomSizeModes = Object.fromEntries(
      floorIds.map((floorId) => [
        floorId,
        Object.fromEntries(
          Object.entries(draft.roomSizeModes).filter(([key]) => key.startsWith(`${floorId}:`)),
        ),
      ]),
    )
    const { data, error } = await supabase.rpc("save_booth_layout_draft", {
      p_layouts: layouts,
      p_room_size_modes: roomSizeModes,
    })
    if (error) {
      throw new SupabaseBoothLayoutError(`Supabase 초안을 저장하지 못했습니다. ${error.message}`)
    }
    return readTimestamp(data) ?? new Date().toISOString()
  }

  public async publishDraft(): Promise<string> {
    const { data, error } = await supabase.rpc("publish_booth_layouts")
    if (error) {
      throw new SupabaseBoothLayoutError(`Supabase 초안을 게시하지 못했습니다. ${error.message}`)
    }
    return readTimestamp(data) ?? new Date().toISOString()
  }
}
