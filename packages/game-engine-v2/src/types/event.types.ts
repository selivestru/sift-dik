export const GAME_EVENT_TYPE = {
  MULLIGAN_COMPLETED: 'mulligan_completed',
  ENERGY_CHANGED: 'energy_changed',
  CARD_DRAWN: 'card_drawn',
  UNIT_PLAYED: 'unit_played',
  UNIT_OBLITERATED: 'unit_obliterated',
  ROUND_STARTED: 'round_started',
  ROUND_ENDED: 'round_ended',
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

export interface UnitObliteratedEvent {
  type: typeof GAME_EVENT_TYPE.UNIT_OBLITERATED
  playerId: string
  cardInstanceId: string
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

export type GameEvent =
  | MulliganCompletedEvent
  | EnergyChangedEvent
  | CardDrawnEvent
  | UnitPlayedEvent
  | UnitObliteratedEvent
  | RoundStartedEvent
  | RoundEndedEvent
