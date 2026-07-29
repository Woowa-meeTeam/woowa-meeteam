import { floorMaps } from "./booth-data"
import { renderBoothDetail } from "./booth-detail-template"
import { findMeeteamProject, type MeeteamProject } from "./integrations/meeteam/project-source"
import {
  calculateRoomPresentation,
  displayViewBox,
  floorViewBox,
  roomMapOrientation,
  roomViewBox,
  viewportForWidth,
} from "./map-readability"
import { animateMapCamera, syncMapBackgroundLabelOrientation } from "./map-view-transition"
import { type Booth, type BoothLayout, type FloorId, floorIds, type MapViewState } from "./model"
import { roomsByFloor } from "./room-data"
import { queryRequired, renderMapPanel, renderShell } from "./view-templates"

type ReactionKind = "LIKE" | "BOOKMARK"

type BoothMapAppOptions = {
  readonly initialProjectId?: string | null
  readonly onToggleReaction?: (
    projectId: string,
    kind: ReactionKind,
    nextValue: boolean,
  ) => Promise<void>
}

export class BoothMapApp {
  private readonly root: HTMLDivElement
  private projects: MeeteamProject[]
  private readonly layout: BoothLayout
  private readonly onToggleReaction?: BoothMapAppOptions["onToggleReaction"]
  private selectedFloorId: FloorId = 11
  private selectedBoothId: string | null
  private mapView: MapViewState = { kind: "floor" }
  private mapWidth = 1
  private isMapTransitioning = false
  private readonly resizeObserver: ResizeObserver

