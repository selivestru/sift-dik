import z from 'zod'

import type { gameActionSchema } from '~/schemas/action.schema'

export const GAME_ACTION_TYPE = {
  MULLIGAN_CHANGE_CARDS: 'mulligan_change_cards',
  PLAY_UNIT: 'play_unit',
  DECLARE_ATTACKS: 'declare_attacks',
  DECLARE_BLOCKS: 'declare_blocks',
  PASS: 'pass',
} as const

export type GameActionType = (typeof GAME_ACTION_TYPE)[keyof typeof GAME_ACTION_TYPE]

export type GameAction = z.infer<typeof gameActionSchema>

export type MulliganChangeCardsAction = Extract<
  GameAction,
  { type: typeof GAME_ACTION_TYPE.MULLIGAN_CHANGE_CARDS }
>

export type PlayUnitAction = Extract<GameAction, { type: typeof GAME_ACTION_TYPE.PLAY_UNIT }>

export type DeclareAttacksAction = Extract<
  GameAction,
  { type: typeof GAME_ACTION_TYPE.DECLARE_ATTACKS }
>

export type DeclareBlocksAction = Extract<
  GameAction,
  { type: typeof GAME_ACTION_TYPE.DECLARE_BLOCKS }
>

export type PassAction = Extract<GameAction, { type: typeof GAME_ACTION_TYPE.PASS }>
