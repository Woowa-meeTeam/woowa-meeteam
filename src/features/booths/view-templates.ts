import type { MeeteamProject } from "./integrations/meeteam/project-source"
import { findMeeteamProject } from "./integrations/meeteam/project-source"
import {
  boothLabelMetrics,
  mapCameraTransform,
  type RoomPresentation,
  roomMapOrientation,
  roomViewBox,
} from "./map-readability"
import type {
  Booth,
  BoothBounds,
  FloorId,
  FloorMap,
  MapOrientation,
  MapViewState,
  RoomDefinition,
} from "./model"
import { floorIds } from "./model"
import { escapeMarkup } from "./project-templates"

export type BoothMapViewModel = {
  readonly floor: FloorMap
  readonly booths: readonly Booth[]
  readonly projects: readonly MeeteamProject[]
  readonly selectedBoothId: string | null
  readonly rooms: readonly RoomDefinition[]
  readonly view: MapViewState
  readonly viewBox: BoothBounds
  readonly orientation: MapOrientation
  readonly roomPresentations: readonly RoomPresentation[]
  readonly floorProjectionScale: number
}

class DomContractError extends Error {
  public constructor(selector: string) {
    super(`필수 화면 요소를 찾을 수 없습니다: ${selector}`)
    this.name = "DomContractError"
  }
}

function renderFloorButton(floorId: FloorId, selectedFloorId: FloorId): string {
  const isSelected = floorId === selectedFloorId
  return `
    <button
      class="floor-button"
      type="button"
      role="tab"
      aria-selected="${isSelected}"
      data-floor-id="${floorId}"
    >
      ${floorId}층
    </button>
  `
}

export function renderBoothMarker(
  booth: Booth,
  project: MeeteamProject | undefined,
  selectedBoothId: string | null,
  markerScale = 1,
  orientation: MapOrientation = "standard",
  projectionScale = 1,
): string {
  const isSelected = booth.id === selectedBoothId
  const displayName = project?.ownerDisplayName ?? "프로젝트 정보 없음"
  const centerX = booth.x + booth.width / 2
  const centerY = booth.y + booth.height / 2
  const cornerRadius = Math.min(8, booth.width / 5, booth.height / 4)
  const labelProjectionScale = projectionScale * markerScale
  const labels = boothLabelMetrics(booth, orientation, displayName, labelProjectionScale)
  const transform =
    markerScale === 1
      ? ""
      : `transform="translate(${centerX} ${centerY}) scale(${markerScale}) translate(${-centerX} ${-centerY})"`
  const labelTransform =
    orientation === "clockwise" ? `transform="rotate(-90 ${centerX} ${centerY})"` : ""
  const reactionLabel =
    project?.myLike && project.myBookmark
      ? ", 좋아요와 북마크한 프로젝트"
      : project?.myLike
        ? ", 좋아요한 프로젝트"
        : project?.myBookmark
          ? ", 북마크한 프로젝트"
          : ""
  return `
    <g
      class="booth-marker"
      role="button"
      tabindex="0"
      aria-label="${escapeMarkup(`${displayName}, ${booth.roomName}${reactionLabel}`)}"
      aria-pressed="${isSelected}"
      data-selected="${isSelected}"
      data-booth-id="${escapeMarkup(booth.id)}"
      data-marker-scale="${markerScale}"
      data-label-projection-scale="${labelProjectionScale}"
      data-map-orientation="${orientation}"
    >
      <g class="booth-marker__visual" ${transform}>
        <rect
          x="${booth.x}"
          y="${booth.y}"
          width="${booth.width}"
          height="${booth.height}"
          rx="${cornerRadius}"
        />
        <text class="booth-marker__team" x="${centerX}" y="${labels.teamY}" style="font-size: ${labels.teamFontSize}px" ${labelTransform}>
          ${escapeMarkup(displayName)}
        </text>
      </g>
    </g>
  `
}

function renderRoomEntry(presentation: RoomPresentation, floorProjectionScale: number): string {
  const { room, booths } = presentation
  const projectionScale = floorProjectionScale
  const cardWidth = Math.min(room.bounds.width * 0.9, 184 / projectionScale)
  const cardHeight = Math.min(room.bounds.height * 0.72, 76 / projectionScale)
  const x = room.bounds.x + (room.bounds.width - cardWidth) / 2
  const y = room.bounds.y + (room.bounds.height - cardHeight) / 2
  const countLabel = `${booths.length}개 · 보기`
  const cardScreenWidth = cardWidth * projectionScale
  const titleSize = fitRoomEntryFontSize(room.name, cardScreenWidth, 11, 16) / projectionScale
  const countSize = fitRoomEntryFontSize(countLabel, cardScreenWidth, 9, 12) / projectionScale
  const titleY = y + cardHeight * 0.45
  const countY = y + cardHeight * 0.72

  return `
    <g
      class="room-entry"
      role="button"
      tabindex="0"
      aria-label="${escapeMarkup(`${room.name} 상세 지도, 부스 ${booths.length}개`)}"
      data-room-name="${escapeMarkup(room.name)}"
    >
      <rect
        x="${x}"
        y="${y}"
        width="${cardWidth}"
        height="${cardHeight}"
        rx="${14 / projectionScale}"
      />
      <text class="room-entry__title" x="${x + cardWidth / 2}" y="${titleY}" style="font-size: ${titleSize}px">
        ${escapeMarkup(room.name)}
      </text>
      <text class="room-entry__count" x="${x + cardWidth / 2}" y="${countY}" style="font-size: ${countSize}px">
        ${countLabel}
      </text>
    </g>
  `
}

