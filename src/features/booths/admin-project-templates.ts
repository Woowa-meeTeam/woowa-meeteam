import type { MeeteamProject } from "./integrations/meeteam/project-source"
import { summarizeProjectDescription } from "./project-summary"
import {
  escapeMarkup,
  renderProjectActions,
  renderProjectCover,
  renderProjectOwner,
} from "./project-templates"

export function renderProjectSummary(project: MeeteamProject | undefined): string {
  if (!project) {
    return `
      <div class="admin-project-summary" data-missing="true">
        <strong>프로젝트 정보를 불러올 수 없습니다.</strong>
        <p>meeTeam 원본 프로젝트의 공개 상태를 확인해 주세요.</p>
      </div>
    `
  }

  return `
    <div class="admin-project-summary">
      ${renderProjectCover(project)}
      ${renderProjectOwner(project)}
      <strong>${escapeMarkup(project.title)}</strong>
      <p>${escapeMarkup(summarizeProjectDescription(project.description))}</p>
      ${renderProjectActions(project)}
    </div>
  `
}