  public constructor(
    root: HTMLDivElement,
    projects: readonly MeeteamProject[],
    layout: BoothLayout,
    options: BoothMapAppOptions = {},
  ) {
    this.root = root
    this.projects = [...projects]
    this.layout = layout
    this.onToggleReaction = options.onToggleReaction
    const initialLocation = this.findBoothLocation(options.initialProjectId)
    this.selectedFloorId = initialLocation?.floorId ?? 11
    this.selectedBoothId = initialLocation?.booth.id ?? null
    this.mapView = initialLocation
      ? { kind: "room", roomName: initialLocation.booth.roomName }
      : { kind: "floor" }
    this.renderShell()
    this.bindFloorButtons()
    const mapPanel = queryRequired<HTMLElement>(this.root, ".map-panel")
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
      this.renderCurrentFloor()
    })
    this.resizeObserver.observe(mapPanel)
    this.renderCurrentFloor()
  }

  private findBoothLocation(projectId: string | null | undefined): {
    readonly floorId: FloorId
    readonly booth: Booth
  } | null {
    if (!projectId) {
      return null
    }
    for (const floorId of floorIds) {
      const booth = this.layout[floorId].find((candidate) => candidate.projectId === projectId)
      if (booth) {
        return { floorId, booth }
      }
    }
    return null
  }

  public destroy(): void {
    this.resizeObserver.disconnect()
    this.root.replaceChildren()
  }

  private renderShell(): void {
    this.root.innerHTML = renderShell(this.selectedFloorId)
  }

  private bindFloorButtons(): void {
    for (const floorId of floorIds) {
      const button = queryRequired<HTMLButtonElement>(this.root, `[data-floor-id="${floorId}"]`)
      button.addEventListener("click", () => {
        this.selectedFloorId = floorId
        this.selectedBoothId = null
        this.mapView = { kind: "floor" }
        this.updateFloorButtonStates()
        this.renderCurrentFloor()
      })
    }
  }

  private renderCurrentFloor(preservedSvg?: SVGSVGElement): void {
    const floor = floorMaps[this.selectedFloorId]
    const booths = this.layout[this.selectedFloorId]
    const rooms = roomsByFloor[this.selectedFloorId]
    const mapPanel = queryRequired<HTMLElement>(this.root, ".map-panel")
    const mapView = this.mapView
    const activeRoom =
      mapView.kind === "room" ? rooms.find((room) => room.name === mapView.roomName) : undefined
    if (this.mapView.kind === "room" && !activeRoom) {
      this.mapView = { kind: "floor" }
    }
    const viewBox = activeRoom ? roomViewBox(floor, activeRoom) : floorViewBox(floor)
    const orientation = activeRoom ? roomMapOrientation(viewBox) : "standard"
    const viewport = viewportForWidth(this.mapWidth, displayViewBox(viewBox, orientation))
    const floorBox = floorViewBox(floor)
    const floorViewport = viewportForWidth(this.mapWidth, floorBox)
    const roomPresentations = rooms.map((room) => {
      const isActiveRoom = activeRoom?.name === room.name
      return calculateRoomPresentation(
        room,
        booths.filter((booth) => booth.roomName === room.name),
        isActiveRoom ? viewBox : floorBox,
        isActiveRoom ? viewport : floorViewport,
        isActiveRoom,
        isActiveRoom ? orientation : "standard",
      )
    })

    preservedSvg?.remove()
    mapPanel.innerHTML = renderMapPanel({
      floor,
      booths,
      projects: this.projects,
      selectedBoothId: this.selectedBoothId,
      rooms,
      view: this.mapView,
      viewBox,
      orientation,
      roomPresentations,
      floorProjectionScale: floorViewport.width / floorBox.width,
    })

    const renderedSvg = queryRequired<SVGSVGElement>(mapPanel, ".map-canvas")
    if (preservedSvg) {
      renderedSvg.replaceWith(preservedSvg)
    }
    const svg = preservedSvg ?? renderedSvg
    if (!preservedSvg) {
      this.bindMapInteractions(svg)
    }
    syncMapBackgroundLabelOrientation(
      svg,
      activeRoom?.name ?? null,
      activeRoom ? orientation : "standard",
    )
    mapPanel
      .querySelector<HTMLButtonElement>('[data-map-action="floor"]')
      ?.addEventListener("click", () => void this.showFloorMap())
    this.updateMarkerStates()
    this.renderBoothDetail()
    const scopeName = activeRoom ? `${floor.label} ${activeRoom.name}` : floor.label
    const visibleCount = activeRoom
      ? booths.filter((booth) => booth.roomName === activeRoom.name).length
      : booths.length
    this.updateLiveStatus(`${scopeName} 지도를 표시했습니다. 부스는 ${visibleCount}개입니다.`)
  }

  private bindMapInteractions(svg: SVGSVGElement): void {
    svg.addEventListener("click", (event) => {
      this.activateMapTarget(event)
    })
    svg.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return
      }
      event.preventDefault()
      this.activateMapTarget(event)
    })
  }

  private activateMapTarget(event: Event): void {
    const roomName = this.getRoomNameFromEvent(event)
    if (roomName !== null) {
      void this.showRoomMap(roomName)
      return
    }

    const boothId = this.getBoothIdFromEvent(event)
    if (boothId !== null) {
      this.selectBooth(boothId)
      return
    }

    this.clearSelection()
  }

  private getBoothIdFromEvent(event: Event): string | null {
    if (!(event.target instanceof Element)) {
      return null
    }

    const marker = event.target.closest<SVGGElement>("[data-booth-id]")
    return marker?.getAttribute("data-booth-id") ?? null
  }

  private getRoomNameFromEvent(event: Event): string | null {
    if (!(event.target instanceof Element)) {
      return null
    }

    const entry = event.target.closest<SVGGElement>("[data-room-name]")
    return entry?.getAttribute("data-room-name") ?? null
  }

  private async showRoomMap(roomName: string): Promise<void> {
    if (this.isMapTransitioning) {
      return
    }
    const room = roomsByFloor[this.selectedFloorId].find((candidate) => candidate.name === roomName)
    if (!room) {
      return
    }

    const svg = this.root.querySelector<SVGSVGElement>(".map-canvas")
    if (!svg) {
      return
    }
    const floor = floorMaps[this.selectedFloorId]
    const target = roomViewBox(floor, room)
    const orientation = roomMapOrientation(target)
    this.isMapTransitioning = true
    try {
      await animateMapCamera(svg, floor, target, orientation, roomName, "enter")
    } finally {
      this.isMapTransitioning = false
    }
    this.mapView = { kind: "room", roomName }
    this.selectedBoothId = null
    this.renderCurrentFloor(svg)
  }

  private async showFloorMap(): Promise<void> {
    if (this.isMapTransitioning || this.mapView.kind !== "room") {
      return
    }
    const roomName = this.mapView.roomName
    const room = roomsByFloor[this.selectedFloorId].find((candidate) => candidate.name === roomName)
    const svg = this.root.querySelector<SVGSVGElement>(".map-canvas")
    if (!room || !svg) {
      this.mapView = { kind: "floor" }
      this.renderCurrentFloor()
      return
    }
    const floor = floorMaps[this.selectedFloorId]
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

  private selectBooth(boothId: string): void {
    const booth = this.layout[this.selectedFloorId].find((candidate) => candidate.id === boothId)
    if (!booth) {
      return
    }

    this.selectedBoothId = booth.id
    this.updateMarkerStates()
    this.renderBoothDetail()
    const project = findMeeteamProject(this.projects, booth.projectId)
    const displayName = project?.ownerDisplayName ?? "프로젝트 정보가 없는"
    this.updateLiveStatus(`${displayName} 부스를 선택했습니다. ${booth.roomName}에 있습니다.`)
  }

  private clearSelection(): void {
    if (this.selectedBoothId === null) {
      return
    }

    this.selectedBoothId = null
    this.updateMarkerStates()
    this.renderBoothDetail()
    this.updateLiveStatus("부스 선택을 해제했습니다.")
  }

  private renderBoothDetail(): void {
    const detail = queryRequired<HTMLElement>(this.root, ".booth-detail")
    const booth = this.layout[this.selectedFloorId].find(
      (candidate) => candidate.id === this.selectedBoothId,
    )

    const project = booth ? findMeeteamProject(this.projects, booth.projectId) : undefined
    detail.innerHTML = renderBoothDetail(booth, project)
    this.bindReactionButtons(detail)
  }

  private bindReactionButtons(detail: HTMLElement): void {
    for (const button of detail.querySelectorAll<HTMLButtonElement>("[data-reaction-kind]")) {
      button.addEventListener("click", () => void this.toggleReaction(button))
    }
  }

  private async toggleReaction(button: HTMLButtonElement): Promise<void> {
    const kind = button.dataset.reactionKind
    const projectId = button.dataset.reactionProjectId
    if ((kind !== "LIKE" && kind !== "BOOKMARK") || !projectId) {
      return
    }

    const project = findMeeteamProject(this.projects, projectId)
    if (!project) {
      return
    }

    const nextValue = kind === "LIKE" ? !project.myLike : !project.myBookmark
    const detail = queryRequired<HTMLElement>(this.root, ".booth-detail")
    const message = detail.querySelector<HTMLElement>("[data-reaction-message]")
    button.disabled = true
    if (message) {
      message.hidden = true
      message.textContent = ""
    }

    try {
      await this.onToggleReaction?.(projectId, kind, nextValue)
      this.applyReaction(projectId, kind, nextValue)
      this.renderCurrentFloor()
      this.updateLiveStatus(
        `${project.title} ${kind === "LIKE" ? "좋아요" : "북마크"}를 ${nextValue ? "표시했습니다" : "해제했습니다"}.`,
      )
    } catch (error) {
      button.disabled = false
      const errorMessage = error instanceof Error ? error.message : "처리에 실패했어요."
      if (message) {
        message.textContent = errorMessage
        message.hidden = false
      }
      this.updateLiveStatus(errorMessage)
    }
  }

  private applyReaction(projectId: string, kind: ReactionKind, nextValue: boolean): void {
    this.projects = this.projects.map((project) => {
      if (project.id !== projectId) {
        return project
      }
      if (kind === "LIKE") {
        return {
          ...project,
          myLike: nextValue,
          likes: Math.max(0, project.likes + (nextValue ? 1 : -1)),
        }
      }
      return {
        ...project,
        myBookmark: nextValue,
        bookmarks: Math.max(0, project.bookmarks + (nextValue ? 1 : -1)),
      }
    })
  }

  private updateFloorButtonStates(): void {
    for (const floorId of floorIds) {
      const button = queryRequired<HTMLButtonElement>(this.root, `[data-floor-id="${floorId}"]`)
      button.setAttribute("aria-selected", String(floorId === this.selectedFloorId))
    }
  }

  private updateMarkerStates(): void {
    for (const marker of this.root.querySelectorAll<SVGGElement>("[data-booth-id]")) {
      const isSelected = marker.getAttribute("data-booth-id") === this.selectedBoothId
      marker.setAttribute("data-selected", String(isSelected))
      marker.setAttribute("aria-pressed", String(isSelected))
    }
  }

  private updateLiveStatus(message: string): void {
    queryRequired<HTMLElement>(this.root, "[data-live-status]").textContent = message
  }
}
