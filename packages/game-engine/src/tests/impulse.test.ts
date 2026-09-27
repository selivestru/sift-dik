import { describe, expect, test } from 'vitest'

import { applyAction, createGame } from '../core'
import {
  GAME_ACTION_TYPE,
  GAME_EVENT_TYPE,
  UNIT_KEYWORD,
  type UnitCard,
} from '../types'

const createUnit = (overrides: Partial<UnitCard> = {}): UnitCard => ({
  id: 'unit-template',
  name: 'Unit',
  description: 'Test unit',
  faction: 'dik',
  baseCost: 1,
  cost: 1,
  type: 'unit',
  baseAttack: 2,
  attack: 2,
  maxAttack: 2,
  baseHealth: 2,
  health: 2,
  maxHealth: 2,
  ...overrides,
})

describe('Keyword: Impulse', () => {
  test('should grant 1 reserved energy when played', () => {
    const impulseUnit = createUnit({
      id: 'impulse-unit',
      baseCost: 1,
      cost: 1,
      keywords: [UNIT_KEYWORD.IMPULSE],
    })

    const dummyCard = createUnit({ id: 'dummy-card' })

    const state = createGame(
      [
        { id: 'p1', cards: [dummyCard, dummyCard, dummyCard, dummyCard, dummyCard] },
        { id: 'p2', cards: [impulseUnit, impulseUnit, impulseUnit, impulseUnit, impulseUnit] },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const activePlayerId = state.turnPlayerId // p2
    const initialReservedEnergy = state.players[activePlayerId]!.reservedEnergy // 0

    // Play unit with impulse
    const result = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: activePlayerId,
      cardInstanceId: state.players[activePlayerId]!.hand[0]!.instanceId,
    })

    const updatedPlayer = result.state.players[activePlayerId]!

    // Reserved energy should increase from 0 to 1
    expect(updatedPlayer.reservedEnergy).toBe(initialReservedEnergy + 1)

    // Events should include ENERGY_CHANGED for both base energy (cost paid) and reserved energy (impulse)
    expect(result.events).toContainEqual({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId: activePlayerId,
      energy: 0,
      isReserved: false,
    })

    expect(result.events).toContainEqual({
      type: GAME_EVENT_TYPE.ENERGY_CHANGED,
      playerId: activePlayerId,
      energy: 1,
      isReserved: true,
    })
  })
})
