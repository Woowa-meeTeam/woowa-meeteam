import { AdminDragController } from "./admin-drag-controller"
import { AdminLayoutState } from "./admin-layout-state"
import {
  syncResizeHandles,
  updateMovedMarker,
  updateResizedMarkers,
  updateRoomMarkerSizes,
  updateSelectedMarkerStates,
} from "./admin-marker-view"
import { AdminPersistenceController } from "./admin-persistence-controller"
import {
  renderAdminBoothTray,
  renderAdminInspector,
  renderAdminMap,
  renderAdminShell,
} from "./admin-templates"
import { floorMaps } from "./booth-data"
import type { BoothLayoutRepository } from "./booth-layout-repository"
import type { MeeteamProject } from "./integrations/meeteam/project-source"
import {
  calculateRoomPresentation,
  displayViewBox,
  floorViewBox,
  roomMapOrientation,
  roomViewBox,
  viewportForWidth,
} from "./map-readability"
import { animateMapCamera, syncMapBackgroundLabelOrientation } from "./map-view-transition"
import type { BoothBounds, BoothLayout, FloorId, MapViewState, RoomSizeModes } from "./model"
import { floorIds } from "./model"
import { queryRequired } from "./view-templates"

type BoothDropTarget = BoothBounds & {
  readonly roomName: string
}

const svgNamespace = "http://www.w3.org/2000/svg"

export class BoothAdminApp {
  private readonly root: HTMLDivElement
  private readonly state: AdminLayoutState
  private readonly persistence: AdminPersistenceController
  private readonly projects: readonly MeeteamProject[]
  private draggedProjectId: string | null = null
  private dragController: AdminDragController | null = null
  private mapView: MapViewState = { kind: "floor" }
  private mapWidth = 1
  private isMapTransitioning = false
  private readonly resizeObserver: ResizeObserver

