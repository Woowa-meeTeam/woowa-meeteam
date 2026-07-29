import type { Booth, BoothBounds } from "./model"

export type AlignmentGuide = {
  readonly orientation: "vertical" | "horizontal" | "spacing"
  readonly position?: number
  readonly segments?: readonly (readonly [number, number, number, number])[]
}

export type AlignmentResult = {
  readonly bounds: BoothBounds
  readonly guides: readonly AlignmentGuide[]
}

const alignmentTolerance = 10

type AlignmentCandidate = {
  readonly distance: number
  readonly delta: number
  readonly position: number
}

export function snapBoothToAlignment(
  booth: BoothBounds,
  targets: readonly Booth[],
  movingBoothId: string,
): AlignmentResult {
  const vertical = findClosestAlignment(
    [booth.x, booth.x + booth.width / 2, booth.x + booth.width],
    targets
      .filter((target) => target.id !== movingBoothId)
      .flatMap((target) => [target.x, target.x + target.width / 2, target.x + target.width]),
  )
  const horizontal = findClosestAlignment(
    [booth.y, booth.y + booth.height / 2, booth.y + booth.height],
    targets
      .filter((target) => target.id !== movingBoothId)
      .flatMap((target) => [target.y, target.y + target.height / 2, target.y + target.height]),
  )
  const spacing = findEqualSpacing(booth, targets, movingBoothId)
  const columnSpacing = findEqualSpacing(booth, targets, movingBoothId, "vertical")

  return {
    bounds: {
      ...booth,
      x: spacing?.position ?? booth.x + (vertical?.delta ?? 0),
      y: columnSpacing?.position ?? booth.y + (horizontal?.delta ?? 0),
    },
    guides: [
      ...(vertical ? [{ orientation: "vertical" as const, position: vertical.position }] : []),
      ...(horizontal ? [{ orientation: "horizontal" as const, position: horizontal.position }] : []),
      ...(spacing
        ? [
            {
              orientation: "spacing" as const,
              segments: spacing.segments,
            },
          ]
        : []),
      ...(columnSpacing
        ? [
            {
              orientation: "spacing" as const,
              segments: columnSpacing.segments,
            },
          ]
        : []),
    ],
  }
}

type EqualSpacing = {
  readonly position: number
  readonly segments: readonly (readonly [number, number, number, number])[]
}

function findEqualSpacing(
  booth: BoothBounds,
  targets: readonly Booth[],
  movingBoothId: string,
  orientation: "horizontal" | "vertical" = "horizontal",
): EqualSpacing | null {
  const candidates = targets
    .filter((target) => target.id !== movingBoothId)
    .sort((first, second) =>
      orientation === "horizontal" ? first.x - second.x : first.y - second.y,
    )
  let closest: { readonly distance: number; readonly result: EqualSpacing } | null = null

  for (let firstIndex = 0; firstIndex < candidates.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < candidates.length; secondIndex += 1) {
      const first = candidates[firstIndex]
      const second = candidates[secondIndex]
      const firstEnd =
        orientation === "horizontal" ? first.x + first.width : first.y + first.height
      const secondStart = orientation === "horizontal" ? second.x : second.y
      if (firstEnd > secondStart) {
        continue
      }
      const row = findClosestAlignment(
        orientation === "horizontal"
          ? [booth.y, booth.y + booth.height / 2, booth.y + booth.height]
          : [booth.x, booth.x + booth.width / 2, booth.x + booth.width],
        orientation === "horizontal"
          ? [
              first.y,
              first.y + first.height / 2,
              first.y + first.height,
              second.y,
              second.y + second.height / 2,
              second.y + second.height,
            ]
          : [
              first.x,
              first.x + first.width / 2,
              first.x + first.width,
              second.x,
              second.x + second.width / 2,
              second.x + second.width,
            ],
      )
      if (!row) {
        continue
      }
      const movingStart =
        orientation === "horizontal"
          ? (firstEnd + second.x - booth.width) / 2
          : (firstEnd + second.y - booth.height) / 2
      const distance = Math.abs(
        movingStart - (orientation === "horizontal" ? booth.x : booth.y),
      )
      if (distance > alignmentTolerance || (closest && distance >= closest.distance)) {
        continue
      }
      closest = {
        distance,
        result: {
          position: movingStart,
          segments:
            orientation === "horizontal"
              ? [
                  [firstEnd, row.position - 14, movingStart, row.position - 14],
                  [movingStart + booth.width, row.position - 14, second.x, row.position - 14],
                ]
              : [
                  [row.position - 14, firstEnd, row.position - 14, movingStart],
                  [row.position - 14, movingStart + booth.height, row.position - 14, second.y],
                ],
        },
      }
    }
  }
  return closest?.result ?? null
}

function findClosestAlignment(
  movingAnchors: readonly number[],
  targetAnchors: readonly number[],
): AlignmentCandidate | null {
  let closest: AlignmentCandidate | null = null
  for (const movingAnchor of movingAnchors) {
    for (const targetAnchor of targetAnchors) {
      const delta = targetAnchor - movingAnchor
      const distance = Math.abs(delta)
      if (distance > alignmentTolerance || (closest && distance >= closest.distance)) {
        continue
      }
      closest = { distance, delta, position: targetAnchor }
    }
  }
  return closest
}
