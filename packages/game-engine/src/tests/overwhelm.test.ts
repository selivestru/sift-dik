import { describe, expect, test } from 'vitest'

import { applyAction, createGame } from '../core'
import { GAME_ACTION_TYPE, GAME_EVENT_TYPE, UNIT_KEYWORD, type UnitCard } from '../types'
import { getNextPlayerId } from '../utils/getNextPlayerId'

const createUnit = (overrides: Partial<UnitCard> = {}): UnitCard => ({
  id: 'unit-template',
  name: 'Unit',
  description: 'Test unit',
  faction: 'dik',
  baseCost: 1,
  cost: 1,
  type: 'unit',
  baseAttack: 3,
  attack: 3,
  maxAttack: 3,
  baseHealth: 3,
  health: 3,
  maxHealth: 3,
  ...overrides,
})

describe('Keyword: Overwhelm', () => {
  test('attacker with overwhelm deals excess damage to opponent reputation', () => {
    const overwhelmAttacker = createUnit({
      id: 'overwhelm-unit',
      attack: 5,
      baseAttack: 5,
      maxAttack: 5,
      health: 4,
      baseHealth: 4,
      maxHealth: 4,
      keywords: [UNIT_KEYWORD.OVERWHELM],
    })

    const smallBlocker = createUnit({
      id: 'small-blocker',
      attack: 2,
      baseAttack: 2,
      maxAttack: 2,
      health: 2,
      baseHealth: 2,
      maxHealth: 2,
    })

    const state = createGame(
      [
        { id: 'p1', cards: [smallBlocker, smallBlocker, smallBlocker, smallBlocker, smallBlocker] },
        {
          id: 'p2',
          cards: [
            overwhelmAttacker,
            overwhelmAttacker,
            overwhelmAttacker,
            overwhelmAttacker,
            overwhelmAttacker,
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
      cardInstanceId: state.players[attackerId]!.hand[0]!.instanceId,
    }).state

    const stateAfterP1 = applyAction(stateAfterP2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defenderId,
      cardInstanceId: stateAfterP2.players[defenderId]!.hand[0]!.instanceId,
    }).state

    // 2. P2 attacks with overwhelm unit, P1 blocks with small unit
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

    // Blocker dies (2 HP - 2 dmg = 0)
    expect(combatResult.state.players[defenderId]!.board).toHaveLength(0)
    expect(combatResult.state.players[defenderId]!.graveyard).toHaveLength(1)

    // Attacker survives with counter-damage (4 HP - 2 dmg = 2 HP)
    expect(combatResult.state.players[attackerId]!.board[0]!.health).toBe(2)

    // Defender's reputation receives excess damage: 20 - (5 attack - 2 blocker HP) = 17
    expect(combatResult.state.players[defenderId]!.reputation).toBe(17)

    // Events verify both unit damage and reputation damage
    expect(combatResult.events).toContainEqual({
      type: GAME_EVENT_TYPE.DAMAGE_DEALT,
      targetId: defendingUnitId,
      amount: 2,
      isReputation: false,
    })

    expect(combatResult.events).toContainEqual({
      type: GAME_EVENT_TYPE.DAMAGE_DEALT,
      targetId: defenderId,
      amount: 3,
      isReputation: true,
    })
  })
})
