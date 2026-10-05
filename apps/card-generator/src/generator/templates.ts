export type CardType = 'unit' | 'spell'
export type Point = readonly [number, number]
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}
export interface Template {
  frame: string
  art: Rect
  polygon?: readonly Point[]
  text: Rect
  textStart?: number
  energy: Point
  faction: Rect
  attack?: Point
  health?: Point
}

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 1600
export const CARD_FONT = 'CardSans'
export const CARD_TITLE_FONT = 'CardTitle'

const UNIT_TEXT_TOP = 0.195
const UNIT_STATS_TOP = 0.84

export const templates: Record<CardType, Template> = {
  unit: {
    frame: 'unit.png',
    art: { x: 0.076, y: 0.059, width: 0.85, height: 0.878 },
    polygon: [
      [0.076, 0.059],
      [0.926, 0.059],
      [0.926, 0.84],
      [0.777, 0.848],
      [0.722, 0.937],
      [0.276, 0.937],
      [0.221, 0.848],
      [0.076, 0.84],
    ],
    text: { x: 0.115, y: UNIT_TEXT_TOP, width: 0.77, height: UNIT_STATS_TOP - UNIT_TEXT_TOP },
    energy: [0.134, 0.1],
    faction: { x: 0.783, y: 0.044, width: 0.157, height: 0.113 },
    attack: [0.142, 0.918],
    health: [0.855, 0.918],
  },
  spell: {
    frame: 'spell.png',
    art: { x: 0.22, y: 0.042, width: 0.56, height: 0.42 },
    text: { x: 0.135, y: 0.195, width: 0.73, height: 0.72 },
    textStart: 0.52,
    energy: [0.133, 0.103],
    faction: { x: 0.803, y: 0.054, width: 0.13, height: 0.098 },
  },
}
