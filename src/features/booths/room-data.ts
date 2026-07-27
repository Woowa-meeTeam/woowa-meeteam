import type { FloorId, RoomDefinition } from "./model"

export const roomsByFloor = {
  11: [
    {
      name: "큰 강의실",
      anchorX: 72,
      anchorY: 184,
      bounds: { x: 15, y: 18, width: 380, height: 580 },
    },
    {
      name: "코워킹 존",
      anchorX: 518,
      anchorY: 220,
      bounds: { x: 395, y: 18, width: 500, height: 340 },
    },
    {
      name: "금성",
      anchorX: 915,
      anchorY: 42,
      bounds: { x: 895, y: 18, width: 160, height: 140 },
    },
    {
      name: "지구",
      anchorX: 1115,
      anchorY: 42,
      bounds: { x: 1095, y: 18, width: 160, height: 140 },
    },
    {
      name: "수성",
      anchorX: 915,
      anchorY: 174,
      bounds: { x: 895, y: 158, width: 160, height: 100 },
    },
    {
      name: "화성",
      anchorX: 1115,
      anchorY: 174,
      bounds: { x: 1095, y: 158, width: 160, height: 100 },
    },
    {
      name: "옆 강의실",
      anchorX: 72,
      anchorY: 730,
      bounds: { x: 15, y: 678, width: 420, height: 260 },
    },
    {
      name: "캔틴",
      anchorX: 430,
      anchorY: 730,
      bounds: { x: 435, y: 678, width: 360, height: 260 },
    },
  ],
  12: [
    {
      name: "라이브러리",
      anchorX: 254,
      anchorY: 194,
      bounds: { x: 153, y: 14, width: 662, height: 320 },
    },
    {
      name: "코워킹 존",
      anchorX: 230,
      anchorY: 390,
      bounds: { x: 153, y: 334, width: 342, height: 280 },
    },
    {
      name: "보이저",
      anchorX: 915,
      anchorY: 38,
      bounds: { x: 895, y: 14, width: 160, height: 140 },
    },
    {
      name: "디스커버리",
      anchorX: 1115,
      anchorY: 38,
      bounds: { x: 1095, y: 14, width: 160, height: 140 },
    },
    {
      name: "아폴로",
      anchorX: 915,
      anchorY: 170,
      bounds: { x: 895, y: 154, width: 160, height: 100 },
    },
    {
      name: "허블",
      anchorX: 1115,
      anchorY: 170,
      bounds: { x: 1095, y: 154, width: 160, height: 100 },
    },
    {
      name: "페어존",
      anchorX: 48,
      anchorY: 58,
      bounds: { x: 35, y: 52, width: 80, height: 544 },
    },
    {
      name: "작은 강의실",
      anchorX: 54,
      anchorY: 754,
      bounds: { x: 15, y: 674, width: 480, height: 260 },
    },
    {
      name: "캔틴",
      anchorX: 500,
      anchorY: 730,
      bounds: { x: 495, y: 674, width: 260, height: 260 },
    },
  ],
  13: [
    {
      name: "스타트랙",
      anchorX: 72,
      anchorY: 402,
      bounds: { x: 13, y: 288, width: 320, height: 640 },
    },
    {
      name: "코워킹 존",
      anchorX: 494,
      anchorY: 670,
      bounds: { x: 333, y: 648, width: 580, height: 280 },
    },
    {
      name: "포커스 존",
      anchorX: 990,
      anchorY: 650,
      bounds: { x: 913, y: 608, width: 420, height: 180 },
    },
    {
      name: "페어존",
      anchorX: 925,
      anchorY: 802,
      bounds: { x: 913, y: 788, width: 420, height: 62 },
    },
    {
      name: "은하수",
      anchorX: 1350,
      anchorY: 640,
      bounds: { x: 1333, y: 608, width: 138, height: 160 },
    },
    {
      name: "스튜디오",
      anchorX: 1350,
      anchorY: 800,
      bounds: { x: 1333, y: 768, width: 138, height: 160 },
    },
    {
      name: "안드로메다같은 방",
      anchorX: 930,
      anchorY: 110,
      bounds: { x: 913, y: 8, width: 340, height: 260 },
    },
  ],
} as const satisfies Record<FloorId, readonly RoomDefinition[]>
