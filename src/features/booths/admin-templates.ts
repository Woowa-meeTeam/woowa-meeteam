import { renderProjectSummary } from "./admin-project-templates"
import type { LayoutStorageMode } from "./booth-layout-repository"
import { findMeeteamProject, type MeeteamProject } from "./integrations/meeteam/project-source"
import { mapCameraTransform } from "./map-readability"
import type { Booth, BoothSize, FloorId, RoomDefinition } from "./model"
import { boothSizeLimits, floorIds } from "./model"
import { escapeMarkup } from "./project-templates"
import { type BoothMapViewModel, renderMapLayers } from "./view-templates"

export type AdminInspectorViewModel = {
  readonly booth: Booth | undefined
  readonly rooms: readonly RoomDefinition[]
  readonly selectedRoomName: string
  readonly roomSize: BoothSize
  readonly isRoomSizeUniform: boolean
  readonly projects: readonly MeeteamProject[]
  readonly isSaved: boolean
}

function renderAdminFloorButton(floorId: FloorId, selectedFloorId: FloorId): string {
  return `
    <button
      class="floor-button"
      type="button"
      role="tab"
      aria-selected="${floorId === selectedFloorId}"
      data-admin-floor-id="${floorId}"
    >
      ${floorId}층
    </button>
  `
}

function renderRoomOptions(rooms: readonly RoomDefinition[], selectedRoomName: string): string {
  return rooms
    .map(
      (room) => `
        <option value="${escapeMarkup(room.name)}" ${room.name === selectedRoomName ? "selected" : ""}>
          ${escapeMarkup(room.name)}
        </option>
      `,
    )
    .join("")
}

export function renderAdminShell(selectedFloorId: FloorId, storageMode: LayoutStorageMode): string {
  const storageStatus =
    storageMode === "supabase"
      ? "Supabase에 초안을 저장하고, 게시한 배치만 공개 지도에 표시합니다."
      : "Supabase 환경변수가 없어 이 브라우저에서 초안·게시 흐름을 미리 사용하고 있습니다."
  return `
    <div class="admin-shell">
      <header class="admin-header">
        <div>
          <p class="site-label">BOOTH PLACEMENT ADMIN</p>
          <h1>
            <span>팀을 지도 위에</span>
            <span class="gradient-text">배치하세요.</span>
          </h1>
          <p>공간별로 부스 크기 통일 여부를 선택할 수 있습니다.</p>
        </div>
        <div class="admin-header__actions">
          <button type="button" class="admin-secondary" data-admin-action="save">초안 저장</button>
          <button type="button" class="admin-save" data-admin-action="publish">게시</button>
        </div>
      </header>

      <div class="admin-status glass-panel" role="status" data-admin-status>
        ${storageStatus}
      </div>

      <div class="admin-floor-row">
        <div class="floor-selector" role="tablist" aria-label="편집할 층 선택">
          ${floorIds.map((floorId) => renderAdminFloorButton(floorId, selectedFloorId)).join("")}
        </div>
        <p>미배치 부스를 지도에 끌어놓고, 배치된 부스는 드래그로 위치를 조정하세요.</p>
      </div>

      <section
        class="admin-booth-tray glass-panel"
        aria-label="미배치 부스"
        data-admin-booth-tray
      ></section>

      <main class="admin-layout">
        <section class="admin-map-panel glass-panel" aria-label="부스 배치 지도"></section>
        <aside class="admin-inspector glass-panel" aria-label="부스 편집 패널"></aside>
      </main>
    </div>
  `
}

export function renderAdminBoothTray(projects: readonly MeeteamProject[]): string {
  return `
    <div class="admin-booth-tray__header">
      <div>
        <p>미배치 부스</p>
        <strong>지도 위 원하는 공간으로 끌어다 놓으세요.</strong>
      </div>
      <span>${projects.length}개 남음</span>
    </div>
    <div class="admin-booth-tray__list">
      ${
        projects.length > 0
          ? projects
              .map(
                (project) => `
                  <article
                    class="admin-booth-card"
                    draggable="true"
                    data-project-id="${escapeMarkup(project.id)}"
                    title="${escapeMarkup(`${project.ownerDisplayName} · ${project.title}`)}"
                  >
                    <div class="admin-booth-card__icon">
                      <span aria-hidden="true">⋮⋮</span>
                      <strong>${escapeMarkup(project.ownerDisplayName)}</strong>
                    </div>
                    <p>${escapeMarkup(project.title)}</p>
                  </article>
                `,
              )
              .join("")
          : '<p class="admin-booth-tray__empty">모든 프로젝트가 지도에 배치되었습니다.</p>'
      }
    </div>
  `
}

