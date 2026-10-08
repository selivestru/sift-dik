import type { Character } from '~/constants/characters'

export type CardId = Character

export const CARD_TYPE = {
  UNIT: 'unit',
} as const

export type CardType = (typeof CARD_TYPE)[keyof typeof CARD_TYPE]

export const CARD_FACTION = {
  DIK: 'dik',
  HOT: 'hot',
  AAA: 'aaa',
  BBB: 'bbb',
  PREPS: 'preps',
  DORM: 'dorm',
  UNIVERSITY: 'university',
  PINK_ROSE: 'pink_rose',
  OTHER: 'other',
} as const

export type CardFaction = (typeof CARD_FACTION)[keyof typeof CARD_FACTION]

export interface BaseCard {
  faction: CardFaction
  cost: number
}

export interface UnitCard extends BaseCard {
  id: string
  type: typeof CARD_TYPE.UNIT
  baseHealth: number
  health: number
  attack: number
}

export interface UnitCardInstance extends UnitCard {
  instanceId: string
  ownerId: string
}

export type CardDefinition = UnitCard
export type CardInstance = UnitCardInstance
