import type { UnitCardInstance } from './card.types'

export const GAME_EVENT_TYPE = {
  ENERGY_CHANGED: 'ENERGY_CHANGED',
  CARD_DRAWN: 'CARD_DRAWN',
  UNIT_SPAWNED: 'UNIT_SPAWNED',
  DAMAGE_DEALT: 'DAMAGE_DEALT',
  HEAL_DEALT: 'HEAL_DEALT',
  UNIT_DIED: 'UNIT_DIED',
  ROUND_STARTED: 'ROUND_STARTED',
  ROUND_ENDED: 'ROUND_ENDED',
  GAME_OVER: 'GAME_OVER',
} as const

export type GameEventType = (typeof GAME_EVENT_TYPE)[keyof typeof GAME_EVENT_TYPE]

export interface EnergyChangedEvent {
  type: typeof GAME_EVENT_TYPE.ENERGY_CHANGED
  playerId: string
  energy: number
}

export interface CardDrawnEvent {
  type: typeof GAME_EVENT_TYPE.CARD_DRAWN
  playerId: string
  cardInstanceId: string
}

export interface UnitSpawnedEvent {
  type: typeof GAME_EVENT_TYPE.UNIT_SPAWNED
  playerId: string
  unit: UnitCardInstance
}

export interface DamageDealtEvent {
  type: typeof GAME_EVENT_TYPE.DAMAGE_DEALT
  targetId: string
  amount: number
  isReputation: boolean
}

export interface HealDealtEvent {
  type: typeof GAME_EVENT_TYPE.HEAL_DEALT
  targetId: string
  amount: number
  isReputation: boolean
}

export interface UnitDiedEvent {
  type: typeof GAME_EVENT_TYPE.UNIT_DIED
  unitInstanceId: string
}

export interface RoundStartedEvent {
  type: typeof GAME_EVENT_TYPE.ROUND_STARTED
  round: number
  initiativePlayerId: string
}

export interface RoundEndedEvent {
  type: typeof GAME_EVENT_TYPE.ROUND_ENDED
  round: number
}

export interface GameOverEvent {
  type: typeof GAME_EVENT_TYPE.GAME_OVER
  winnerPlayerId: string
}

export type GameEvent =
  | EnergyChangedEvent
  | CardDrawnEvent
  | UnitSpawnedEvent
  | DamageDealtEvent
  | HealDealtEvent
  | UnitDiedEvent
  | RoundStartedEvent
  | RoundEndedEvent
  | GameOverEvent
