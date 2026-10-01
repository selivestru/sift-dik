import { describe, expect, test } from 'vitest'

import { preemptiveStrike } from '../catalog/spells/preemptive-strike'
import { MAX_REPUTATION } from '../constants/game'
import { applyAction, createGame } from '../core'
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

const createBlockedCombat = () => {
  const attackerUnit = createUnit({ id: 'attacker-unit', baseHealth: 3, health: 3, maxHealth: 3 })
  const blockerUnit = createUnit({ id: 'blocker-unit' })

  const state = createGame(
    [
      { id: 'p1', cards: [blockerUnit, createUnit(), createUnit(), createUnit(), createUnit()] },
      { id: 'p2', cards: [attackerUnit, createUnit(), createUnit(), createUnit(), createUnit()] },
    ],
    { seed: 42 }, // p2 has initiative
  )

  const attackerId = state.turnPlayerId // p2
  const defenderId = getNextPlayerId(state) // p1

  const afterP2Play = applyAction(state, {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: attackerId,
    cardInstanceId: state.players[attackerId]!.hand.find((c) => c.id === 'attacker-unit')!
      .instanceId,
  }).state

  const afterP1Play = applyAction(afterP2Play, {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: defenderId,
    cardInstanceId: afterP2Play.players[defenderId]!.hand.find((c) => c.id === 'blocker-unit')!
      .instanceId,
  }).state

  const attackerOnBoard = afterP1Play.players[attackerId]!.board.find(
    (u) => u.id === 'attacker-unit',
  )!
  const attackState = applyAction(afterP1Play, {
    type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
    playerId: attackerId,
    attackers: [attackerOnBoard.instanceId],
  }).state

  const blockerOnBoard = attackState.players[defenderId]!.board.find(
    (u) => u.id === 'blocker-unit',
  )!
  const blockState = applyAction(attackState, {
    type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
    playerId: defenderId,
    blocks: [
      {
        attackerInstanceId: attackerOnBoard.instanceId,
        defenderInstanceId: blockerOnBoard.instanceId,
      },
    ],
  }).state

  return { blockState, attackerId, defenderId, attackerOnBoard, blockerOnBoard }
}

describe('Combat reaction window', () => {
  test('strikes resolve only when both players pass after blocks are declared', () => {
    const { blockState, attackerId, attackerOnBoard } = createBlockedCombat()

    // Blocks are assigned but no strike has happened yet
    expect(blockState.combat).not.toBeNull()
    expect(blockState.combat!.blocksDeclared).toBe(true)
    expect(blockState.combat!.slots[0]!.blocker).not.toBeNull()
    expect(blockState.combat!.slots[0]!.attacker.instanceId).toBe(attackerOnBoard.instanceId)
    expect(blockState.players.p1!.reputation).toBe(MAX_REPUTATION)
    expect(blockState.players.p1!.graveyard).toHaveLength(0)

    const strikePass = applyAction(blockState, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: blockState.turnPlayerId,
    }).state

    const combatResult = applyAction(strikePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: strikePass.turnPlayerId,
    })

    // Combat resolved: blocker died, attacker survived and returned to the board
    expect(combatResult.state.combat).toBeNull()
    expect(
      combatResult.state.players.p1!.graveyard.find((u) => u.id === 'blocker-unit'),
    ).toBeDefined()
    expect(combatResult.state.players.p2!.board.find((u) => u.id === 'attacker-unit')!.health).toBe(
      1,
    )
    expect(combatResult.state.players.p1!.reputation).toBe(MAX_REPUTATION)

    // Combat passes do not advance the round or change initiative
    expect(combatResult.state.round).toBe(1)
    expect(combatResult.state.initiativePlayerId).toBe('p2')

    // Priority returns to the attacker after combat
    expect(combatResult.state.turnPlayerId).toBe(attackerId)
  })

  test('fast spell cast after blocks are declared resolves before strikes', () => {
    const attackerUnit = createUnit({ id: 'attacker-unit' })
    const blockerUnit = createUnit({ id: 'blocker-unit' })

    const state = createGame(
      [
        {
          id: 'p1',
          cards: [blockerUnit, createUnit(), createUnit(), createUnit(), createUnit()],
        },
        {
          id: 'p2',
          cards: [attackerUnit, preemptiveStrike, createUnit(), createUnit(), createUnit()],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const attackerId = state.turnPlayerId // p2
    const defenderId = getNextPlayerId(state) // p1

    state.players[attackerId]!.energy = 10

    const afterP2Play = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: attackerId,
      cardInstanceId: state.players[attackerId]!.hand.find((c) => c.id === 'attacker-unit')!
        .instanceId,
    }).state

    const afterP1Play = applyAction(afterP2Play, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defenderId,
      cardInstanceId: afterP2Play.players[defenderId]!.hand.find((c) => c.id === 'blocker-unit')!
        .instanceId,
    }).state

    const attackerOnBoard = afterP1Play.players[attackerId]!.board.find(
      (u) => u.id === 'attacker-unit',
    )!
    const attackState = applyAction(afterP1Play, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: attackerId,
      attackers: [attackerOnBoard.instanceId],
    }).state

    const blockerOnBoard = attackState.players[defenderId]!.board.find(
      (u) => u.id === 'blocker-unit',
    )!
    const blockState = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: defenderId,
      blocks: [
        {
          attackerInstanceId: attackerOnBoard.instanceId,
          defenderInstanceId: blockerOnBoard.instanceId,
        },
      ],
    }).state

    // Attacker buffs his own blocked unit with Preemptive Strike after seeing the block
    const spellResult = applyAction(blockState, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: attackerId,
      cardInstanceId: blockState.players[attackerId]!.hand.find(
        (c) => c.id === 'preemptive-strike',
      )!.instanceId,
      targetUnitInstanceId: attackerOnBoard.instanceId,
    })

    expect(spellResult.state.combat).not.toBeNull()

    const declinePass = applyAction(spellResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: spellResult.state.turnPlayerId,
    }).state

    const stackResolvePass = applyAction(declinePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: declinePass.turnPlayerId,
    }).state

    const buffedAttacker = stackResolvePass.combat!.slots[0]!.attacker
    expect(buffedAttacker.attack).toBe(4)
    expect(buffedAttacker.health).toBe(3)
    expect(buffedAttacker.keywords).toContain(KEYWORD.QUICK_ATTACK)

    const strikePass = applyAction(stackResolvePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: stackResolvePass.turnPlayerId,
    }).state

    const combatResult = applyAction(strikePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: strikePass.turnPlayerId,
    })

    // Quick attack kills the blocker without retaliation, attacker survives at 3 health
    expect(combatResult.state.combat).toBeNull()
    expect(
      combatResult.state.players.p1!.graveyard.find((u) => u.id === 'blocker-unit'),
    ).toBeDefined()
    expect(combatResult.state.players.p2!.board.find((u) => u.id === 'attacker-unit')!.health).toBe(
      3,
    )
  })

  test('blocks cannot be declared twice in one combat', () => {
    const { blockState, defenderId, attackerOnBoard, blockerOnBoard } = createBlockedCombat()

    expect(() => {
      applyAction(blockState, {
        type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
        playerId: defenderId,
        blocks: [
          {
            attackerInstanceId: attackerOnBoard.instanceId,
            defenderInstanceId: blockerOnBoard.instanceId,
          },
        ],
      })
    }).toThrow('Cannot declare blocks: blockers have already been declared this combat')
  })
})
