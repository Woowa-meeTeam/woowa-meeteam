import floor11MapSource from "./maps/floor-11.svg?raw"
import floor12MapSource from "./maps/floor-12.svg?raw"
import floor13MapSource from "./maps/floor-13.svg?raw"
import type { Booth, FloorId, FloorMap } from "./model"

function inlineFloorMap(source: string): string {
  const content = source.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1] ?? ""
  return content
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, "")
    .replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/g, "")
}

export const floorMaps = {
  11: {
    id: 11,
    label: "11층",
    width: 1488,
    height: 954,
    mapMarkup: inlineFloorMap(floor11MapSource),
  },
  12: {
    id: 12,
    label: "12층",
    width: 1490,
    height: 952,
    mapMarkup: inlineFloorMap(floor12MapSource),
  },
  13: {
    id: 13,
    label: "13층",
    width: 1486,
    height: 940,
    mapMarkup: inlineFloorMap(floor13MapSource),
  },
} as const satisfies Record<FloorId, FloorMap>

export const boothsByFloor: Readonly<Record<FloorId, readonly Booth[]>> = {
  11: [],
  12: [],
  13: [],
}
