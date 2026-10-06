import { describe, expect, test } from 'vitest'

import { applyAction } from '../core'
import { createGame } from './scenario'
import { GAME_ACTION_TYPE, KEYWORD, type UnitCard } from '../types'
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

describe('Keyword: Pressure', () => {
  test('unit with pressure can only be blocked by enemies with 3 or more attack', () => {
    const pressureAttacker = createUnit({
      id: 'pressure-attacker',
      attack: 3,
      baseAttack: 3,
      health: 3,
      baseHealth: 3,
      maxHealth: 3,
      keywords: [KEYWORD.PRESSURE],
    })

    const weakBlocker = createUnit({
      id: 'weak-blocker',
      attack: 2,
      baseAttack: 2,
      health: 3,
      baseHealth: 3,
      maxHealth: 3,
    })

    const strongBlocker = createUnit({
      id: 'strong-blocker',
      attack: 3,
      baseAttack: 3,
      health: 3,
      baseHealth: 3,
      maxHealth: 3,
    })

    const state = createGame(
      [
        {
          id: 'p1',
          cards: [weakBlocker, strongBlocker, createUnit(), createUnit(), createUnit()],
        },
        {
          id: 'p2',
          cards: [pressureAttacker, createUnit(), createUnit(), createUnit(), createUnit()],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const attackerId = state.turnPlayerId // p2
    const defenderId = getNextPlayerId(state) // p1

    // Step 1: P2 plays pressure attacker
    const afterP2Play = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: attackerId,
      cardInstanceId: state.players[attackerId]!.hand.find((c) => c.id === 'pressure-attacker')!
        .instanceId,
    }).state

    // Step 2: P1 plays weak blocker
    const afterP1WeakPlay = applyAction(afterP2Play, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defenderId,
      cardInstanceId: afterP2Play.players[defenderId]!.hand.find((c) => c.id === 'weak-blocker')!
        .instanceId,
    }).state

    // P2 passes priority back to P1
    const p2Pass = applyAction(afterP1WeakPlay, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: attackerId,
    }).state

    // P1 plays strong blocker
    p2Pass.players[defenderId]!.energy = 10
    const afterP1StrongPlay = applyAction(p2Pass, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defenderId,
      cardInstanceId: p2Pass.players[defenderId]!.hand.find((c) => c.id === 'strong-blocker')!
        .instanceId,
    }).state

    // Step 3: P2 attacks with pressure unit
    const attackerUnit = afterP1StrongPlay.players[attackerId]!.board.find(
      (u) => u.id === 'pressure-attacker',
    )!
    const attackState = applyAction(afterP1StrongPlay, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: attackerId,
      attackers: [attackerUnit.instanceId],
    }).state

    const weakDefenderUnit = attackState.players[defenderId]!.board.find(
      (u) => u.id === 'weak-blocker',
    )!
    const strongDefenderUnit = attackState.players[defenderId]!.board.find(
      (u) => u.id === 'strong-blocker',
    )!

    // 1. Weak unit (attack 2) tries to block pressure attacker -> throws error
    expect(() => {
      applyAction(attackState, {
        type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
        playerId: defenderId,
        blocks: [
          {
            attackerInstanceId: attackerUnit.instanceId,
            defenderInstanceId: weakDefenderUnit.instanceId,
          },
        ],
      })
    }).toThrow(
      `Cannot declare block: unit "${weakDefenderUnit.instanceId}" has less than 3 attack and cannot block pressure attacker "${attackerUnit.instanceId}"`,
    )

    // 2. Strong unit (attack 3) blocks pressure attacker -> succeeds
    const validBlockResult = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: defenderId,
      blocks: [
        {
          attackerInstanceId: attackerUnit.instanceId,
          defenderInstanceId: strongDefenderUnit.instanceId,
        },
      ],
    })

    // Both players pass consecutively to resolve the combat strikes
    const strikePass = validBlockResult.state

    const combatResult = validBlockResult

    expect(combatResult.state.combat).toBeNull()
  })
})
