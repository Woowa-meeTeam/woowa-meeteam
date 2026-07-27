import type { MeeteamProject } from "./integrations/meeteam/project-source"
import type { Booth } from "./model"
import { summarizeProjectDescription } from "./project-summary"
import {
  escapeMarkup,
  renderProjectActions,
  renderProjectCover,
  renderProjectOwner,
} from "./project-templates"

export function renderBoothDetail(
  booth: Booth | undefined,
  project: MeeteamProject | undefined,
): string {
  if (!booth) {
    return `
      <div class="booth-detail__empty">
        <p class="booth-detail__kicker">부스 정보</p>
        <h2>지도에서 부스를 선택해 주세요.</h2>
        <p>선택한 팀의 프로젝트와 위치가 여기에 표시됩니다.</p>
      </div>
    `
  }

  if (!project) {
    return `
      <div class="booth-detail__topline">
        <span>${escapeMarkup(booth.boothNumber)}</span>
        <span>${booth.floorId}층 ${escapeMarkup(booth.roomName)}</span>
      </div>
      <div class="booth-detail__empty">
        <p class="booth-detail__kicker">프로젝트 연결 확인 필요</p>
        <h2>프로젝트 정보를 불러올 수 없습니다.</h2>
        <p>관리자 화면에서 이 부스에 사용할 프로젝트를 다시 선택해 주세요.</p>
      </div>
    `
  }

  return `
    <div class="booth-detail__topline">
      <span>${escapeMarkup(booth.boothNumber)}</span>
      <span>${booth.floorId}층 ${escapeMarkup(booth.roomName)}</span>
    </div>
    <div class="booth-detail__body">
      ${renderProjectCover(project)}
      ${renderProjectOwner(project)}
      <h2>${escapeMarkup(project.title)}</h2>
      <p>${escapeMarkup(summarizeProjectDescription(project.description))}</p>
      ${renderProjectActions(project)}
    </div>
    <div class="booth-detail__location">
      <span>찾아가는 곳</span>
      <strong>${booth.floorId}층 ${escapeMarkup(booth.roomName)}</strong>
    </div>
  `
}