export function renderAdminMap(viewModel: BoothMapViewModel): string {
  const { floor, booths, view, viewBox, orientation } = viewModel
  const mapTransform = mapCameraTransform(floor, viewBox, orientation)
  const activeRoom =
    view.kind === "room" ? viewModel.rooms.find((room) => room.name === view.roomName) : undefined
  const visibleBoothCount =
    view.kind === "room"
      ? booths.filter((booth) => booth.roomName === view.roomName).length
      : booths.length
  return `
    <div class="admin-map-panel__header">
      <div>
        <strong>${floor.label}${activeRoom ? ` · ${escapeMarkup(activeRoom.name)}` : ""}</strong>
        <span>부스 ${visibleBoothCount}개</span>
      </div>
      ${
        activeRoom
          ? '<button type="button" class="admin-secondary" data-admin-map-action="floor">층 전체 보기</button>'
          : "<span>초안을 저장한 뒤 게시해야 공개 지도에 반영됩니다.</span>"
      }
    </div>
    <svg
      class="admin-map"
      viewBox="0 0 ${floor.width} ${floor.height}"
      style="--map-aspect: ${floor.width} / ${floor.height}"
      data-map-orientation="${orientation}"
      role="img"
      aria-label="${floor.label} 부스 배치 편집 지도"
      preserveAspectRatio="xMidYMid meet"
    >
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
        <g class="booth-alignment-guides" aria-hidden="true"></g>
        <g class="booth-layer">
          ${renderMapLayers(viewModel)}
        </g>
      </g>
    </svg>
  `
}

export function renderAdminInspector(viewModel: AdminInspectorViewModel): string {
  const booth = viewModel.booth
  const boothProject = booth ? findMeeteamProject(viewModel.projects, booth.projectId) : undefined
  return `
    <section class="admin-control-section">
      <div class="admin-section-heading">
        <div>
          <p>공간 설정</p>
          <h2>${escapeMarkup(viewModel.selectedRoomName)}</h2>
        </div>
      </div>

      <label class="admin-field">
        <span>크기를 설정할 공간</span>
        <select data-admin-room>
          ${renderRoomOptions(viewModel.rooms, viewModel.selectedRoomName)}
        </select>
      </label>

      <label class="admin-check">
        <input
          type="checkbox"
          data-room-size-uniform
          ${viewModel.isRoomSizeUniform ? "checked" : ""}
        />
        <span>이 공간의 부스 크기 통일</span>
      </label>

      ${
        viewModel.isRoomSizeUniform
          ? `
            <div class="admin-size-grid">
              <label class="admin-field">
                <span>공통 너비</span>
                <input type="number" min="${boothSizeLimits.minWidth}" max="${boothSizeLimits.maxWidth}" step="4" value="${viewModel.roomSize.width}" data-room-width />
              </label>
              <label class="admin-field">
                <span>공통 높이</span>
                <input type="number" min="${boothSizeLimits.minHeight}" max="${boothSizeLimits.maxHeight}" step="4" value="${viewModel.roomSize.height}" data-room-height />
              </label>
            </div>
            <p class="admin-field-help">공간의 모든 부스가 같은 크기로 바뀝니다. 지도에서 모서리 핸들을 드래그해서 조절할 수도 있습니다.</p>
          `
          : `
            <p class="admin-field-help">부스마다 다른 크기를 사용합니다. 지도에서 모서리 핸들을 드래그하거나, 부스를 선택해 크기를 입력하세요.</p>
          `
      }
    </section>

    <section class="admin-control-section admin-booth-editor">
      ${
        booth
          ? `
            <div class="admin-section-heading">
              <div>
                <p>선택한 부스</p>
                <h2>${escapeMarkup(booth.boothNumber)}</h2>
              </div>
              <div class="admin-booth-editor__actions">
                <button type="button" class="admin-secondary" data-admin-action="align-column">이 열 자동 정렬</button>
                <button type="button" class="admin-secondary" data-admin-action="align-row">이 행 자동 정렬</button>
                <button type="button" class="admin-danger" data-admin-action="delete">삭제</button>
              </div>
            </div>

            <label class="admin-field">
              <span>배치 공간</span>
              <select data-booth-room>
                ${renderRoomOptions(viewModel.rooms, booth.roomName)}
              </select>
            </label>
            ${
              viewModel.isRoomSizeUniform
                ? ""
                : `
                  <div class="admin-size-grid">
                    <label class="admin-field">
                      <span>부스 너비</span>
                      <input type="number" min="${boothSizeLimits.minWidth}" max="${boothSizeLimits.maxWidth}" step="4" value="${booth.width}" data-booth-width />
                    </label>
                    <label class="admin-field">
                      <span>부스 높이</span>
                      <input type="number" min="${boothSizeLimits.minHeight}" max="${boothSizeLimits.maxHeight}" step="4" value="${booth.height}" data-booth-height />
                    </label>
                  </div>
                `
            }
            ${renderProjectSummary(boothProject)}
          `
          : `
            <div class="admin-empty">
              <p>선택한 부스가 없습니다.</p>
              <span>미배치 부스를 지도에 끌어놓거나, 배치된 부스를 선택하세요.</span>
            </div>
          `
      }
    </section>

    <p class="admin-save-state" data-saved="${viewModel.isSaved}">
      ${viewModel.isSaved ? "초안이 저장된 상태입니다." : "저장하지 않은 초안 변경사항이 있습니다."}
    </p>
  `
}
