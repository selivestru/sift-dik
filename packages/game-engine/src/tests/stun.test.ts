import { describe, expect, test } from 'vitest'

import { tempStun } from '../catalog/spells/temp-stun'
import { MAX_REPUTATION } from '../constants/game'
import { applyAction, createGame } from '../core'
import { GAME_ACTION_TYPE, KEYWORD, type UnitCard } from '../types'
import { SPELL_TYPES } from '../types/spells.types'
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

describe('Keyword: Stunned', () => {
  test('stunned unit cannot be declared as attacker', () => {
    const stunnedUnit = createUnit({
      id: 'stunned-unit',
      keywords: [KEYWORD.STUNNED],
    })

    const state = createGame(
      [
        { id: 'p1', cards: [createUnit(), createUnit(), createUnit(), createUnit(), createUnit()] },
        {
          id: 'p2',
          cards: [stunnedUnit, createUnit(), createUnit(), createUnit(), createUnit()],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const attackerId = state.turnPlayerId // p2
    const defenderId = getNextPlayerId(state) // p1

    const afterPlay = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: attackerId,
      cardInstanceId: state.players[attackerId]!.hand.find((c) => c.id === 'stunned-unit')!
        .instanceId,
    }).state

    const backToAttacker = applyAction(afterPlay, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: defenderId,
    }).state

    const stunnedOnBoard = backToAttacker.players[attackerId]!.board.find(
      (u) => u.id === 'stunned-unit',
    )!

    expect(() => {
      applyAction(backToAttacker, {
        type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
        playerId: attackerId,
        attackers: [stunnedOnBoard.instanceId],
      })
    }).toThrow('Cannot declare attack: one or more attackers have the "stunned" keyword')
  })

  test('stunned unit cannot be declared as blocker', () => {
    const stunnedBlocker = createUnit({
      id: 'stunned-blocker',
      keywords: [KEYWORD.STUNNED],
    })

    const state = createGame(
      [
        {
          id: 'p1',
          cards: [stunnedBlocker, createUnit(), createUnit(), createUnit(), createUnit()],
        },
        { id: 'p2', cards: [createUnit(), createUnit(), createUnit(), createUnit(), createUnit()] },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const attackerId = state.turnPlayerId // p2
    const defenderId = getNextPlayerId(state) // p1

    const afterP2Play = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: attackerId,
      cardInstanceId: state.players[attackerId]!.hand.find((c) => c.id === 'unit-template')!
        .instanceId,
    }).state

    const afterP1Play = applyAction(afterP2Play, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: defenderId,
      cardInstanceId: afterP2Play.players[defenderId]!.hand.find((c) => c.id === 'stunned-blocker')!
        .instanceId,
    }).state

    const attackerUnit = afterP1Play.players[attackerId]!.board.find(
      (u) => u.id === 'unit-template',
    )!
    const attackState = applyAction(afterP1Play, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: attackerId,
      attackers: [attackerUnit.instanceId],
    }).state

    const stunnedOnBoard = attackState.players[defenderId]!.board.find(
      (u) => u.id === 'stunned-blocker',
    )!

    expect(() => {
      applyAction(attackState, {
        type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
        playerId: defenderId,
        blocks: [
          {
            attackerInstanceId: attackerUnit.instanceId,
            defenderInstanceId: stunnedOnBoard.instanceId,
          },
        ],
      })
    }).toThrow('Cannot declare block: one or more defender units have the "stunned" keyword')
  })

  test('temp-stun spell stuns an enemy until end of round', () => {
    const targetUnit = createUnit({ id: 'target-unit' })

    const state = createGame(
      [
        {
          id: 'p1',
          cards: [targetUnit, createUnit(), createUnit(), createUnit(), createUnit()],
        },
        {
          id: 'p2',
          cards: [tempStun, createUnit(), createUnit(), createUnit(), createUnit()],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const p2Id = state.turnPlayerId // p2
    const p1Id = getNextPlayerId(state) // p1

    state.players[p2Id]!.energy = 10

    // Step 1: P2 plays a dummy unit, P1 plays the target
    const afterP2Play = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'unit-template')!.instanceId,
    }).state

    const afterP1Play = applyAction(afterP2Play, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterP2Play.players[p1Id]!.hand.find((c) => c.id === 'target-unit')!
        .instanceId,
    }).state

    // Step 2: P2 casts temp-stun on P1's target
    const spellResult = applyAction(afterP1Play, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: afterP1Play.players[p2Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_STUN)!
        .instanceId,
      targetUnitInstanceId: afterP1Play.players[p1Id]!.board.find((u) => u.id === 'target-unit')!
        .instanceId,
    })

    expect(spellResult.state.spellStack).toHaveLength(1)

    // Step 3: P1 passes, P2 passes -> spell resolves, target is stunned
    const declinePass = applyAction(spellResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const resolved = applyAction(declinePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: declinePass.turnPlayerId,
    }).state

    const stunnedUnit = resolved.players[p1Id]!.board.find((u) => u.id === 'target-unit')!

    expect(stunnedUnit.keywords).toContain(KEYWORD.STUNNED)
    expect(stunnedUnit.tempKeywords).toContain(KEYWORD.STUNNED)

    // Step 4: Both players pass -> round ends -> stun expires
    const pass1 = applyAction(resolved, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: resolved.turnPlayerId,
    }).state

    const round2 = applyAction(pass1, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: pass1.turnPlayerId,
    }).state

    const revertedUnit = round2.players[p1Id]!.board.find((u) => u.id === 'target-unit')!

    expect(revertedUnit.keywords).not.toContain(KEYWORD.STUNNED)
    expect(revertedUnit.tempKeywords).toHaveLength(0)

    // Round 2: initiative flipped to p1, the ex-stunned unit attacks again
    const attackResult = applyAction(round2, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p1Id,
      attackers: [revertedUnit.instanceId],
    })

    expect(attackResult.state.combat).not.toBeNull()
  })

  test('stunning an attacking unit removes it from combat and cancels its strike', () => {
    const attackerUnit = createUnit({ id: 'attacker-unit' })

    const state = createGame(
      [
        {
          id: 'p1',
          cards: [tempStun, createUnit(), createUnit(), createUnit(), createUnit()],
        },
        {
          id: 'p2',
          cards: [attackerUnit, createUnit(), createUnit(), createUnit(), createUnit()],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const p2Id = state.turnPlayerId // p2
    const p1Id = getNextPlayerId(state) // p1

    state.players[p1Id]!.energy = 10

    // Step 1: P2 plays the attacker, P1 passes
    const afterP2Play = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'attacker-unit')!.instanceId,
    }).state

    const backToP2 = applyAction(afterP2Play, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    // Step 2: P2 declares attacks -> attacker sits in combat slots
    const attackerOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === 'attacker-unit')!
    const attackState = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [attackerOnBoard.instanceId],
    }).state

    expect(attackState.combat!.slots).toHaveLength(1)
    expect(attackState.players[p2Id]!.board).toHaveLength(0)

    // Step 3: P1 stuns the attacker mid-combat, P2 passes -> spell resolves
    const spellResult = applyAction(attackState, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p1Id,
      cardInstanceId: attackState.players[p1Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_STUN)!
        .instanceId,
      targetUnitInstanceId: attackerOnBoard.instanceId,
    })

    expect(spellResult.state.spellStack[0]!.spell.id).toBe(SPELL_TYPES.TEMP_STUN)

    const declinePass = applyAction(spellResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p2Id,
    }).state

    const resolved = applyAction(declinePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: declinePass.turnPlayerId,
    }).state

    // Stunned attacker is removed from combat and returned to P2's board
    expect(resolved.combat!.slots).toHaveLength(0)
    const attackerBackOnBoard = resolved.players[p2Id]!.board.find((u) => u.id === 'attacker-unit')!
    expect(attackerBackOnBoard.keywords).toContain(KEYWORD.STUNNED)

    // Step 4: P2 passes, P1 declares no blocks, both pass -> combat resolves with no strike
    const attackerPriorityPass = applyAction(resolved, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: resolved.turnPlayerId,
    }).state

    const blockResult = applyAction(attackerPriorityPass, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: p1Id,
      blocks: [],
    })

    const strikePass = applyAction(blockResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: blockResult.state.turnPlayerId,
    }).state

    const combatResult = applyAction(strikePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: strikePass.turnPlayerId,
    })

    expect(combatResult.state.combat).toBeNull()
    expect(combatResult.state.players[p2Id]!.reputation).toBe(MAX_REPUTATION)
  })

  test('stunning a blocking unit removes it from combat and the attacker strikes reputation', () => {
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
          cards: [attackerUnit, tempStun, createUnit(), createUnit(), createUnit()],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const p2Id = state.turnPlayerId // p2
    const p1Id = getNextPlayerId(state) // p1

    state.players[p2Id]!.energy = 10

    // Step 1: P2 plays the attacker, P1 plays the blocker
    const afterP2Play = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'attacker-unit')!.instanceId,
    }).state

    const afterP1Play = applyAction(afterP2Play, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterP2Play.players[p1Id]!.hand.find((c) => c.id === 'blocker-unit')!
        .instanceId,
    }).state

    // Step 2: P2 declares attacks
    const attackerOnBoard = afterP1Play.players[p2Id]!.board.find((u) => u.id === 'attacker-unit')!
    const attackState = applyAction(afterP1Play, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [attackerOnBoard.instanceId],
    }).state

    // Step 3: P1 blocks, P2 stuns the blocker after blocks are declared
    const blockerOnBoard = attackState.players[p1Id]!.board.find((u) => u.id === 'blocker-unit')!
    const blockState = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: p1Id,
      blocks: [
        {
          attackerInstanceId: attackerOnBoard.instanceId,
          defenderInstanceId: blockerOnBoard.instanceId,
        },
      ],
    }).state

    expect(blockState.combat!.blocksDeclared).toBe(true)
    expect(blockState.combat!.slots[0]!.blocker).not.toBeNull()

    const spellResult = applyAction(blockState, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: blockState.players[p2Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_STUN)!
        .instanceId,
      targetUnitInstanceId: blockerOnBoard.instanceId,
    })

    const declinePass = applyAction(spellResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const resolved = applyAction(declinePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: declinePass.turnPlayerId,
    }).state

    // Stunned blocker is removed from combat back to P1's board
    expect(resolved.combat!.slots[0]!.blocker).toBeNull()
    const blockerBackOnBoard = resolved.players[p1Id]!.board.find((u) => u.id === 'blocker-unit')!
    expect(blockerBackOnBoard.keywords).toContain(KEYWORD.STUNNED)

    // Step 4: Both players pass -> attacker strikes the reputation unblocked
    const strikePass = applyAction(resolved, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: resolved.turnPlayerId,
    }).state

    const combatResult = applyAction(strikePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: strikePass.turnPlayerId,
    })

    expect(combatResult.state.combat).toBeNull()
    expect(combatResult.state.players[p1Id]!.reputation).toBe(MAX_REPUTATION - 2)
    expect(
      combatResult.state.players[p2Id]!.board.find((u) => u.id === 'attacker-unit'),
    ).toBeDefined()
    expect(combatResult.state.players[p1Id]!.graveyard.find((u) => u.id === 'blocker-unit')).toBe(
      undefined,
    )
  })

  test('casting stun twice does not duplicate the keyword', () => {
    const targetUnit = createUnit({ id: 'target-unit' })

    const state = createGame(
      [
        {
          id: 'p1',
          cards: [targetUnit, createUnit(), createUnit(), createUnit(), createUnit()],
        },
        {
          id: 'p2',
          cards: [tempStun, { ...tempStun }, createUnit(), createUnit(), createUnit()],
        },
      ],
      { seed: 42 }, // p2 has initiative
    )

    const p2Id = state.turnPlayerId // p2
    const p1Id = getNextPlayerId(state) // p1

    state.players[p2Id]!.energy = 10

    const afterP2Play = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'unit-template')!.instanceId,
    }).state

    const afterP1Play = applyAction(afterP2Play, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterP2Play.players[p1Id]!.hand.find((c) => c.id === 'target-unit')!
        .instanceId,
    }).state

    const targetInstanceId = afterP1Play.players[p1Id]!.board.find(
      (u) => u.id === 'target-unit',
    )!.instanceId

    const firstCast = applyAction(afterP1Play, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: afterP1Play.players[p2Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_STUN)!
        .instanceId,
      targetUnitInstanceId: targetInstanceId,
    }).state

    const firstDeclinePass = applyAction(firstCast, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const afterFirstResolve = applyAction(firstDeclinePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: firstDeclinePass.turnPlayerId,
    }).state

    // After the first spell resolves, priority is with its caster's opponent (p1)
    const priorityPass = applyAction(afterFirstResolve, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: afterFirstResolve.turnPlayerId,
    }).state

    const secondCast = applyAction(priorityPass, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: priorityPass.players[p2Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_STUN)!
        .instanceId,
      targetUnitInstanceId: targetInstanceId,
    }).state

    const secondDeclinePass = applyAction(secondCast, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const afterSecondResolve = applyAction(secondDeclinePass, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: secondDeclinePass.turnPlayerId,
    }).state

    const stunnedUnit = afterSecondResolve.players[p1Id]!.board.find((u) => u.id === 'target-unit')!

    expect(stunnedUnit.keywords?.filter((k) => k === KEYWORD.STUNNED)).toHaveLength(1)
    expect(stunnedUnit.tempKeywords?.filter((k) => k === KEYWORD.STUNNED)).toHaveLength(1)
  })
})
