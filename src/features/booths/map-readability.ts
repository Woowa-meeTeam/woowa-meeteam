import type { Booth, BoothBounds, FloorMap, MapOrientation, RoomDefinition } from "./model"

const markerMinimums = {
  width: 72,
  height: 44,
  numberFontSize: 15,
  teamFontSize: 20,
  gap: 8,
} as const

const markerBaseFontSizes = {
  number: 18,
  team: 25,
} as const

const roomViewPadding = 24

export type MapViewport = {
  readonly width: number
  readonly height: number
}

export type RoomPresentation = {
  readonly room: RoomDefinition
  readonly booths: readonly Booth[]
  readonly mode: "inline" | "summary" | "detail-overflow"
  readonly hasOverlap: boolean
  readonly fitsWithinRoom: boolean
  readonly markerScales: Readonly<Record<string, number>>
  readonly projectionScale: number
}

export type BoothLabelMetrics = {
  readonly numberFontSize: number
  readonly teamFontSize: number
  readonly numberY: number
  readonly teamY: number
}

export function boothLabelMetrics(
  booth: Booth,
  orientation: MapOrientation = "standard",
  teamName = "이름",
  projectionScale = 1,
): BoothLabelMetrics {
  const layoutWidth = orientation === "clockwise" ? booth.height : booth.width
  const layoutHeight = orientation === "clockwise" ? booth.width : booth.height
  const safeProjectionScale = Math.max(Number.EPSILON, projectionScale)
  const numberFontSize = fitLabelFontSize(
    booth.boothNumber,
    layoutWidth,
    layoutHeight * 0.3,
    8,
    Math.max(markerBaseFontSizes.number, markerMinimums.numberFontSize / safeProjectionScale),
  )
  const teamFontSize = fitLabelFontSize(
    teamName,
    layoutWidth,
    layoutHeight * 0.38,
    9,
    Math.max(markerBaseFontSizes.team, markerMinimums.teamFontSize / safeProjectionScale),
  )
  const centerY = booth.y + booth.height / 2
  return {
    numberFontSize,
    teamFontSize,
    numberY: centerY - layoutHeight * 0.18,
    teamY: centerY + layoutHeight * 0.27,
  }
}

export function floorViewBox(floor: FloorMap): BoothBounds {
  return { x: 0, y: 0, width: floor.width, height: floor.height }
}

export function roomViewBox(floor: FloorMap, room: RoomDefinition): BoothBounds {
  const x = Math.max(0, room.bounds.x - roomViewPadding)
  const y = Math.max(0, room.bounds.y - roomViewPadding)
  const right = Math.min(floor.width, room.bounds.x + room.bounds.width + roomViewPadding)
  const bottom = Math.min(floor.height, room.bounds.y + room.bounds.height + roomViewPadding)
  return { x, y, width: right - x, height: bottom - y }
}

export function roomMapOrientation(viewBox: BoothBounds): MapOrientation {
  return viewBox.height > viewBox.width ? "clockwise" : "standard"
}

export function displayViewBox(viewBox: BoothBounds, orientation: MapOrientation): BoothBounds {
  return orientation === "clockwise"
    ? { x: 0, y: 0, width: viewBox.height, height: viewBox.width }
    : viewBox
}

export function coordinateSpaceTransform(
  viewBox: BoothBounds,
  orientation: MapOrientation,
): string | undefined {
  return orientation === "clockwise"
    ? `translate(${viewBox.height} 0) rotate(90) translate(${-viewBox.x} ${-viewBox.y})`
    : undefined
}

