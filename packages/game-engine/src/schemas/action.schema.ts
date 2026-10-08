import z from 'zod'

import { MAX_UNITS_ON_BOARD } from '~/constants/game'
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
  replaceInstanceId: nonEmptyId.optional(),
})

const declareAttacksActionSchema = z.object({
  type: z.literal(GAME_ACTION_TYPE.DECLARE_ATTACKS),
  playerId: nonEmptyId,
  attackers: z
    .array(nonEmptyId)
    .min(1, { error: 'Must include at least one attacker' })
    .max(MAX_UNITS_ON_BOARD, { error: `Cannot attack more than ${MAX_UNITS_ON_BOARD} units` })
    .refine((attackers) => new Set(attackers).size === attackers.length, {
      error: 'Duplicate attackers',
    }),
})

const declareBlocksActionSchema = z.object({
  type: z.literal(GAME_ACTION_TYPE.DECLARE_BLOCKS),
  playerId: nonEmptyId,
  blocks: z
    .array(
      z.object({
        attackerInstanceId: nonEmptyId,
        defenderInstanceId: nonEmptyId,
      }),
    )
    .max(MAX_UNITS_ON_BOARD, {
      error: `Cannot declare more than ${MAX_UNITS_ON_BOARD} blockers`,
    })
    .refine(
      (blocks) => new Set(blocks.map((block) => block.attackerInstanceId)).size === blocks.length,
      { error: 'Duplicate blocked attackers' },
    )
    .refine(
      (blocks) => new Set(blocks.map((block) => block.defenderInstanceId)).size === blocks.length,
      { error: 'Duplicate blockers' },
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
