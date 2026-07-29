import {
  type Booth,
  type BoothBounds,
  type BoothLayout,
  type BoothSize,
  boothSizeLimits,
  type FloorId,
  floorIds,
  type RoomDefinition,
  type RoomSizeModes,
} from "./model"
import { roomsByFloor } from "./room-data"

const defaultBoothSize: BoothSize = { width: 132, height: 76 }

function clampBoothSize(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export class AdminLayoutState {
  private layout: BoothLayout
  private roomSizeModes: RoomSizeModes
  private floorId: FloorId = 11
  private boothId: string | null
  private roomName: string
  private saved = true

  public constructor(layout: BoothLayout, roomSizeModes: RoomSizeModes) {
    this.layout = normalizeUniformBoothSizes(layout, roomSizeModes)
    this.roomSizeModes = roomSizeModes
    this.saved = this.layout === layout
    this.boothId = layout[11][0]?.id ?? null
    this.roomName = layout[11][0]?.roomName ?? roomsByFloor[11][0]?.name ?? ""
  }

  public get selectedFloorId(): FloorId {
    return this.floorId
  }

  public get selectedBoothId(): string | null {
    return this.boothId
  }

  public get selectedRoomName(): string {
    return this.roomName
  }

  public get isSaved(): boolean {
    return this.saved
  }

  public get layoutSnapshot(): BoothLayout {
    return this.layout
  }

  public get roomSizeModesSnapshot(): RoomSizeModes {
    return this.roomSizeModes
  }

  public get booths(): readonly Booth[] {
    return this.layout[this.floorId]
  }

  public get assignedProjectIds(): ReadonlySet<string> {
    return new Set(
      floorIds.flatMap((floorId) => this.layout[floorId].map((booth) => booth.projectId)),
    )
  }

  public get rooms(): readonly RoomDefinition[] {
    return roomsByFloor[this.floorId]
  }

  public get selectedBooth(): Booth | undefined {
    return this.boothId ? this.findBooth(this.boothId) : undefined
  }

  public get roomSize(): BoothSize {
    return this.boothSizeForRoom(this.roomName)
  }

  public boothSizeForRoom(roomName: string): BoothSize {
    const booth = this.referenceBoothForRoom(roomName)
    if (booth) {
      return { width: booth.width, height: booth.height }
    }
    const room = this.rooms.find((candidate) => candidate.name === roomName)
    return room
      ? {
          width: Math.min(defaultBoothSize.width, room.bounds.width),
          height: Math.min(defaultBoothSize.height, room.bounds.height),
        }
      : defaultBoothSize
  }

  public get isSelectedRoomSizeUniform(): boolean {
    return this.isRoomSizeUniformFor(this.roomName)
  }

  public selectFloor(floorId: FloorId): void {
    this.floorId = floorId
    this.boothId = this.booths[0]?.id ?? null
    this.roomName = this.selectedBooth?.roomName ?? this.rooms[0]?.name ?? ""
  }

  public selectBooth(boothId: string): boolean {
    const booth = this.findBooth(boothId)
    if (!booth) {
      return false
    }
    this.boothId = boothId
    this.roomName = booth.roomName
    return true
  }

  public findBooth(boothId: string): Booth | undefined {
    return this.booths.find((booth) => booth.id === boothId)
  }

  public addBoothAt(projectId: string, roomName: string, x: number, y: number): Booth | undefined {
    if (this.assignedProjectIds.has(projectId)) {
      return undefined
    }
    const room = this.rooms.find((candidate) => candidate.name === roomName)
    if (!room) {
      return undefined
    }
    // 신규 부스는 같은 공간에 이미 배치된 부스의 크기를 그대로 따릅니다.
    // 기존 부스는 절대 함께 리사이즈하지 않습니다.
    const size = this.boothSizeForRoom(room.name)
    const booth: Booth = {
      id: `${this.floorId}-${crypto.randomUUID()}`,
      floorId: this.floorId,
      boothNumber: this.getNextBoothNumber(),
      projectId,
      roomName: room.name,
      x,
      y,
      ...size,
    }
    this.setBooths([...this.booths, booth])
    this.boothId = booth.id
    this.roomName = room.name
    return booth
  }

  public selectRoom(roomName: string): void {
    this.roomName = roomName
  }

  public moveSelectedBoothToRoom(roomName: string): boolean {
    const booth = this.selectedBooth
    if (!booth) {
      return false
    }
    this.roomName = roomName
    if (this.isRoomSizeUniformFor(roomName)) {
      this.replaceBooth({ ...booth, roomName, ...this.roomSize })
    } else {
      this.replaceBooth({ ...booth, roomName })
    }
    return true
  }

  public setRoomSizeUniform(uniform: boolean): void {
    this.roomSizeModes = { ...this.roomSizeModes, [this.roomSizeModeKey(this.roomName)]: uniform }
    this.markUnsaved()
    if (!uniform || !this.booths.some((booth) => booth.roomName === this.roomName)) {
      return
    }
    const size = this.roomSize
    this.setBooths(
      this.booths.map((booth) =>
        booth.roomName === this.roomName ? { ...booth, ...size } : booth,
      ),
    )
  }

  public changeRoomSize(width: number, height: number): boolean {
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return false
    }
    const clampedWidth = clampBoothSize(width, boothSizeLimits.minWidth, boothSizeLimits.maxWidth)
    const clampedHeight = clampBoothSize(
      height,
      boothSizeLimits.minHeight,
      boothSizeLimits.maxHeight,
    )
    this.setBooths(
      this.booths.map((booth) =>
        booth.roomName === this.roomName
          ? { ...booth, width: clampedWidth, height: clampedHeight }
          : booth,
      ),
    )
    return true
  }

  public changeSelectedBoothSize(width: number, height: number): Booth | undefined {
    const booth = this.selectedBooth
    if (!booth || !Number.isFinite(width) || !Number.isFinite(height)) {
      return undefined
    }
    const updatedBooth = {
      ...booth,
      width: clampBoothSize(width, boothSizeLimits.minWidth, boothSizeLimits.maxWidth),
      height: clampBoothSize(height, boothSizeLimits.minHeight, boothSizeLimits.maxHeight),
    }
    this.replaceBooth(updatedBooth)
    return updatedBooth
  }

  public resizeBooth(boothId: string, bounds: BoothBounds): readonly Booth[] {
    const booth = this.findBooth(boothId)
    if (!booth) {
      return []
    }
    const { x, y, width, height } = bounds
    if (!this.isRoomSizeUniformFor(booth.roomName)) {
      const updatedBooth = { ...booth, x, y, width, height }
      this.replaceBooth(updatedBooth)
      return [updatedBooth]
    }
    this.setBooths(
      this.booths.map((candidate) => {
        if (candidate.roomName !== booth.roomName) {
          return candidate
        }
        return candidate.id === boothId
          ? { ...candidate, x, y, width, height }
          : { ...candidate, width, height }
      }),
    )
    return this.booths.filter((candidate) => candidate.roomName === booth.roomName)
  }

  public deleteSelectedBooth(): void {
    if (!this.boothId) {
      return
    }
    this.setBooths(this.booths.filter((booth) => booth.id !== this.boothId))
    this.boothId = this.booths[0]?.id ?? null
    this.roomName = this.selectedBooth?.roomName ?? this.rooms[0]?.name ?? ""
  }

  public moveBooth(boothId: string, x: number, y: number): Booth | undefined {
    const booth = this.findBooth(boothId)
    if (!booth) {
      return undefined
    }
    const updatedBooth = { ...booth, x, y }
    this.replaceBooth(updatedBooth)
    return updatedBooth
  }

  public alignSelectedColumn(): readonly Booth[] {
    const selected = this.selectedBooth
    if (!selected) {
      return []
    }
    const columnTolerance = Math.max(24, selected.width * 0.5)
    const column = this.booths
      .filter(
        (booth) =>
          booth.roomName === selected.roomName &&
          Math.abs(booth.x + booth.width / 2 - (selected.x + selected.width / 2)) <=
            columnTolerance,
      )
      .sort((first, second) => first.y - second.y)
    if (column.length < 2) {
      return []
    }

    const averageGap =
      column.slice(1).reduce((total, booth, index) => {
        const previous = column[index]
        return total + booth.y - (previous.y + previous.height)
      }, 0) /
      (column.length - 1)
    const gap = Math.max(8, averageGap)
    const room = this.rooms.find((candidate) => candidate.name === selected.roomName)
    if (!room) {
      return []
    }

    const positions: number[] = []
    for (const [index, booth] of column.entries()) {
      positions.push(index === 0 ? booth.y : positions[index - 1] + column[index - 1].height + gap)
    }
    const last = column[column.length - 1]
    const overflow = positions[positions.length - 1] + last.height - (room.bounds.y + room.bounds.height)
    const shift = overflow > 0 ? -overflow : 0
    const x = Math.min(room.bounds.x + room.bounds.width - selected.width, Math.max(room.bounds.x, selected.x))
    const aligned = this.booths.map((booth) => {
      const index = column.findIndex((candidate) => candidate.id === booth.id)
      if (index === -1) {
        return booth
      }
      return {
        ...booth,
        x,
        y: Math.max(room.bounds.y, positions[index] + shift),
      }
    })
    this.setBooths(aligned)
    return aligned.filter((booth) => column.some((candidate) => candidate.id === booth.id))
  }

  public alignSelectedRow(): readonly Booth[] {
    const selected = this.selectedBooth
    if (!selected) {
      return []
    }
    const rowTolerance = Math.max(24, selected.height * 0.5)
    const row = this.booths
      .filter(
        (booth) =>
          booth.roomName === selected.roomName &&
          Math.abs(booth.y + booth.height / 2 - (selected.y + selected.height / 2)) <= rowTolerance,
      )
      .sort((first, second) => first.x - second.x)
    if (row.length < 2) {
      return []
    }

    const averageGap =
      row.slice(1).reduce((total, booth, index) => {
        const previous = row[index]
        return total + booth.x - (previous.x + previous.width)
      }, 0) /
      (row.length - 1)
    const gap = Math.max(8, averageGap)
    const room = this.rooms.find((candidate) => candidate.name === selected.roomName)
    if (!room) {
      return []
    }

    const positions: number[] = []
    for (const [index, booth] of row.entries()) {
      positions.push(index === 0 ? booth.x : positions[index - 1] + row[index - 1].width + gap)
    }
    const last = row[row.length - 1]
    const overflow = positions[positions.length - 1] + last.width - (room.bounds.x + room.bounds.width)
    const shift = overflow > 0 ? -overflow : 0
    const y = Math.min(room.bounds.y + room.bounds.height - selected.height, Math.max(room.bounds.y, selected.y))
    const aligned = this.booths.map((booth) => {
      const index = row.findIndex((candidate) => candidate.id === booth.id)
      if (index === -1) {
        return booth
      }
      return {
        ...booth,
        x: Math.max(room.bounds.x, positions[index] + shift),
        y,
      }
    })
    this.setBooths(aligned)
    return aligned.filter((booth) => row.some((candidate) => candidate.id === booth.id))
  }

  public markUnsaved(): void {
    this.saved = false
  }

  public markSaved(): void {
    this.saved = true
  }

  private isRoomSizeUniformFor(roomName: string): boolean {
    return this.roomSizeModes[this.roomSizeModeKey(roomName)] ?? true
  }

  private referenceBoothForRoom(roomName: string): Booth | undefined {
    return this.booths.find((booth) => booth.roomName === roomName)
  }

  private roomSizeModeKey(roomName: string): string {
    return `${this.floorId}:${roomName}`
  }

  private replaceBooth(updatedBooth: Booth): void {
    this.setBooths(
      this.booths.map((booth) => (booth.id === updatedBooth.id ? updatedBooth : booth)),
    )
  }

  private setBooths(booths: readonly Booth[]): void {
    this.layout = { ...this.layout, [this.floorId]: booths }
    this.markUnsaved()
  }

  private getNextBoothNumber(): string {
    const usedNumbers = new Set(this.booths.map((booth) => booth.boothNumber))
    let sequence = 1
    while (usedNumbers.has(`${this.floorId}-${String(sequence).padStart(2, "0")}`)) {
      sequence += 1
    }
    return `${this.floorId}-${String(sequence).padStart(2, "0")}`
  }
}

function normalizeUniformBoothSizes(layout: BoothLayout, roomSizeModes: RoomSizeModes): BoothLayout {
  let changed = false
  const normalized = Object.fromEntries(
    floorIds.map((floorId) => {
      const floorBooths = layout[floorId]
      const roomNames = [...new Set(floorBooths.map((booth) => booth.roomName))]
      const booths = roomNames.reduce((current, roomName) => {
        if (roomSizeModes[`${floorId}:${roomName}`] === false) {
          return current
        }
        const roomBooths = current.filter((booth) => booth.roomName === roomName)
        const reference = roomBooths[0]
        if (!reference) {
          return current
        }
        return current.map((booth) => {
          if (booth.roomName !== roomName) {
            return booth
          }
          if (booth.width === reference.width && booth.height === reference.height) {
            return booth
          }
          changed = true
          return { ...booth, width: reference.width, height: reference.height }
        })
      }, floorBooths)
      return [floorId, booths]
    }),
  ) as unknown as BoothLayout
  return changed ? normalized : layout
}
