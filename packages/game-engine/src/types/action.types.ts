export const GAME_ACTION_TYPE = {
  PLAY_UNIT: 'PLAY_UNIT',
  DECLARE_ATTACKS: 'DECLARE_ATTACKS',
  DECLARE_BLOCKS: 'DECLARE_BLOCKS',
  PASS: 'PASS',
  PLAY_SPELL: 'PLAY_SPELL',
} as const

export type GameActionType = (typeof GAME_ACTION_TYPE)[keyof typeof GAME_ACTION_TYPE]

export interface PlayUnitAction {
  type: typeof GAME_ACTION_TYPE.PLAY_UNIT
  playerId: string
  cardInstanceId: string
}

export interface DeclareAttacksAction {
  type: typeof GAME_ACTION_TYPE.DECLARE_ATTACKS
  playerId: string
  attackers: string[]
}

export interface DeclareBlocksAction {
  type: typeof GAME_ACTION_TYPE.DECLARE_BLOCKS
  playerId: string
  blocks: {
    attackerInstanceId: string
    defenderInstanceId: string
  }[]
}

export interface PassAction {
  type: typeof GAME_ACTION_TYPE.PASS
  playerId: string
}

export interface PlaySpellAction {
  type: typeof GAME_ACTION_TYPE.PLAY_SPELL
  playerId: string
  cardInstanceId: string
  targetUnitInstanceId?: string
}

export type GameAction =
  | PlayUnitAction
  | DeclareAttacksAction
  | DeclareBlocksAction
  | PassAction
  | PlaySpellAction
