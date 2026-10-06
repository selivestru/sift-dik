import type { AbilityContextInput } from './abilities.types'

export const GAME_ACTION_TYPE = {
  MULLIGAN: 'MULLIGAN',
  PLAY_UNIT: 'PLAY_UNIT',
  DECLARE_ATTACKS: 'DECLARE_ATTACKS',
  DECLARE_BLOCKS: 'DECLARE_BLOCKS',
  PASS: 'PASS',
  PLAY_SPELL: 'PLAY_SPELL',
  PLAY_SPELLS: 'PLAY_SPELLS',
} as const

export type GameActionType = (typeof GAME_ACTION_TYPE)[keyof typeof GAME_ACTION_TYPE]

export interface PlayUnitAction {
  type: typeof GAME_ACTION_TYPE.PLAY_UNIT
  playerId: string
  cardInstanceId: string
  abilityContexts?: AbilityContextInput
}

export interface DeclareAttacksAction {
  type: typeof GAME_ACTION_TYPE.DECLARE_ATTACKS
  playerId: string
  attackers: string[]
  spells?: SpellPlay[]
  forcedBlockers?: {
    attackerInstanceId: string
    defenderInstanceId: string
  }[]
}

export interface DeclareBlocksAction {
  type: typeof GAME_ACTION_TYPE.DECLARE_BLOCKS
  playerId: string
  spells?: SpellPlay[]
  blocks: {
    attackerInstanceId: string
    defenderInstanceId: string
  }[]
}

export interface PassAction {
  type: typeof GAME_ACTION_TYPE.PASS
  playerId: string
}

export interface SpellPlay {
  cardInstanceId: string
  targets?: string[]
  payload?: Record<string, unknown>
}

export interface PlaySpellAction extends SpellPlay {
  type: typeof GAME_ACTION_TYPE.PLAY_SPELL
  playerId: string
}

export interface PlaySpellsAction {
  type: typeof GAME_ACTION_TYPE.PLAY_SPELLS
  playerId: string
  spells: SpellPlay[]
}

export type GameAction =
  | MulliganAction
  | PlayUnitAction
  | DeclareAttacksAction
  | DeclareBlocksAction
  | PassAction
  | PlaySpellAction
  | PlaySpellsAction

export interface MulliganAction {
  type: typeof GAME_ACTION_TYPE.MULLIGAN
  playerId: string
  cardInstanceIds: string[]
}
