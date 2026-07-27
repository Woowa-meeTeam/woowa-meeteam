export type MeeteamProject = {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly coverImage: string | null
  readonly ownerDisplayName: string
  readonly ownerAvatarUrl: string | null
  readonly sourceUrl: string
  readonly prototypeUrl: string | null
  readonly likes: number
  readonly bookmarks: number
  readonly myLike: boolean
  readonly myBookmark: boolean
}

export interface MeeteamProjectSource {
  listProjects(): Promise<readonly MeeteamProject[]>
}

export function findMeeteamProject(
  projects: readonly MeeteamProject[],
  projectId: string,
): MeeteamProject | undefined {
  return projects.find((project) => project.id === projectId)
}
