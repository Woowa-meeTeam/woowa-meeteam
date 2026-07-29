import { boothLabelMetrics } from "./map-readability"
import type { AlignmentGuide } from "./admin-alignment"
import type { Booth, ResizeHandleDirection } from "./model"
import { resizeHandleDirections } from "./model"

const svgNamespace = "http://www.w3.org/2000/svg"
const resizeHandleScreenRadius = 6
const resizeHandleHitScreenRadius = 16

export function updateAlignmentGuides(
  svg: SVGSVGElement,
  guides: readonly AlignmentGuide[],
  mapWidth: number,
  mapHeight: number,
): void {
  const layer = svg.querySelector<SVGGElement>(".booth-alignment-guides")
  if (!layer) {
    return
  }
  layer.replaceChildren(
    ...guides.flatMap((guide) => {
      if (guide.orientation === "spacing" && guide.segments) {
        return guide.segments.map(([x1, y1, x2, y2]) => {
          const line = document.createElementNS(svgNamespace, "line")
          line.setAttribute("class", "booth-alignment-guide--spacing")
          line.setAttribute("x1", String(x1))
          line.setAttribute("x2", String(x2))
          line.setAttribute("y1", String(y1))
          line.setAttribute("y2", String(y2))
          return line
        })
      }
      const line = document.createElementNS(svgNamespace, "line")
      if (guide.orientation === "vertical") {
        line.setAttribute("x1", String(guide.position))
        line.setAttribute("x2", String(guide.position))
        line.setAttribute("y1", "0")
        line.setAttribute("y2", String(mapHeight))
      } else {
        line.setAttribute("x1", "0")
        line.setAttribute("x2", String(mapWidth))
        line.setAttribute("y1", String(guide.position))
        line.setAttribute("y2", String(guide.position))
      }
      return [line]
    }),
  )
}

export function updateMovedMarker(svg: SVGSVGElement, booth: Booth): SVGGElement | null {
  const marker = svg.querySelector<SVGGElement>(`[data-booth-id="${booth.id}"]`)
  if (!marker) {
    return null
  }
  marker.querySelector("rect")?.setAttribute("x", String(booth.x))
  marker.querySelector("rect")?.setAttribute("y", String(booth.y))
  for (const text of marker.querySelectorAll("text")) {
    text.setAttribute("x", String(booth.x + booth.width / 2))
  }
  updateMarkerLabels(marker, booth)
  updateMarkerTransform(marker, booth)
  updateResizeHandles(marker, booth)
  return marker
}

export function updateResizedMarkers(svg: SVGSVGElement, booths: readonly Booth[]): void {
  for (const booth of booths) {
    const frame = updateMovedMarker(svg, booth)?.querySelector("rect")
    frame?.setAttribute("width", String(booth.width))
    frame?.setAttribute("height", String(booth.height))
  }
}

export function updateRoomMarkerSizes(
  root: ParentNode,
  booths: readonly Booth[],
  roomName: string,
): void {
  for (const booth of booths) {
    if (booth.roomName !== roomName) {
      continue
    }
    const marker = root.querySelector<SVGGElement>(`[data-booth-id="${booth.id}"]`)
    marker?.querySelector("rect")?.setAttribute("width", String(booth.width))
    marker?.querySelector("rect")?.setAttribute("height", String(booth.height))
    for (const text of marker?.querySelectorAll("text") ?? []) {
      text.setAttribute("x", String(booth.x + booth.width / 2))
    }
    if (marker) {
      updateMarkerLabels(marker, booth)
      updateMarkerTransform(marker, booth)
      updateResizeHandles(marker, booth)
    }
  }
}

export function syncResizeHandles(svg: SVGSVGElement, booth: Booth | null): void {
  svg.querySelector(".booth-resize-handles")?.remove()
  if (!booth) {
    return
  }
  const marker = svg.querySelector<SVGGElement>(`[data-booth-id="${booth.id}"]`)
  marker?.append(createResizeHandles(marker, booth))
}

