export const CARD_TYPE = {
  UNIT: 'unit',
  SPELL: 'spell',
} as const

export type CardType = (typeof CARD_TYPE)[keyof typeof CARD_TYPE]

export const CARD_FACTION = {
  DIK: 'dik',
  AAA: 'aaa',
  HOT: 'hot',
  BBB: 'bbb',
} as const

export type CardFaction = (typeof CARD_FACTION)[keyof typeof CARD_FACTION]

export interface BaseCard {
  id: string
  name: string
  description: string
  faction: CardFaction
  baseCost: number
  cost: number
}

export interface UnitCard extends BaseCard {
  type: typeof CARD_TYPE.UNIT
  baseHealth: number
  health: number
  baseAttack: number
  attack: number
}

export interface UnitCardInstance extends UnitCard {
  instanceId: string
  ownerId: string
}

export const SPELL_SPEED = {
  BURST: 'burst',
  FAST: 'fast',
  SLOW: 'slow',
} as const

export type SpellSpeed = (typeof SPELL_SPEED)[keyof typeof SPELL_SPEED]

export interface SpellCard extends BaseCard {
  type: typeof CARD_TYPE.SPELL
  speed: SpellSpeed
}

export interface SpellCardInstance extends SpellCard {
  instanceId: string
  ownerId: string
}

export type CardDefinition = UnitCard | SpellCard
export type CardInstance = UnitCardInstance | SpellCardInstance
