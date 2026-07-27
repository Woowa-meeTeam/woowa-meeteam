import {
  type Booth,
  type BoothBounds,
  boothSizeLimits,
  isResizeHandleDirection,
  type ResizeHandleDirection,
} from "./model"

type DragState = {
  readonly boothId: string
  readonly pointerId: number
  readonly offsetX: number
  readonly offsetY: number
  readonly startX: number
  readonly startY: number
}

type ResizeState = {
  readonly boothId: string
  readonly pointerId: number
  readonly direction: ResizeHandleDirection
  readonly startClientX: number
  readonly startClientY: number
  readonly originX: number
  readonly originY: number
  readonly originWidth: number
  readonly originHeight: number
}

type AdminDragControllerOptions = {
  readonly svg: SVGSVGElement
  readonly coordinateSpace: SVGGraphicsElement
  readonly mapWidth: number
  readonly mapHeight: number
  readonly getBooth: (boothId: string) => Booth | undefined
  readonly onSelect: (boothId: string) => void
  readonly onMove: (boothId: string, x: number, y: number) => void
  readonly onResize: (boothId: string, bounds: BoothBounds) => void
  readonly onCommit: () => void
  readonly onResizeCommit: () => void
}

const dragThreshold = 4

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export class AdminDragController {
  private readonly options: AdminDragControllerOptions
  private dragState: DragState | null = null
  private resizeState: ResizeState | null = null

  public constructor(options: AdminDragControllerOptions) {
    this.options = options
    options.svg.addEventListener("pointerdown", this.handlePointerDown)
    options.svg.addEventListener("pointermove", this.handlePointerMove)
    options.svg.addEventListener("pointerup", this.handlePointerEnd)
    options.svg.addEventListener("pointercancel", this.handlePointerEnd)
    options.svg.addEventListener("keydown", this.handleKeyDown)
  }

  public destroy(): void {
    this.options.svg.removeEventListener("pointerdown", this.handlePointerDown)
    this.options.svg.removeEventListener("pointermove", this.handlePointerMove)
    this.options.svg.removeEventListener("pointerup", this.handlePointerEnd)
    this.options.svg.removeEventListener("pointercancel", this.handlePointerEnd)
    this.options.svg.removeEventListener("keydown", this.handleKeyDown)
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const resizeHandle =
      event.target instanceof Element ? event.target.closest("[data-resize-handle]") : null
    if (resizeHandle) {
      this.startResize(event, resizeHandle)
      return
    }

    const marker = this.getMarker(event.target)
    const boothId = marker?.getAttribute("data-booth-id")
    const booth = boothId ? this.options.getBooth(boothId) : undefined
    const point = this.toWorldPoint(event.clientX, event.clientY)
    if (!marker || !boothId || !booth || !point) {
      return
    }

    event.preventDefault()
    this.options.onSelect(boothId)
    this.options.svg.setPointerCapture(event.pointerId)
    marker.setAttribute("data-dragging", "true")
    this.dragState = {
      boothId,
      pointerId: event.pointerId,
      offsetX: point.x - booth.x,
      offsetY: point.y - booth.y,
      startX: event.clientX,
      startY: event.clientY,
    }
  }

  private startResize(event: PointerEvent, resizeHandle: Element): void {
    const direction = resizeHandle.getAttribute("data-resize-handle")
    const boothId = resizeHandle.closest("[data-booth-id]")?.getAttribute("data-booth-id")
    const booth = boothId ? this.options.getBooth(boothId) : undefined
    if (!isResizeHandleDirection(direction) || !boothId || !booth) {
      return
    }

    event.preventDefault()
    this.options.svg.setPointerCapture(event.pointerId)
    this.options.svg.setAttribute("data-resizing", direction)
    this.resizeState = {
      boothId,
      pointerId: event.pointerId,
      direction,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: booth.x,
      originY: booth.y,
      originWidth: booth.width,
      originHeight: booth.height,
    }
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const resizeState = this.resizeState
    if (resizeState && event.pointerId === resizeState.pointerId) {
      event.preventDefault()
      const point = this.toWorldPoint(event.clientX, event.clientY)
      if (point) {
        this.options.onResize(resizeState.boothId, this.computeResizedBounds(resizeState, point))
      }
      return
    }

    const state = this.dragState
    const booth = state ? this.options.getBooth(state.boothId) : undefined
    const point = this.toWorldPoint(event.clientX, event.clientY)
    if (!state || event.pointerId !== state.pointerId || !booth || !point) {
      return
    }

    event.preventDefault()
    const x = Math.min(this.options.mapWidth - booth.width, Math.max(0, point.x - state.offsetX))
    const y = Math.min(this.options.mapHeight - booth.height, Math.max(0, point.y - state.offsetY))
    this.options.onMove(state.boothId, x, y)
  }

  private computeResizedBounds(state: ResizeState, point: DOMPoint): BoothBounds {
    const east = state.direction === "ne" || state.direction === "se"
    const south = state.direction === "sw" || state.direction === "se"
    const right = state.originX + state.originWidth
    const bottom = state.originY + state.originHeight

    const maxWidth = Math.min(
      boothSizeLimits.maxWidth,
      east ? this.options.mapWidth - state.originX : right,
    )
    const maxHeight = Math.min(
      boothSizeLimits.maxHeight,
      south ? this.options.mapHeight - state.originY : bottom,
    )
    const width = clamp(
      east ? point.x - state.originX : right - point.x,
      boothSizeLimits.minWidth,
      maxWidth,
    )
    const height = clamp(
      south ? point.y - state.originY : bottom - point.y,
      boothSizeLimits.minHeight,
      maxHeight,
    )

    return {
      x: east ? state.originX : right - width,
      y: south ? state.originY : bottom - height,
      width,
      height,
    }
  }

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    const resizeState = this.resizeState
    if (resizeState && event.pointerId === resizeState.pointerId) {
      const distance = Math.hypot(
        event.clientX - resizeState.startClientX,
        event.clientY - resizeState.startClientY,
      )
      if (this.options.svg.hasPointerCapture(event.pointerId)) {
        this.options.svg.releasePointerCapture(event.pointerId)
      }
      this.options.svg.removeAttribute("data-resizing")
      this.resizeState = null

      if (distance >= dragThreshold) {
        this.options.onResizeCommit()
      }
      return
    }

    const state = this.dragState
    if (!state || event.pointerId !== state.pointerId) {
      return
    }

    const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY)
    this.getMarkerById(state.boothId)?.removeAttribute("data-dragging")
    if (this.options.svg.hasPointerCapture(event.pointerId)) {
      this.options.svg.releasePointerCapture(event.pointerId)
    }
    this.dragState = null

    if (distance >= dragThreshold) {
      this.options.onCommit()
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    const marker = this.getMarker(event.target)
    const boothId = marker?.getAttribute("data-booth-id")
    if (!boothId) {
      return
    }

    event.preventDefault()
    this.options.onSelect(boothId)
  }

  private getMarker(target: EventTarget | null): SVGGElement | null {
    return target instanceof Element ? target.closest<SVGGElement>("[data-booth-id]") : null
  }

  private getMarkerById(boothId: string): SVGGElement | null {
    return this.options.svg.querySelector<SVGGElement>(`[data-booth-id="${boothId}"]`)
  }

  private toWorldPoint(clientX: number, clientY: number): DOMPoint | null {
    const matrix = this.options.coordinateSpace.getScreenCTM()
    return matrix ? new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse()) : null
  }
}
