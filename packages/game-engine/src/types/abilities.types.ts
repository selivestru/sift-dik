import type { ZodType } from 'zod'

import type { TremoloPath } from '../constants/characters'
import type { UnitCardInstance } from './card.types'
import type { GameEvent } from './event.types'
import type { GameState } from './game-state.types'

export const TRIGGER = {
  ON_SUMMON: 'on_summon',
  ON_ATTACK: 'on_attack',
  ON_REPUTATION_STRIKE: 'on_reputation_strike',
  ON_KILL: 'on_kill',
  ON_DEATH: 'on_death',
  ON_ROUND_START: 'on_round_start',
  ON_ROUND_END: 'on_round_end',
} as const

export type TriggerType = (typeof TRIGGER)[keyof typeof TRIGGER]

export const ABILITY = {
  TREMOLO_PATH: 'tremolo_path',
  SUPPORT: 'support',
} as const

export type AbilityType = (typeof ABILITY)[keyof typeof ABILITY]

export interface AbilityContext {
  sourceUnit: UnitCardInstance
}

export interface TremoloPathAbilityContext extends AbilityContext {
  chosenPath: TremoloPath
}

export interface SupportAbilityContext extends AbilityContext {
  targetUnit?: UnitCardInstance
}

export interface AbilityContextMap {
  tremolo_path: TremoloPathAbilityContext
  support: SupportAbilityContext
}

export type AbilityPayload<C extends AbilityContext> = Omit<C, keyof AbilityContext>

export interface AbilityHandler<C extends AbilityContext = AbilityContext> {
  trigger: TriggerType
  execute: (state: GameState, events: GameEvent[], context: C) => void
  payloadSchema?: ZodType<AbilityPayload<C>>
}

export type AbilityContextInput = {
  [K in AbilityType]?: Omit<AbilityContextMap[K], keyof AbilityContext>
}

export type AbilityHandlerMap = {
  [K in AbilityType]: AbilityHandler<AbilityContextMap[K]>
}
