import z from 'zod'

import { DECK_SIZE } from '~/constants/game'
import { CARD_FACTION, CARD_TYPE } from '~/types/card.types'

const nonEmptyId = z.string().min(1, { error: 'Ids cannot be empty' })

const unitCardSchema = z
  .object({
    id: nonEmptyId,
    type: z.literal(CARD_TYPE.UNIT, { error: 'Card type must be a unit' }),
    faction: z.enum(CARD_FACTION, { error: 'Unknown card faction' }),
    cost: z.number().int({ error: 'Card cost must be an integer' }).nonnegative(),
    attack: z.number().int({ error: 'Card attack must be an integer' }).nonnegative(),
    baseHealth: z.number().int().positive({ error: 'Base health must be positive' }),
    health: z.number().int().positive({ error: 'Health must be positive' }),
  })
  .refine((card) => card.health === card.baseHealth, {
    error: 'Initial card health must match base health',
  })

const playerSchema = z.object({
  id: nonEmptyId,
  cards: z
    .array(unitCardSchema)
    .length(DECK_SIZE, { error: `Each player must have exactly ${DECK_SIZE} cards` }),
})

const checkPlayers = z
  .tuple([playerSchema, playerSchema])
  .rest(z.never())
  .refine(([player1, player2]) => player1.id !== player2.id, {
    error: 'Players must have unique ids',
  })

export const compiledCheckPlayers = z.compile(checkPlayers)