  public constructor(
    root: HTMLDivElement,
    projects: readonly MeeteamProject[],
    repository: BoothLayoutRepository,
    layout: BoothLayout,
    roomSizeModes: RoomSizeModes,
  ) {
    this.root = root
    this.projects = projects
    this.state = new AdminLayoutState(layout, roomSizeModes)
    this.persistence = new AdminPersistenceController(root, this.state, repository)
    this.root.innerHTML = renderAdminShell(this.state.selectedFloorId, repository.mode)
    this.bindShellActions()
    this.persistence.bindActions()
    const mapPanel = queryRequired<HTMLElement>(this.root, ".admin-map-panel")
    this.mapWidth = Math.max(1, mapPanel.getBoundingClientRect().width)
    this.resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(1, entry?.contentRect.width ?? 1)
      if (Math.abs(nextWidth - this.mapWidth) < 1) {
        return
      }
      this.mapWidth = nextWidth
      if (this.isMapTransitioning) {
        return
      }
      this.syncMapViewAfterLayoutChange(this.state.selectedRoomName)
      this.renderCurrentFloor()
    })
    this.resizeObserver.observe(mapPanel)
    this.renderCurrentFloor()
  }

  public destroy(): void {
    this.dragController?.destroy()
    this.resizeObserver.disconnect()
    this.root.replaceChildren()
  }

  private get availableProjects(): readonly MeeteamProject[] {
    const assignedProjectIds = this.state.assignedProjectIds
    return this.projects.filter((project) => !assignedProjectIds.has(project.id))
  }

  private bindShellActions(): void {
    for (const floorId of floorIds) {
      queryRequired<HTMLButtonElement>(
        this.root,
        `[data-admin-floor-id="${floorId}"]`,
      ).addEventListener("click", () => this.selectFloor(floorId))
    }
  }

  private selectFloor(floorId: FloorId): void {
    this.state.selectFloor(floorId)
    this.mapView = { kind: "floor" }
    this.updateFloorButtons()
    this.renderCurrentFloor()
  }

  private renderCurrentFloor(preservedSvg?: SVGSVGElement): void {
    if (!preservedSvg) {
      this.dragController?.destroy()
    }
    const floor = floorMaps[this.state.selectedFloorId]
    const mapPanel = queryRequired<HTMLElement>(this.root, ".admin-map-panel")
    const mapView = this.mapView
    const activeRoom =
      mapView.kind === "room"
        ? this.state.rooms.find((room) => room.name === mapView.roomName)
        : undefined
    if (this.mapView.kind === "room" && !activeRoom) {
      this.mapView = { kind: "floor" }
    }
    const viewBox = activeRoom ? roomViewBox(floor, activeRoom) : floorViewBox(floor)
    const orientation = activeRoom ? roomMapOrientation(viewBox) : "standard"
    const viewport = viewportForWidth(this.mapWidth, displayViewBox(viewBox, orientation))
    const floorBox = floorViewBox(floor)
    const floorViewport = viewportForWidth(this.mapWidth, floorBox)
    const roomPresentations = this.state.rooms.map((room) => {
      const isActiveRoom = activeRoom?.name === room.name
      return calculateRoomPresentation(
        room,
        this.state.booths.filter((booth) => booth.roomName === room.name),
        isActiveRoom ? viewBox : floorBox,
        isActiveRoom ? viewport : floorViewport,
        isActiveRoom,
        isActiveRoom ? orientation : "standard",
      )
    })
    preservedSvg?.remove()
    mapPanel.innerHTML = renderAdminMap({
      floor,
      booths: this.state.booths,
      projects: this.projects,
      selectedBoothId: this.state.selectedBoothId,
      rooms: this.state.rooms,
      view: this.mapView,
      viewBox,
      orientation,
      roomPresentations,
      floorProjectionScale: floorViewport.width / floorBox.width,
    })

    const renderedSvg = queryRequired<SVGSVGElement>(mapPanel, ".admin-map")
    if (preservedSvg) {
      renderedSvg.replaceWith(preservedSvg)
    }
    const svg = preservedSvg ?? renderedSvg
    syncMapBackgroundLabelOrientation(
      svg,
      activeRoom?.name ?? null,
      activeRoom ? orientation : "standard",
    )
    mapPanel
      .querySelector<HTMLButtonElement>('[data-admin-map-action="floor"]')
      ?.addEventListener("click", () => void this.showFloorMap())
    if (!preservedSvg) {
      const coordinateSpace = queryRequired<SVGGElement>(svg, ".map-coordinate-space")
      this.bindMapEntries(svg)
      this.bindBoothDropTarget(svg)
      this.dragController = new AdminDragController({
        svg,
        coordinateSpace,
        mapWidth: floor.width,
        mapHeight: floor.height,
        getBooth: (boothId) => this.state.findBooth(boothId),
        onSelect: (boothId) => this.selectBooth(boothId),
        onMove: (boothId, x, y) => this.moveBooth(svg, boothId, x, y),
        onResize: (boothId, bounds) => this.resizeBooth(svg, boothId, bounds),
        onCommit: () => this.commitMove(),
        onResizeCommit: () => this.commitResize(),
      })
    }
    updateSelectedMarkerStates(this.root, this.state.selectedBoothId)
    syncResizeHandles(svg, this.state.selectedBooth ?? null)
    this.renderBoothTray()
    this.renderInspector()
    requestAnimationFrame(() => this.updateDetailOverflowWarning())
  }

  private renderBoothTray(): void {
    const tray = queryRequired<HTMLElement>(this.root, "[data-admin-booth-tray]")
    tray.innerHTML = renderAdminBoothTray(this.availableProjects)
    for (const card of tray.querySelectorAll<HTMLElement>("[data-project-id]")) {
      card.addEventListener("dragstart", (event) => {
        const projectId = card.getAttribute("data-project-id")
        if (!projectId || !(event instanceof DragEvent)) {
          event.preventDefault()
          return
        }
        this.draggedProjectId = projectId
        card.setAttribute("data-dragging", "true")
        event.dataTransfer?.setData("text/plain", projectId)
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "copy"
        }
      })
      card.addEventListener("dragend", () => {
        this.draggedProjectId = null
        card.removeAttribute("data-dragging")
        this.clearDropPreview()
      })
    }
  }

  private renderInspector(): void {
    const inspector = queryRequired<HTMLElement>(this.root, ".admin-inspector")
    inspector.innerHTML = renderAdminInspector({
      booth: this.state.selectedBooth,
      rooms: this.state.rooms,
      selectedRoomName: this.state.selectedRoomName,
      roomSize: this.state.roomSize,
      isRoomSizeUniform: this.state.isSelectedRoomSizeUniform,
      projects: this.projects,
      isSaved: this.state.isSaved,
    })
    this.bindInspectorActions(inspector)
    this.persistence.syncState()
  }

  private bindInspectorActions(inspector: HTMLElement): void {
    queryRequired<HTMLSelectElement>(inspector, "[data-admin-room]").addEventListener(
      "change",
      (event) => {
        const select = event.target
        if (select instanceof HTMLSelectElement) {
          this.state.selectRoom(select.value)
          this.renderInspector()
        }
      },
    )

    queryRequired<HTMLInputElement>(inspector, "[data-room-size-uniform]").addEventListener(
      "change",
      (event) => {
        const input = event.target
        if (!(input instanceof HTMLInputElement)) {
          return
        }
        this.state.setRoomSizeUniform(input.checked)
        this.updateSaveState(
          input.checked
            ? "이 공간의 부스 크기를 통일했습니다."
            : "이 공간의 부스 크기를 개별적으로 조정합니다.",
        )
        updateRoomMarkerSizes(this.root, this.state.booths, this.state.selectedRoomName)
        this.refreshAfterLayoutCommit()
      },
    )

    for (const input of inspector.querySelectorAll<HTMLInputElement>(
      "[data-room-width], [data-room-height]",
    )) {
      input.addEventListener("input", () => this.changeRoomSize(inspector))
      input.addEventListener("change", () => this.refreshAfterLayoutCommit())
    }

    if (!this.state.selectedBooth) {
      return
    }

    queryRequired<HTMLButtonElement>(inspector, '[data-admin-action="delete"]').addEventListener(
      "click",
      () => {
        this.state.deleteSelectedBooth()
        this.updateSaveState("부스를 삭제했습니다.")
        this.renderCurrentFloor()
      },
    )
    this.bindBoothFields(inspector)
  }

  private bindBoothFields(inspector: HTMLElement): void {
    queryRequired<HTMLSelectElement>(inspector, "[data-booth-room]").addEventListener(
      "change",
      (event) => {
        const select = event.target
        if (
          select instanceof HTMLSelectElement &&
          this.state.moveSelectedBoothToRoom(select.value)
        ) {
          this.updateSaveState("선택한 부스의 공간을 변경했습니다.")
          this.syncMapViewAfterLayoutChange(select.value)
          this.renderCurrentFloor()
        }
      },
    )
    for (const input of inspector.querySelectorAll<HTMLInputElement>(
      "[data-booth-width], [data-booth-height]",
    )) {
      input.addEventListener("input", () => this.changeSelectedBoothSize(inspector))
      input.addEventListener("change", () => this.refreshAfterLayoutCommit())
    }
  }

  private selectBooth(boothId: string): void {
    if (!this.state.selectBooth(boothId)) {
      return
    }
    updateSelectedMarkerStates(this.root, this.state.selectedBoothId)
    const svg = this.root.querySelector<SVGSVGElement>(".admin-map")
    if (svg) {
      syncResizeHandles(svg, this.state.selectedBooth ?? null)
    }
    this.renderInspector()
  }

  private moveBooth(svg: SVGSVGElement, boothId: string, x: number, y: number): void {
    const booth = this.state.moveBooth(boothId, x, y)
    if (booth) {
      updateMovedMarker(svg, booth)
    }
  }

  private resizeBooth(svg: SVGSVGElement, boothId: string, bounds: BoothBounds): void {
    const resizedBooths = this.state.resizeBooth(boothId, bounds)
    if (resizedBooths.length > 0) {
      updateResizedMarkers(svg, resizedBooths)
    }
  }

  private commitResize(): void {
    this.updateSaveState("부스 크기를 변경했습니다.")
    this.refreshAfterLayoutCommit()
  }

  private commitMove(): void {
    this.updateSaveState("저장하지 않은 변경사항이 있습니다.")
    this.refreshAfterLayoutCommit()
  }

  private changeRoomSize(inspector: HTMLElement): void {
    const width = queryRequired<HTMLInputElement>(inspector, "[data-room-width]").valueAsNumber
    const height = queryRequired<HTMLInputElement>(inspector, "[data-room-height]").valueAsNumber
    if (this.state.changeRoomSize(width, height)) {
      this.updateSaveState("공간의 공통 부스 크기를 변경했습니다.")
      updateRoomMarkerSizes(this.root, this.state.booths, this.state.selectedRoomName)
    }
  }

  private changeSelectedBoothSize(inspector: HTMLElement): void {
    const width = queryRequired<HTMLInputElement>(inspector, "[data-booth-width]").valueAsNumber
    const height = queryRequired<HTMLInputElement>(inspector, "[data-booth-height]").valueAsNumber
    const booth = this.state.changeSelectedBoothSize(width, height)
    if (booth) {
      this.updateSaveState("선택한 부스의 크기를 변경했습니다.")
      updateResizedMarkers(queryRequired<SVGSVGElement>(this.root, ".admin-map"), [booth])
    }
  }

  private updateFloorButtons(): void {
    for (const floorId of floorIds) {
      queryRequired<HTMLButtonElement>(
        this.root,
        `[data-admin-floor-id="${floorId}"]`,
      ).setAttribute("aria-selected", String(floorId === this.state.selectedFloorId))
    }
  }

  private updateSaveState(message: string): void {
    this.persistence.updateState(message)
  }

  private bindBoothDropTarget(svg: SVGSVGElement): void {
    svg.addEventListener("dragover", (event) => {
      if (!this.draggedProjectId) {
        return
      }
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy"
      }
      const target = this.resolveBoothDropTarget(svg, event.clientX, event.clientY)
      this.renderDropPreview(svg, target)
    })
    svg.addEventListener("dragleave", (event) => {
      if (event.relatedTarget instanceof Node && svg.contains(event.relatedTarget)) {
        return
      }
      this.clearDropPreview(svg)
    })
    svg.addEventListener("drop", (event) => {
      const projectId = this.draggedProjectId
      if (!projectId) {
        return
      }
      event.preventDefault()
      const target = this.resolveBoothDropTarget(svg, event.clientX, event.clientY)
      this.draggedProjectId = null
      this.clearDropPreview(svg)
      if (!target) {
        this.updateSaveState("부스를 지도에 표시된 공간 안에 놓아주세요.")
        return
      }
      const booth = this.state.addBoothAt(projectId, target.roomName, target.x, target.y)
      if (!booth) {
        this.updateSaveState("이미 배치된 프로젝트이거나 공간을 찾을 수 없습니다.")
        return
      }
      this.updateSaveState(`${booth.roomName}에 새 부스를 배치했습니다.`)
      this.syncMapViewAfterLayoutChange(booth.roomName)
      this.renderCurrentFloor()
    })
  }

  private resolveBoothDropTarget(
    svg: SVGSVGElement,
    clientX: number,
    clientY: number,
  ): BoothDropTarget | null {
    const coordinateSpace = svg.querySelector<SVGGElement>(".map-coordinate-space")
    const matrix = coordinateSpace?.getScreenCTM()
    if (!matrix) {
      return null
    }
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
    const mapView = this.mapView
    const candidateRooms =
      mapView.kind === "room"
        ? this.state.rooms.filter((room) => room.name === mapView.roomName)
        : this.state.rooms
    const room = candidateRooms.find(
      (candidate) =>
        point.x >= candidate.bounds.x &&
        point.x <= candidate.bounds.x + candidate.bounds.width &&
        point.y >= candidate.bounds.y &&
        point.y <= candidate.bounds.y + candidate.bounds.height,
    )
    if (!room) {
      return null
    }

    const size = this.state.boothSizeForRoom(room.name)
    const maxX = room.bounds.x + room.bounds.width - size.width
    const maxY = room.bounds.y + room.bounds.height - size.height
    return {
      roomName: room.name,
      x: Math.max(room.bounds.x, Math.min(maxX, point.x - size.width / 2)),
      y: Math.max(room.bounds.y, Math.min(maxY, point.y - size.height / 2)),
      ...size,
    }
  }

  private renderDropPreview(svg: SVGSVGElement, target: BoothDropTarget | null): void {
    if (!target) {
      this.clearDropPreview(svg)
      return
    }
    const project = this.projects.find((candidate) => candidate.id === this.draggedProjectId)
    if (!project) {
      this.clearDropPreview(svg)
      return
    }
    const coordinateSpace = svg.querySelector<SVGGElement>(".map-coordinate-space")
    if (!coordinateSpace) {
      return
    }
    let preview = coordinateSpace.querySelector<SVGGElement>(".booth-drop-preview")
    if (!preview) {
      preview = document.createElementNS(svgNamespace, "g")
      preview.setAttribute("class", "booth-drop-preview")
      preview.append(
        document.createElementNS(svgNamespace, "rect"),
        document.createElementNS(svgNamespace, "text"),
      )
      coordinateSpace.append(preview)
    }
    const [frame, label] = preview.children
    frame?.setAttribute("x", String(target.x))
    frame?.setAttribute("y", String(target.y))
    frame?.setAttribute("width", String(target.width))
    frame?.setAttribute("height", String(target.height))
    frame?.setAttribute("rx", "16")
    label?.setAttribute("x", String(target.x + target.width / 2))
    label?.setAttribute("y", String(target.y + target.height * 0.58))
    if (svg.getAttribute("data-map-orientation") === "clockwise") {
      const centerX = target.x + target.width / 2
      const centerY = target.y + target.height / 2
      label?.setAttribute("transform", `rotate(-90 ${centerX} ${centerY})`)
    } else {
      label?.removeAttribute("transform")
    }
    label?.replaceChildren(project.ownerDisplayName)
  }

  private clearDropPreview(svg = this.root.querySelector<SVGSVGElement>(".admin-map")): void {
    svg?.querySelector(".booth-drop-preview")?.remove()
  }

  private bindMapEntries(svg: SVGSVGElement): void {
    const activateRoomEntry = (event: Event): void => {
      if (!(event.target instanceof Element)) {
        return
      }
      const roomName = event.target
        .closest<SVGGElement>("[data-room-name]")
        ?.getAttribute("data-room-name")
      if (!roomName) {
        return
      }
      void this.showRoomMap(roomName, svg)
    }

    svg.addEventListener("click", activateRoomEntry)
    svg.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return
      }
      if (
        event.target instanceof Element &&
        event.target.closest<SVGGElement>("[data-room-name]")
      ) {
        event.preventDefault()
        activateRoomEntry(event)
      }
    })
  }

  private async showRoomMap(roomName: string, svg: SVGSVGElement): Promise<void> {
    if (this.isMapTransitioning) {
      return
    }
    const room = this.state.rooms.find((candidate) => candidate.name === roomName)
    if (!room) {
      return
    }
    this.isMapTransitioning = true
    const floor = floorMaps[this.state.selectedFloorId]
    const target = roomViewBox(floor, room)
    const orientation = roomMapOrientation(target)
    try {
      await animateMapCamera(svg, floor, target, orientation, roomName, "enter")
    } finally {
      this.isMapTransitioning = false
    }
    this.mapView = { kind: "room", roomName }
    const firstRoomBooth = this.state.booths.find((booth) => booth.roomName === roomName)
    if (firstRoomBooth) {
      this.state.selectBooth(firstRoomBooth.id)
    } else {
      this.state.selectRoom(roomName)
    }
    this.renderCurrentFloor(svg)
  }

  private async showFloorMap(): Promise<void> {
    if (this.isMapTransitioning || this.mapView.kind !== "room") {
      return
    }
    const roomName = this.mapView.roomName
    const room = this.state.rooms.find((candidate) => candidate.name === roomName)
    const svg = this.root.querySelector<SVGSVGElement>(".admin-map")
    if (!room || !svg) {
      this.mapView = { kind: "floor" }
      this.renderCurrentFloor()
      return
    }
    const floor = floorMaps[this.state.selectedFloorId]
    const target = roomViewBox(floor, room)
    const orientation = roomMapOrientation(target)
    this.isMapTransitioning = true
    try {
      await animateMapCamera(svg, floor, target, orientation, room.name, "exit")
    } finally {
      this.isMapTransitioning = false
    }
    this.mapView = { kind: "floor" }
    this.renderCurrentFloor(svg)
  }

  private refreshAfterLayoutCommit(): void {
    if (this.syncMapViewAfterLayoutChange(this.state.selectedRoomName)) {
      this.renderCurrentFloor()
      return
    }
    this.updateDetailOverflowWarning()
    this.renderInspector()
  }

  private updateDetailOverflowWarning(): void {
    const panel = queryRequired<HTMLElement>(this.root, ".admin-map-panel")
    const existingWarning = panel.querySelector<HTMLElement>(".admin-map-panel__warning")
    if (this.mapView.kind !== "room") {
      existingWarning?.remove()
      return
    }
    const roomName = this.mapView.roomName
    const roomPresentation = [...panel.querySelectorAll<SVGGElement>(".room-presentation")].find(
      (presentation) => presentation.getAttribute("data-presentation-room") === roomName,
    )
    const renderedBooths = [
      ...(roomPresentation?.querySelectorAll<SVGGElement>(
        ".room-presentation__detail .booth-marker[data-booth-id]",
      ) ?? []),
    ].flatMap((marker) => {
      const frame = marker.querySelector<SVGRectElement>(".booth-marker__visual > rect")
      const booth = this.state.findBooth(marker.getAttribute("data-booth-id") ?? "")
      return frame && booth ? [{ booth, bounds: frame.getBoundingClientRect() }] : []
    })
    const overlapPairs = renderedBooths.flatMap((first, index) =>
      renderedBooths.slice(index + 1).flatMap((second) => {
        return screenBoundsOverlap(first.bounds, second.bounds)
          ? [`${first.booth.boothNumber} · ${second.booth.boothNumber}`]
          : []
      }),
    )
    if (overlapPairs.length === 0) {
      existingWarning?.remove()
      return
    }
    const warning = existingWarning ?? document.createElement("p")
    warning.className = "admin-map-panel__warning"
    warning.setAttribute("role", "status")
    warning.textContent = `겹치는 부스: ${overlapPairs.join(", ")}. 배치를 넓게 조정해 주세요.`
    if (!existingWarning) {
      panel.querySelector(".admin-map")?.before(warning)
    }
  }

  private syncMapViewAfterLayoutChange(roomName: string): boolean {
    const previousView = this.mapView
    const room = this.state.rooms.find((candidate) => candidate.name === roomName)
    if (!room) {
      this.mapView = { kind: "floor" }
      return !isSameMapView(previousView, this.mapView)
    }
    const floor = floorMaps[this.state.selectedFloorId]
    const viewBox = floorViewBox(floor)
    const presentation = calculateRoomPresentation(
      room,
      this.state.booths.filter((booth) => booth.roomName === roomName),
      viewBox,
      viewportForWidth(this.mapWidth, viewBox),
      false,
      "standard",
    )
    if (presentation.mode === "summary") {
      this.mapView = { kind: "room", roomName }
    } else if (this.mapView.kind === "room" && this.mapView.roomName !== roomName) {
      this.mapView = { kind: "floor" }
    }
    return !isSameMapView(previousView, this.mapView)
  }
}

function isSameMapView(first: MapViewState, second: MapViewState): boolean {
  return (
    first.kind === second.kind &&
    (first.kind === "floor" || (second.kind === "room" && first.roomName === second.roomName))
  )
}

function screenBoundsOverlap(first: DOMRect, second: DOMRect): boolean {
  const tolerance = 0.5
  return !(
    first.right <= second.left + tolerance ||
    second.right <= first.left + tolerance ||
    first.bottom <= second.top + tolerance ||
    second.bottom <= first.top + tolerance
  )
}
