import type { AbilityType } from './abilities.types'
import type { SpellType } from './spells.types'

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
  name: string
  description: string
  faction: CardFaction
  baseCost: number
  cost: number
}

export const UNIT_KEYWORD = {
  QUICK_ATTACK: 'quick_attack',
  DOUBLE_ATTACK: 'double_attack',
  LIFESTEAL: 'lifesteal',
  REGENERATION: 'regeneration',
  TOUGH: 'tough',
  OVERWHELM: 'overwhelm',
  CANNOT_ATTACK: 'cannot_attack',
  CANNOT_BLOCK: 'cannot_block',
  IMPULSE: 'impulse',
} as const

export type UnitKeyword = (typeof UNIT_KEYWORD)[keyof typeof UNIT_KEYWORD]

export interface UnitCard extends BaseCard {
  id: string
  type: typeof CARD_TYPE.UNIT
  maxHealth: number
  baseHealth: number
  health: number
  baseAttack: number
  attack: number
  tempAttack?: number
  tempHealth?: number
  keywords?: UnitKeyword[]
  tempKeywords?: UnitKeyword[]
  abilities?: AbilityType[]
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
  id: SpellType
  type: typeof CARD_TYPE.SPELL
  speed: SpellSpeed
}

export interface SpellCardInstance extends SpellCard {
  instanceId: string
  ownerId: string
}

export type CardDefinition = UnitCard | SpellCard
export type CardInstance = UnitCardInstance | SpellCardInstance
