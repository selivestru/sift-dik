import z from 'zod'

const checkPlayers = z
  .array(z.object({ id: z.string(), cards: z.array(z.object({ id: z.string() })) }))
  .length(2)
  .refine(([player1, player2]) => player1.id !== player2.id, {
    error: 'Players must have unique ids',
  })
  .refine(([player1, player2]) => player1.cards.length > 0 && player2.cards.length > 0, {
    // TODO: fix check count and error message
    error: 'Players must have at least one card',
  })

export const compiledCheckPlayers = z.compile(checkPlayers)
