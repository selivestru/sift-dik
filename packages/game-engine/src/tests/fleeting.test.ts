import { describe, expect, test } from 'vitest'

import { applyAction, createGame } from '../core'
import { GAME_ACTION_TYPE, GAME_EVENT_TYPE, KEYWORD, type UnitCard } from '../types'
import { getNextPlayerId } from '../utils/getNextPlayerId'

const createUnit = (overrides: Partial<UnitCard> = {}): UnitCard => ({
  id: 'unit-template',
  faction: 'dik',
  baseCost: 1,
  cost: 1,
  type: 'unit',
  baseAttack: 2,
  attack: 2,
  baseHealth: 2,
  health: 2,
  maxHealth: 2,
  ...overrides,
})

describe('Keyword: Fleeting', () => {
  test('fleeting card in hand is discarded to graveyard at round end', () => {
    const fleetingCard = createUnit({
      id: 'fleeting-card',
      keywords: [KEYWORD.FLEETING],
    })

    const normalCard = createUnit({
      id: 'normal-card',
    })

    const state = createGame(
      [
        {
          id: 'p1',
          cards: [createUnit(), createUnit(), createUnit(), createUnit(), createUnit()],
        },
        {
          id: 'p2',
          cards: [fleetingCard, normalCard, createUnit(), createUnit(), createUnit()],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const p2Id = state.turnPlayerId // p2
    const p1Id = getNextPlayerId(state) // p1

    const fleetingInHand = state.players[p2Id]!.hand.find((c) => c.id === 'fleeting-card')!
    const normalInHand = state.players[p2Id]!.hand.find((c) => c.id === 'normal-card')!

    expect(fleetingInHand).toBeDefined()
    expect(normalInHand).toBeDefined()
    expect(state.players[p2Id]!.graveyard).toHaveLength(0)

    // Both players pass to end round 1
    const firstPassResult = applyAction(state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p2Id,
    })

    const roundEndResult = applyAction(firstPassResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    })

    // In Round 2:
    // 1. Fleeting card is discarded from hand
    expect(
      roundEndResult.state.players[p2Id]!.hand.some(
        (c) => c.instanceId === fleetingInHand.instanceId,
      ),
    ).toBe(false)

    // 2. Normal card is still in hand
    expect(
      roundEndResult.state.players[p2Id]!.hand.some(
        (c) => c.instanceId === normalInHand.instanceId,
      ),
    ).toBe(true)

    // 3. Fleeting card moved to graveyard
    expect(roundEndResult.state.players[p2Id]!.graveyard).toContainEqual(
      expect.objectContaining({ instanceId: fleetingInHand.instanceId }),
    )

    // 4. CARD_DISCARDED event was emitted
    expect(roundEndResult.events).toContainEqual({
      type: GAME_EVENT_TYPE.CARD_DISCARDED,
      playerId: p2Id,
      cardInstanceId: fleetingInHand.instanceId,
    })
  })
})