function fitRoomEntryFontSize(
  text: string,
  cardScreenWidth: number,
  minimum: number,
  maximum: number,
): number {
  const textWidthUnits = Math.max(
    1,
    [...text].reduce((total, character) => total + (/[A-Za-z0-9]/.test(character) ? 0.62 : 1), 0),
  )
  return Math.min(maximum, Math.max(minimum, (cardScreenWidth * 0.78) / textWidthUnits))
}

export function renderMapLayers(viewModel: BoothMapViewModel): string {
  const {
    floor,
    booths,
    projects,
    selectedBoothId,
    roomPresentations,
    floorProjectionScale,
    view,
    orientation,
  } = viewModel
  const boothById = new Map(booths.map((booth) => [booth.id, booth]))
  const renderedIds = new Set<string>()
  const layers = roomPresentations.flatMap((presentation) => {
    for (const booth of presentation.booths) {
      renderedIds.add(booth.id)
    }

    const isActiveRoom = view.kind === "room" && view.roomName === presentation.room.name
    return [
      renderRoomPresentation(
        presentation,
        projects,
        selectedBoothId,
        isActiveRoom ? "detail" : "summary",
        isActiveRoom ? orientation : roomMapOrientation(roomViewBox(floor, presentation.room)),
        view.kind === "room" && !isActiveRoom,
        floorProjectionScale,
      ),
    ]
  })

  const unassignedBooths: string[] = []
  for (const booth of boothById.values()) {
    if (!renderedIds.has(booth.id)) {
      unassignedBooths.push(
        renderBoothMarker(
          booth,
          findMeeteamProject(projects, booth.projectId),
          selectedBoothId,
          1,
          orientation,
          floorProjectionScale,
        ),
      )
    }
  }
  if (unassignedBooths.length > 0) {
    layers.push(`
      <g
        class="map-unassigned-layer"
        style="opacity: ${view.kind === "room" ? 0 : 1}; pointer-events: ${view.kind === "room" ? "none" : "auto"}"
      >
        ${unassignedBooths.join("")}
      </g>
    `)
  }

  return layers.join("")
}

function renderRoomPresentation(
  presentation: RoomPresentation,
  projects: readonly MeeteamProject[],
  selectedBoothId: string | null,
  state: "summary" | "detail",
  detailOrientation: MapOrientation,
  hidden: boolean,
  floorProjectionScale: number,
): string {
  const isSummary = state === "summary"
  const summaryContent =
    (state === "detail" || presentation.mode === "summary") && presentation.booths.length > 0
      ? renderRoomEntry(presentation, floorProjectionScale)
      : renderRoomBooths(presentation, projects, selectedBoothId, "standard", false).join("")
  return `
    <g
      class="room-presentation"
      data-presentation-room="${escapeMarkup(presentation.room.name)}"
      data-presentation-state="${state}"
      style="opacity: ${hidden ? 0 : 1}; pointer-events: ${hidden ? "none" : "auto"}"
    >
      <g
        class="room-presentation__summary"
        style="opacity: ${isSummary ? 1 : 0}; pointer-events: ${isSummary ? "auto" : "none"}"
      >
        ${summaryContent}
      </g>
      <g
        class="room-presentation__detail"
        style="opacity: ${isSummary ? 0 : 1}; pointer-events: ${isSummary ? "none" : "auto"}"
      >
        ${renderRoomBooths(
          presentation,
          projects,
          selectedBoothId,
          detailOrientation,
          // 상세 지도에서는 저장된 부스 크기를 그대로 보여 줍니다.
          // 화면 가독성용 확대 스케일이 부스 추가 전후 크기를 바꾸어 보이게 하지 않습니다.
          true,
        ).join("")}
      </g>
    </g>
  `
}

function renderRoomBooths(
  presentation: RoomPresentation,
  projects: readonly MeeteamProject[],
  selectedBoothId: string | null,
  orientation: MapOrientation,
  preview: boolean,
): string[] {
  return presentation.booths.map((booth) =>
    renderBoothMarker(
      booth,
      findMeeteamProject(projects, booth.projectId),
      selectedBoothId,
      preview ? 1 : (presentation.markerScales[booth.id] ?? 1),
      orientation,
      preview ? 1 : presentation.projectionScale,
    ),
  )
}

