import z from 'zod'

import { GAME_ACTION_TYPE } from '~/types/action.types'

const nonEmptyId = z.string().min(1)

const mulliganChangeCardsActionSchema = z.object({
  type: z.literal(GAME_ACTION_TYPE.MULLIGAN_CHANGE_CARDS),
  playerId: nonEmptyId,
  cardInstanceIds: z.array(nonEmptyId).min(0).max(4),
})

const playUnitActionSchema = z.object({
  type: z.literal(GAME_ACTION_TYPE.PLAY_UNIT),
  playerId: nonEmptyId,
  cardInstanceId: nonEmptyId,
})

const declareAttacksActionSchema = z.object({
  type: z.literal(GAME_ACTION_TYPE.DECLARE_ATTACKS),
  playerId: nonEmptyId,
  attackers: z.array(nonEmptyId),
})

const declareBlocksActionSchema = z.object({
  type: z.literal(GAME_ACTION_TYPE.DECLARE_BLOCKS),
  playerId: nonEmptyId,
  blocks: z.array(
    z.object({
      attackerInstanceId: nonEmptyId,
      defenderInstanceId: nonEmptyId,
    }),
  ),
})

const passActionSchema = z.object({
  type: z.literal(GAME_ACTION_TYPE.PASS),
  playerId: nonEmptyId,
})

const gameActionBaseSchema = z.discriminatedUnion('type', [
  mulliganChangeCardsActionSchema,
  playUnitActionSchema,
  declareAttacksActionSchema,
  declareBlocksActionSchema,
  passActionSchema,
])

export const gameActionSchema = z.compile(gameActionBaseSchema)