function createResizeHandles(marker: SVGGElement, booth: Booth): SVGGElement {
  const matrix = marker.getScreenCTM()
  const projectionScale = Math.max(Number.EPSILON, Math.hypot(matrix?.a ?? 1, matrix?.b ?? 0))
  const resizeHandleRadius = resizeHandleScreenRadius / projectionScale
  const resizeHandleHitRadius = resizeHandleHitScreenRadius / projectionScale
  const group = document.createElementNS(svgNamespace, "g")
  group.setAttribute("class", "booth-resize-handles")
  group.setAttribute("aria-hidden", "true")
  for (const direction of resizeHandleDirections) {
    const { cx, cy } = resizeHandleCenter(booth, direction)
    const hitArea = document.createElementNS(svgNamespace, "circle")
    hitArea.setAttribute("class", "booth-resize-handle__hit")
    hitArea.setAttribute("data-resize-handle", direction)
    hitArea.setAttribute("cx", String(cx))
    hitArea.setAttribute("cy", String(cy))
    hitArea.setAttribute("r", String(resizeHandleHitRadius))
    const visual = document.createElementNS(svgNamespace, "circle")
    visual.setAttribute("class", "booth-resize-handle")
    visual.setAttribute("cx", String(cx))
    visual.setAttribute("cy", String(cy))
    visual.setAttribute("r", String(resizeHandleRadius))
    group.append(hitArea, visual)
  }
  return group
}

function updateResizeHandles(marker: SVGGElement, booth: Booth): void {
  const group = marker.querySelector(".booth-resize-handles")
  if (!group) {
    return
  }
  for (const direction of resizeHandleDirections) {
    const { cx, cy } = resizeHandleCenter(booth, direction)
    const hitArea = group.querySelector(`[data-resize-handle="${direction}"]`)
    hitArea?.setAttribute("cx", String(cx))
    hitArea?.setAttribute("cy", String(cy))
    const visual = hitArea?.nextElementSibling
    visual?.setAttribute("cx", String(cx))
    visual?.setAttribute("cy", String(cy))
  }
}

function resizeHandleCenter(
  booth: Booth,
  direction: ResizeHandleDirection,
): { readonly cx: number; readonly cy: number } {
  const cx = direction === "ne" || direction === "se" ? booth.x + booth.width : booth.x
  const cy = direction === "sw" || direction === "se" ? booth.y + booth.height : booth.y
  return { cx, cy }
}

export function updateSelectedMarkerStates(root: ParentNode, selectedBoothId: string | null): void {
  for (const marker of root.querySelectorAll<SVGGElement>("[data-booth-id]")) {
    const isSelected = marker.getAttribute("data-booth-id") === selectedBoothId
    marker.setAttribute("data-selected", String(isSelected))
    marker.setAttribute("aria-pressed", String(isSelected))
  }
}

function updateMarkerTransform(marker: SVGGElement, booth: Booth): void {
  const visual = marker.querySelector<SVGGElement>(".booth-marker__visual")
  if (!visual) {
    return
  }
  const scale = Number(marker.getAttribute("data-marker-scale") ?? "1")
  if (!Number.isFinite(scale) || scale === 1) {
    visual.removeAttribute("transform")
    return
  }
  const centerX = booth.x + booth.width / 2
  const centerY = booth.y + booth.height / 2
  visual.setAttribute(
    "transform",
    `translate(${centerX} ${centerY}) scale(${scale}) translate(${-centerX} ${-centerY})`,
  )
}

function updateMarkerLabels(marker: SVGGElement, booth: Booth): void {
  const team = marker.querySelector<SVGTextElement>(".booth-marker__team")
  const orientation =
    marker.getAttribute("data-map-orientation") === "clockwise" ? "clockwise" : "standard"
  const projectionScale = Number(marker.getAttribute("data-label-projection-scale") ?? "1")
  const teamName = team?.textContent?.trim() || "이름"
  const labels = boothLabelMetrics(
    booth,
    orientation,
    teamName,
    Number.isFinite(projectionScale) ? projectionScale : 1,
  )
  team?.setAttribute("y", String(labels.teamY))
  team?.style.setProperty("font-size", `${labels.teamFontSize}px`)
  const centerX = booth.x + booth.width / 2
  const centerY = booth.y + booth.height / 2
  const labelTransform =
    marker.getAttribute("data-map-orientation") === "clockwise"
      ? `rotate(-90 ${centerX} ${centerY})`
      : null
  if (labelTransform) {
    team?.setAttribute("transform", labelTransform)
  } else {
    team?.removeAttribute("transform")
  }
}
