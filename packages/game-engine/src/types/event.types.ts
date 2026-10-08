import type { CombatSlot } from './game-state.types'

export const GAME_EVENT_TYPE = {
  MULLIGAN_COMPLETED: 'mulligan_completed',
  ENERGY_CHANGED: 'energy_changed',
  RESERVED_ENERGY_CHANGED: 'reserved_energy_changed',
  CARD_DRAWN: 'card_drawn',
  UNIT_PLAYED: 'unit_played',
  ATTACK_DECLARED: 'attack_declared',
  BLOCKS_DECLARED: 'blocks_declared',
  COMBAT_DAMAGE_RESOLVED: 'combat_damage_resolved',
  UNIT_DIED: 'unit_died',
  COMBAT_RESOLVED: 'combat_resolved',
  UNIT_OBLITERATED: 'unit_obliterated',
  ROUND_STARTED: 'round_started',
  ROUND_ENDED: 'round_ended',
  PLAYER_PASSED: 'player_passed',
  CARD_OBLITERATED: 'card_obliterated',
  GAME_OVER: 'game_over',
} as const

export type GameEventType = (typeof GAME_EVENT_TYPE)[keyof typeof GAME_EVENT_TYPE]

export interface MulliganCompletedEvent {
  type: typeof GAME_EVENT_TYPE.MULLIGAN_COMPLETED
  playerId: string
  replacedCardInstanceIds: string[]
  receivedCardInstanceIds: string[]
}

export interface EnergyChangedEvent {
  type: typeof GAME_EVENT_TYPE.ENERGY_CHANGED
  playerId: string
  energy: number
}

export interface ReservedEnergyChangedEvent {
  type: typeof GAME_EVENT_TYPE.RESERVED_ENERGY_CHANGED
  playerId: string
  reservedEnergy: number
  bankedEnergy: number
}

export interface CardDrawnEvent {
  type: typeof GAME_EVENT_TYPE.CARD_DRAWN
  playerId: string
  cardInstanceId: string
}

export interface UnitPlayedEvent {
  type: typeof GAME_EVENT_TYPE.UNIT_PLAYED
  playerId: string
  cardInstanceId: string
}

export interface AttackDeclaredEvent {
  type: typeof GAME_EVENT_TYPE.ATTACK_DECLARED
  attackerPlayerId: string
  defenderPlayerId: string
  attackerInstanceIds: string[]
}

export interface UnitObliteratedEvent {
  type: typeof GAME_EVENT_TYPE.UNIT_OBLITERATED
  playerId: string
  cardInstanceId: string
}

export interface BlocksDeclaredEvent {
  type: typeof GAME_EVENT_TYPE.BLOCKS_DECLARED
  attackerPlayerId: string
  defenderPlayerId: string
  slots: CombatSlot[]
}

export type CombatDamageTarget =
  | { type: 'unit'; playerId: string; cardInstanceId: string; health: number }
  | { type: 'reputation'; playerId: string; reputation: number }

export interface CombatDamageStrike {
  sourceInstanceId: string
  amount: number
  target: CombatDamageTarget
}

export interface CombatDamageResolvedEvent {
  type: typeof GAME_EVENT_TYPE.COMBAT_DAMAGE_RESOLVED
  slotIndex: number
  attackerId: string
  blockerId: string | null
  strikes: CombatDamageStrike[]
}

export interface UnitDiedEvent {
  type: typeof GAME_EVENT_TYPE.UNIT_DIED
  playerId: string
  cardInstanceId: string
}

export interface CombatResolvedEvent {
  type: typeof GAME_EVENT_TYPE.COMBAT_RESOLVED
  attackerPlayerId: string
  defenderPlayerId: string
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

export interface PlayerPassedEvent {
  type: typeof GAME_EVENT_TYPE.PLAYER_PASSED
  playerId: string
}

export interface CardObliteratedEvent {
  type: typeof GAME_EVENT_TYPE.CARD_OBLITERATED
  playerId: string
  cardInstanceId: string
}

export interface GameOverEvent {
  type: typeof GAME_EVENT_TYPE.GAME_OVER
  winnerPlayerId: string | null
}

export type GameEvent =
  | MulliganCompletedEvent
  | EnergyChangedEvent
  | ReservedEnergyChangedEvent
  | CardDrawnEvent
  | UnitPlayedEvent
  | AttackDeclaredEvent
  | BlocksDeclaredEvent
  | CombatDamageResolvedEvent
  | UnitDiedEvent
  | CombatResolvedEvent
  | UnitObliteratedEvent
  | RoundStartedEvent
  | RoundEndedEvent
  | PlayerPassedEvent
  | CardObliteratedEvent
  | GameOverEvent
