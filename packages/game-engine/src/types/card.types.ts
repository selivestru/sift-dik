import type { Character } from '../constants/characters'
import type { AbilityType } from './abilities.types'
import type { SpellType } from './spells.types'

export type CardId = Character | SpellType

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
  faction: CardFaction
  baseCost: number
  cost: number
  tempCost?: number
}

export const KEYWORD = {
  QUICK_ATTACK: 'quick_attack',
  DOUBLE_ATTACK: 'double_attack',
  LIFESTEAL: 'lifesteal',
  REGENERATION: 'regeneration',
  TOUGH: 'tough',
  OVERWHELM: 'overwhelm',
  CANNOT_ATTACK: 'cannot_attack',
  CANNOT_BLOCK: 'cannot_block',
  IMPULSE: 'impulse',
  ELUSIVE: 'elusive',
  FURY: 'fury',
  RAM: 'ram',
  FLEETING: 'fleeting',
  EPHEMERAL: 'ephemeral',
  INVULNERABLE: 'invulnerable',
  PRESSURE: 'pressure',
  BARRIER: 'barrier',
  STUNNED: 'stunned',
  CHALLENGER: 'challenger',
  VULNERABLE: 'vulnerable',
} as const

export type Keyword = (typeof KEYWORD)[keyof typeof KEYWORD]

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
  keywords?: Keyword[]
  tempKeywords?: Keyword[]
  abilities?: AbilityType[]
  relatedCards?: CardId[]
}

export interface UnitCardInstance extends UnitCard {
  instanceId: string
  ownerId: string
}

export const SPELL_SPEED = {
  BURST: 'burst',
  FOCUS: 'focus',
  FAST: 'fast',
  SLOW: 'slow',
} as const

export type SpellSpeed = (typeof SPELL_SPEED)[keyof typeof SPELL_SPEED]

export interface SpellCard extends BaseCard {
  id: SpellType
  type: typeof CARD_TYPE.SPELL
  speed: SpellSpeed
  keywords?: Keyword[]
}

export interface SpellCardInstance extends SpellCard {
  instanceId: string
  ownerId: string
}

export type CardDefinition = UnitCard | SpellCard
export type CardInstance = UnitCardInstance | SpellCardInstance
