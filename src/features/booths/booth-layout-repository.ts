import type { BoothLayout, RoomSizeModes } from "./model"
import { SupabaseBoothLayoutRepository } from "./supabase-booth-layout-repository"
export { BoothLayoutRepositoryError } from "./booth-layout-repository-error"

export const layoutStorageModes = ["local", "supabase"] as const

export type LayoutStorageMode = (typeof layoutStorageModes)[number]

export type LayoutRevision = {
  readonly layout: BoothLayout
  readonly roomSizeModes: RoomSizeModes
  readonly updatedAt: string | null
}

export type BoothLayoutDraft = {
  readonly layout: BoothLayout
  readonly roomSizeModes: RoomSizeModes
}

export interface BoothLayoutRepository {
  readonly mode: LayoutStorageMode
  loadDraft(): Promise<LayoutRevision>
  loadPublished(): Promise<LayoutRevision>
  saveDraft(draft: BoothLayoutDraft): Promise<string>
  publishDraft(): Promise<string>
}

export function createBoothLayoutRepository(): BoothLayoutRepository {
  return new SupabaseBoothLayoutRepository()
}
