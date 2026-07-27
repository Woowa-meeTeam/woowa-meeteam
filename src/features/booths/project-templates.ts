import type { MeeteamProject } from "./integrations/meeteam/project-source"

const markupEscapes: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
}

export function escapeMarkup(value: string): string {
  return value.replace(/[&<>"']/g, (character) => markupEscapes[character] ?? character)
}

function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function renderProjectCover(project: MeeteamProject): string {
  if (project.coverImage === null) {
    return ""
  }
  return `
    <img
      class="project-cover"
      src="${escapeMarkup(project.coverImage)}"
      alt="${escapeMarkup(`${project.title} 대표 이미지`)}"
    />
  `
}

export function renderProjectOwner(project: MeeteamProject): string {
  const avatar =
    project.ownerAvatarUrl === null
      ? ""
      : `<img src="${escapeMarkup(project.ownerAvatarUrl)}" alt="" />`
  return `
    <div class="project-owner">
      ${avatar}
      <span>등록자 ${escapeMarkup(project.ownerDisplayName)}</span>
    </div>
  `
}

export function renderProjectActions(project: MeeteamProject): string {
  const prototypeLink =
    project.prototypeUrl === null || !isSafeExternalUrl(project.prototypeUrl)
      ? ""
      : `
        <a href="${escapeMarkup(project.prototypeUrl)}" target="_blank" rel="noreferrer">
          서비스 열기
        </a>
      `
  return `
    <div class="project-actions">
      <a href="${escapeMarkup(project.sourceUrl)}" target="_blank" rel="noreferrer">
        meeTeam에서 전체 정보 보기
      </a>
      ${prototypeLink}
    </div>
  `
}
