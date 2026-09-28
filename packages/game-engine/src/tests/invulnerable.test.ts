import { describe, expect, test } from 'vitest'

import { applyAction, createGame } from '../core'
import {
  GAME_ACTION_TYPE,
  GAME_EVENT_TYPE,
  KEYWORD,
  type UnitCard,
} from '../types'
import { getNextPlayerId } from '../utils/getNextPlayerId'

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
  baseHealth: 2,
  health: 2,
  maxHealth: 2,
  ...overrides,
})

describe('Keyword: Invulnerable', () => {
  test('unit with invulnerable is immune to all combat damage', () => {
    const hugeAttacker = createUnit({
      id: 'huge-attacker',
      attack: 10,
      baseAttack: 10,
      health: 10,
      baseHealth: 10,
      maxHealth: 10,
    })

    const invulnerableBlocker = createUnit({
      id: 'invulnerable-blocker',
      attack: 2,
      baseAttack: 2,
      health: 2,
      baseHealth: 2,
      maxHealth: 2,
      keywords: [KEYWORD.INVULNERABLE],
    })

    const state = createGame(
      [
        {
          id: 'p1',
          cards: [
            invulnerableBlocker,
            createUnit(),
            createUnit(),
            createUnit(),
            createUnit(),
          ],
        },
        {
          id: 'p2',
          cards: [
            hugeAttacker,
            createUnit(),
            createUnit(),
            createUnit(),
            createUnit(),
          ],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const attackerId = state.turnPlayerId // p2
    const defenderId = getNextPlayerId(state) // p1

    // 1. Both players play their units
    const stateAfterP2 = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: attackerId,
      cardInstanceId: state.players[attackerId]!.hand.find((c) => c.id === 'huge-attacker')!.instanceId,
    }).state

    const stateAfterP1 = applyAction(stateAfterP2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defenderId,
      cardInstanceId: stateAfterP2.players[defenderId]!.hand.find((c) => c.id === 'invulnerable-blocker')!.instanceId,
    }).state

    // 2. Huge attacker attacks, Invulnerable unit blocks
    const attackingUnitId = stateAfterP1.players[attackerId]!.board[0]!.instanceId
    const defendingUnitId = stateAfterP1.players[defenderId]!.board[0]!.instanceId

    const attackState = applyAction(stateAfterP1, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: attackerId,
      attackers: [attackingUnitId],
    }).state

    const combatResult = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: defenderId,
      blocks: [{ attackerInstanceId: attackingUnitId, defenderInstanceId: defendingUnitId }],
    })

    // Invulnerable blocker took 0 damage and remains at full 2 health
    const blockerOnBoard = combatResult.state.players[defenderId]!.board[0]!
    expect(blockerOnBoard.health).toBe(2)
    expect(combatResult.state.players[defenderId]!.graveyard).toHaveLength(0)

    // Attacker took 2 damage: 10 - 2 = 8 health
    const attackerOnBoard = combatResult.state.players[attackerId]!.board[0]!
    expect(attackerOnBoard.health).toBe(8)

    // Damage event to invulnerable blocker has amount 0
    expect(combatResult.events).toContainEqual({
      type: GAME_EVENT_TYPE.DAMAGE_DEALT,
      targetId: defendingUnitId,
      amount: 0,
      isReputation: false,
    })
  })
})