export function mapCameraTransform(
  floor: FloorMap,
  viewBox: BoothBounds,
  orientation: MapOrientation,
): string | undefined {
  if (orientation === "standard" && viewBox.x === 0 && viewBox.y === 0) {
    return undefined
  }
  const angle = orientation === "clockwise" ? Math.PI / 2 : 0
  const orientedWidth = orientation === "clockwise" ? viewBox.height : viewBox.width
  const orientedHeight = orientation === "clockwise" ? viewBox.width : viewBox.height
  const scale = Math.min(floor.width / orientedWidth, floor.height / orientedHeight)
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const a = scale * cosine
  const b = scale * sine
  const c = -scale * sine
  const d = scale * cosine
  const worldCenterX = viewBox.x + viewBox.width / 2
  const worldCenterY = viewBox.y + viewBox.height / 2
  const e = floor.width / 2 - a * worldCenterX - c * worldCenterY
  const f = floor.height / 2 - b * worldCenterX - d * worldCenterY
  return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`
}

export function viewportForWidth(width: number, viewBox: BoothBounds): MapViewport {
  const safeWidth = Math.max(1, width)
  return {
    width: safeWidth,
    height: safeWidth * (viewBox.height / viewBox.width),
  }
}

export function calculateRoomPresentation(
  room: RoomDefinition,
  booths: readonly Booth[],
  viewBox: BoothBounds,
  viewport: MapViewport,
  detailMode: boolean,
  orientation: MapOrientation = "standard",
): RoomPresentation {
  const projectionScale = calculateProjectionScale(displayViewBox(viewBox, orientation), viewport)
  const markerScales = Object.fromEntries(
    booths.map((booth) => [booth.id, calculateMarkerScale(booth, projectionScale, orientation)]),
  )
  const displayBounds = booths.map((booth) =>
    scaleBoundsAroundCenter(booth, markerScales[booth.id] ?? 1),
  )
  const fitsWithinRoom = displayBounds.every((bounds) => contains(room.bounds, bounds))
  const hasOverlap = displayBounds.some((bounds, index) =>
    displayBounds.slice(index + 1).some((candidate) => intersectsWithGap(bounds, candidate, 0)),
  )
  const lacksReadableGap = displayBounds.some((bounds, index) =>
    displayBounds
      .slice(index + 1)
      .some((candidate) =>
        intersectsWithGap(bounds, candidate, markerMinimums.gap / projectionScale),
      ),
  )

  return {
    room,
    booths,
    mode:
      fitsWithinRoom && !lacksReadableGap ? "inline" : detailMode ? "detail-overflow" : "summary",
    hasOverlap,
    fitsWithinRoom,
    markerScales,
    projectionScale,
  }
}

function calculateProjectionScale(viewBox: BoothBounds, viewport: MapViewport): number {
  return Math.max(
    Number.EPSILON,
    Math.min(viewport.width / viewBox.width, viewport.height / viewBox.height),
  )
}

function calculateMarkerScale(
  booth: Booth,
  projectionScale: number,
  orientation: MapOrientation,
): number {
  const labels = boothLabelMetrics(booth, orientation)
  return Math.max(
    1,
    markerMinimums.width / (booth.width * projectionScale),
    markerMinimums.height / (booth.height * projectionScale),
    markerMinimums.numberFontSize / (labels.numberFontSize * projectionScale),
    markerMinimums.teamFontSize / (labels.teamFontSize * projectionScale),
  )
}

function fitLabelFontSize(
  text: string,
  availableWidth: number,
  heightBasedSize: number,
  minimumSize: number,
  maximumSize: number,
): number {
  const widthBasedSize = (availableWidth * 0.8) / estimateTextWidthUnits(text)
  return Math.min(maximumSize, Math.max(minimumSize, Math.min(heightBasedSize, widthBasedSize)))
}

function estimateTextWidthUnits(text: string): number {
  return Math.max(
    1,
    [...text].reduce((total, character) => {
      return total + (/[A-Za-z0-9-]/.test(character) ? 0.62 : 1)
    }, 0),
  )
}

function scaleBoundsAroundCenter(bounds: BoothBounds, scale: number): BoothBounds {
  const width = bounds.width * scale
  const height = bounds.height * scale
  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height,
  }
}

function contains(container: BoothBounds, candidate: BoothBounds): boolean {
  return (
    candidate.x >= container.x &&
    candidate.y >= container.y &&
    candidate.x + candidate.width <= container.x + container.width &&
    candidate.y + candidate.height <= container.y + container.height
  )
}

function intersectsWithGap(first: BoothBounds, second: BoothBounds, gap: number): boolean {
  return !(
    first.x + first.width + gap <= second.x ||
    second.x + second.width + gap <= first.x ||
    first.y + first.height + gap <= second.y ||
    second.y + second.height + gap <= first.y
  )
}
