import type { BoothBounds, FloorMap, MapOrientation } from "./model"

const transitionDuration = 680

export type MapCameraDirection = "enter" | "exit"

export async function animateMapCamera(
  svg: SVGSVGElement,
  floor: FloorMap,
  target: BoothBounds,
  orientation: MapOrientation,
  roomName: string,
  direction: MapCameraDirection,
): Promise<void> {
  const camera = svg.querySelector<SVGGElement>(".map-coordinate-space")
  const presentation = findRoomElement(
    svg,
    ".room-presentation",
    "data-presentation-room",
    roomName,
  )
  const summaryLayer = presentation?.querySelector<SVGGElement>(".room-presentation__summary")
  const detailLayer = presentation?.querySelector<SVGGElement>(".room-presentation__detail")
  const otherLayers = [...(svg.querySelector<SVGGElement>(".booth-layer")?.children ?? [])].filter(
    (layer): layer is SVGGElement => layer instanceof SVGGElement && layer !== presentation,
  )
  const backgroundLabels = findMapBackgroundLabels(svg, roomName)
  if (!camera) {
    return
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  svg.setAttribute("data-map-transitioning", "true")

  if (reducedMotion) {
    applyCameraFrame(
      svg,
      camera,
      summaryLayer,
      detailLayer,
      backgroundLabels,
      otherLayers,
      floor,
      target,
      orientation,
      direction === "enter" ? 1 : 0,
    )
  } else {
    await new Promise<void>((resolve) => {
      const startedAt = performance.now()
      const renderFrame = (timestamp: number): void => {
        const elapsed = Math.min(1, (timestamp - startedAt) / transitionDuration)
        const eased = easeInOutQuint(elapsed)
        const cameraProgress = direction === "enter" ? eased : 1 - eased
        applyCameraFrame(
          svg,
          camera,
          summaryLayer,
          detailLayer,
          backgroundLabels,
          otherLayers,
          floor,
          target,
          orientation,
          cameraProgress,
        )
        if (elapsed < 1) {
          requestAnimationFrame(renderFrame)
          return
        }
        resolve()
      }
      requestAnimationFrame(renderFrame)
    })
  }

  const detailActive = direction === "enter"
  summaryLayer?.style.setProperty("pointer-events", detailActive ? "none" : "auto")
  detailLayer?.style.setProperty("pointer-events", detailActive ? "auto" : "none")
  for (const layer of otherLayers) {
    layer.style.setProperty("pointer-events", detailActive ? "none" : "auto")
  }
  presentation?.setAttribute("data-presentation-state", detailActive ? "detail" : "summary")
  svg.setAttribute(
    "data-map-orientation",
    detailActive && orientation === "clockwise" ? "clockwise" : "standard",
  )
  svg.removeAttribute("data-map-transitioning")
}

function applyCameraFrame(
  svg: SVGSVGElement,
  camera: SVGGElement,
  summaryLayer: SVGGElement | null | undefined,
  detailLayer: SVGGElement | null | undefined,
  backgroundLabels: readonly SVGTextElement[],
  otherLayers: readonly SVGGElement[],
  floor: FloorMap,
  target: BoothBounds,
  orientation: MapOrientation,
  progress: number,
): void {
  const targetAngle = orientation === "clockwise" ? Math.PI / 2 : 0
  const angle = targetAngle * progress
  const orientedWidth = orientation === "clockwise" ? target.height : target.width
  const orientedHeight = orientation === "clockwise" ? target.width : target.height
  const targetScale = Math.min(floor.width / orientedWidth, floor.height / orientedHeight)
  const scale = targetScale ** progress
  const worldCenterX = target.x + target.width / 2
  const worldCenterY = target.y + target.height / 2
  const screenCenterX = interpolate(worldCenterX, floor.width / 2, progress)
  const screenCenterY = interpolate(worldCenterY, floor.height / 2, progress)
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const a = scale * cosine
  const b = scale * sine
  const c = -scale * sine
  const d = scale * cosine
  const e = screenCenterX - a * worldCenterX - c * worldCenterY
  const f = screenCenterY - b * worldCenterX - d * worldCenterY
  camera.setAttribute("transform", `matrix(${a} ${b} ${c} ${d} ${e} ${f})`)

  summaryLayer?.style.setProperty("opacity", String(1 - progress))
  detailLayer?.style.setProperty("opacity", String(progress))
  for (const layer of otherLayers) {
    layer.style.setProperty("opacity", String(1 - progress))
  }

  const inverseAngle = (-angle * 180) / Math.PI
  for (const marker of detailLayer?.querySelectorAll<SVGGElement>(".booth-marker") ?? []) {
    const frame = marker.querySelector<SVGRectElement>(".booth-marker__visual > rect")
    if (!frame) {
      continue
    }
    const centerX = Number(frame.getAttribute("x")) + Number(frame.getAttribute("width")) / 2
    const centerY = Number(frame.getAttribute("y")) + Number(frame.getAttribute("height")) / 2
    for (const text of marker.querySelectorAll<SVGTextElement>("text")) {
      text.setAttribute("transform", `rotate(${inverseAngle} ${centerX} ${centerY})`)
    }
    marker.setAttribute(
      "data-map-orientation",
      progress === 1 && orientation === "clockwise" ? "clockwise" : "standard",
    )
  }

  for (const label of backgroundLabels) {
    applyBackgroundLabelFrame(label, inverseAngle, progress, orientation)
  }
  svg.setAttribute("data-camera-progress", String(progress))
}

export function syncMapBackgroundLabelOrientation(
  svg: SVGSVGElement,
  roomName: string | null,
  orientation: MapOrientation,
): void {
  for (const label of svg.querySelectorAll<SVGTextElement>(".map-background .labels text")) {
    restoreBackgroundLabel(label)
  }
  if (!roomName) {
    return
  }
  const inverseAngle = orientation === "clockwise" ? -90 : 0
  for (const label of findMapBackgroundLabels(svg, roomName)) {
    applyBackgroundLabelFrame(label, inverseAngle, 1, orientation)
  }
}

function findMapBackgroundLabels(svg: SVGSVGElement, roomName: string): readonly SVGTextElement[] {
  return [...svg.querySelectorAll<SVGTextElement>(".map-background .labels text")].filter(
    (label) => {
      const text = label.textContent?.trim() ?? ""
      return roomName === "페어존" ? /^페\s+\d+$/.test(text) : text === roomName
    },
  )
}

function applyBackgroundLabelFrame(
  label: SVGTextElement,
  inverseAngle: number,
  progress: number,
  orientation: MapOrientation,
): void {
  const x = Number(label.getAttribute("x"))
  const baseY = backgroundLabelBaseY(label)
  const fairZoneCenterY =
    orientation === "clockwise" ? fairZoneLabelCenterY(label.textContent?.trim() ?? "") : null
  const y = interpolate(baseY, fairZoneCenterY ?? baseY, progress)
  const baseFontSize = backgroundLabelBaseSize(label)
  const targetFontSize =
    orientation === "clockwise" && /^페\s+\d+$/.test(label.textContent?.trim() ?? "")
      ? 12
      : baseFontSize
  label.setAttribute("y", String(y))
  label.setAttribute("transform", `rotate(${inverseAngle} ${x} ${y})`)
  label.setAttribute("font-size", String(interpolate(baseFontSize, targetFontSize, progress)))
}

function restoreBackgroundLabel(label: SVGTextElement): void {
  label.removeAttribute("transform")
  label.setAttribute("y", String(backgroundLabelBaseY(label)))
  label.setAttribute("font-size", String(backgroundLabelBaseSize(label)))
}

function fairZoneLabelCenterY(text: string): number | null {
  const number = Number(text.match(/^페\s+(\d+)$/)?.[1])
  const centers = new Map([
    [7, 73],
    [8, 115],
    [9, 213],
    [10, 255],
    [11, 373],
    [12, 415],
    [13, 533],
    [14, 575],
  ])
  return centers.get(number) ?? null
}

function backgroundLabelBaseSize(label: SVGTextElement): number {
  const storedSize = label.getAttribute("data-map-label-base-size")
  if (storedSize) {
    return Number(storedSize)
  }
  const size = Number(label.getAttribute("font-size") ?? 32)
  label.setAttribute("data-map-label-base-size", String(size))
  return size
}

function backgroundLabelBaseY(label: SVGTextElement): number {
  const storedY = label.getAttribute("data-map-label-base-y")
  if (storedY) {
    return Number(storedY)
  }
  const y = Number(label.getAttribute("y"))
  label.setAttribute("data-map-label-base-y", String(y))
  return y
}

function findRoomElement(
  svg: SVGSVGElement,
  selector: string,
  attribute: string,
  roomName: string,
): SVGGElement | null {
  return (
    [...svg.querySelectorAll<SVGGElement>(selector)].find(
      (element) => element.getAttribute(attribute) === roomName,
    ) ?? null
  )
}

function easeInOutQuint(progress: number): number {
  return progress < 0.5 ? 16 * progress ** 5 : 1 - (-2 * progress + 2) ** 5 / 2
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}
