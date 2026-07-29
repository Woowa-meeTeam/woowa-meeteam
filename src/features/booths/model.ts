export const floorIds = [11, 12, 13] as const

export type FloorId = (typeof floorIds)[number]

export type FloorMap = {
  readonly id: FloorId
  readonly label: string
  readonly width: number
  readonly height: number
  readonly mapMarkup: string
}

export type Booth = {
  readonly id: string
  readonly floorId: FloorId
  readonly boothNumber: string
  readonly projectId: string
  readonly roomName: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type BoothLayout = Readonly<Record<FloorId, readonly Booth[]>>

export type RoomSizeModes = Readonly<Record<string, boolean>>

export type BoothSize = {
  readonly width: number
  readonly height: number
}

export type BoothBounds = BoothSize & {
  readonly x: number
  readonly y: number
}

export type MapViewState =
  | { readonly kind: "floor" }
  | { readonly kind: "room"; readonly roomName: string }

export type MapOrientation = "standard" | "clockwise"

export const boothSizeLimits = {
  minWidth: 28,
  maxWidth: 280,
  minHeight: 28,
  maxHeight: 180,
} as const

export const resizeHandleDirections = ["nw", "ne", "sw", "se"] as const

export type ResizeHandleDirection = (typeof resizeHandleDirections)[number]

export function isResizeHandleDirection(value: string | null): value is ResizeHandleDirection {
  return resizeHandleDirections.some((direction) => direction === value)
}

export type RoomDefinition = {
  readonly name: string
  readonly anchorX: number
  readonly anchorY: number
  readonly bounds: BoothBounds
}