export function queryRequired<T extends Element>(parent: ParentNode, selector: string): T {
  const element = parent.querySelector<T>(selector)
  if (!element) {
    throw new DomContractError(selector)
  }
  return element
}

export function renderShell(selectedFloorId: FloorId): string {
  return `
    <svg class="global-filters" aria-hidden="true">
      <defs>
        <filter id="aura-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0"
          />
          <feComposite in2="SourceGraphic" operator="in" result="noise" />
          <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
        </filter>
      </defs>
    </svg>
    <div class="app-shell">
      <section class="booth-section" id="booth-map" aria-labelledby="booth-section-title">
        <div class="booth-section__header">
          <div>
            <p class="site-label">OFFLINE BOOTH GUIDE</p>
            <h2 id="booth-section-title">층별 부스 지도</h2>
            <p>찾고 싶은 팀이 있는 층을 선택해 주세요.</p>
          </div>
          <div class="floor-selector" role="tablist" aria-label="층 선택">
            ${floorIds.map((floorId) => renderFloorButton(floorId, selectedFloorId)).join("")}
          </div>
        </div>

        <div class="status-note glass-panel" role="note">
          <span class="status-note__dot" aria-hidden="true"></span>
          <strong>meeTeam 연동</strong>
          <span>등록된 프로젝트 중 관리자가 배치한 부스만 표시됩니다.</span>
        </div>

        <main class="viewer-layout">
          <section class="map-panel glass-panel" aria-label="층별 지도"></section>
          <aside
            class="booth-detail glass-panel"
            aria-label="선택한 부스 정보"
            tabindex="-1"
          ></aside>
        </main>
      </section>

      <p class="sr-only" aria-live="polite" data-live-status></p>
    </div>
  `
}

export function renderMapPanel(viewModel: BoothMapViewModel): string {
  const { floor, booths, view, viewBox, orientation, roomPresentations } = viewModel
  const mapTransform = mapCameraTransform(floor, viewBox, orientation)
  const activeRoom =
    view.kind === "room" ? viewModel.rooms.find((room) => room.name === view.roomName) : undefined
  const visibleBoothCount =
    view.kind === "room"
      ? booths.filter((booth) => booth.roomName === view.roomName).length
      : booths.length
  const detailOverflow =
    view.kind === "room" && roomPresentations.some((presentation) => presentation.hasOverlap)
  return `
    <div class="map-panel__header">
      <div>
        <p class="map-panel__floor">
          ${floor.label}${activeRoom ? ` · ${escapeMarkup(activeRoom.name)}` : ""}
        </p>
        <p class="map-panel__count">부스 ${visibleBoothCount}개</p>
      </div>
      ${
        activeRoom
          ? '<button type="button" class="map-panel__back" data-map-action="floor">층 전체 보기</button>'
          : ""
      }
    </div>
    ${
      detailOverflow
        ? '<p class="map-panel__warning" role="status">이 공간은 부스가 매우 촘촘합니다. 번호와 팀명을 확인한 뒤 부스를 선택해 주세요.</p>'
        : ""
    }

    <div class="map-frame">
      <svg
        class="map-canvas"
        viewBox="0 0 ${floor.width} ${floor.height}"
        style="--map-aspect: ${floor.width} / ${floor.height}"
        data-map-orientation="${orientation}"
        role="img"
        aria-labelledby="map-title map-description"
        preserveAspectRatio="xMidYMid meet"
        >
          <title id="map-title">${floor.label} 부스 지도</title>
          <desc id="map-description">
            부스를 선택하면 해당 팀의 프로젝트와 위치 정보를 확인할 수 있습니다.
          </desc>
        <defs>
          <linearGradient id="booth-marker-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#ffffff" stop-opacity="0.58" />
            <stop offset="0.3" stop-color="#ffffff" stop-opacity="0.4" />
            <stop offset="0.72" stop-color="#e7edf2" stop-opacity="0.3" />
            <stop offset="1" stop-color="#c7d0d8" stop-opacity="0.34" />
          </linearGradient>
          <linearGradient id="booth-marker-glass-selected" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#ffffff" stop-opacity="0.74" />
            <stop offset="0.32" stop-color="#ffffff" stop-opacity="0.58" />
            <stop offset="0.72" stop-color="#edf2f5" stop-opacity="0.48" />
            <stop offset="1" stop-color="#d4dde4" stop-opacity="0.52" />
          </linearGradient>
        </defs>
        <g class="map-coordinate-space" ${mapTransform ? `transform="${mapTransform}"` : ""}>
          <g class="map-background" aria-hidden="true">
            ${floor.mapMarkup}
          </g>
          <g class="booth-layer">
            ${renderMapLayers(viewModel)}
          </g>
        </g>
      </svg>
    </div>
  `
}
