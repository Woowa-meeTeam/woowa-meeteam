import type { Project } from "../../api"
import type { MeeteamProject } from "./integrations/meeteam/project-source"

function safeExternalUrl(value: string | null): string | null {
  if (value === null || value.trim() === "") {
    return null
  }
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
    const url = new URL(candidate)
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null
  } catch {
    return null
  }
}

export function toBoothProject(project: Project): MeeteamProject {
  return {
    id: project.id,
    title: project.title,
    description: project.desc,
    coverImage: safeExternalUrl(project.coverImage),
    ownerDisplayName: project.owner?.name ?? "meeTeam 크루",
    ownerAvatarUrl: safeExternalUrl(project.owner?.avatarUrl ?? null),
    sourceUrl: `/projects/${encodeURIComponent(project.id)}`,
    prototypeUrl: safeExternalUrl(project.prototype),
  }
}
