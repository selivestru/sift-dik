import { describe, expect, test } from 'vitest'

import { preemptiveStrike } from '../catalog/spells/preemptive-strike'
import { tempStun } from '../catalog/spells/temp-stun'
import { MAX_REPUTATION } from '../constants/game'
import { applyAction } from '../core'
import { battle, createGame } from './scenario'
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
      targets: [afterP1Play.players[p1Id]!.board.find((u) => u.id === 'target-unit')!.instanceId],
    })

    expect(spellResult.state.spellStack).toHaveLength(1)

    // Step 3: P1 passes, P2 passes -> spell resolves, target is stunned
    const declinePassOutcome = applyAction(spellResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    })
    const declinePass = declinePassOutcome.state

    const resolved = declinePassOutcome.state

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
    const state = battle()
    state.players.p2!.hand.push({ ...tempStun, instanceId: 'stun', ownerId: 'p2' })
    const attacked = applyAction(state, { type: GAME_ACTION_TYPE.DECLARE_ATTACKS, playerId: 'p1', attackers: ['a'] }).state
    const reply = applyAction(attacked, { type: GAME_ACTION_TYPE.PLAY_SPELL, playerId: 'p2', cardInstanceId: 'stun', targets: ['a'] }).state
    const resolved = applyAction(reply, { type: GAME_ACTION_TYPE.PASS, playerId: 'p1' }).state
    expect(resolved.combat).toBeNull()
    expect(resolved.players.p1!.board[0]!.keywords).toContain(KEYWORD.STUNNED)
    expect(resolved.players.p2!.reputation).toBe(20)
  })

  test('stunning a committed blocker leaves the attacker blocked', () => {
    const state = battle()
    state.players.p2!.hand.push({ ...preemptiveStrike, instanceId: 'buff', ownerId: 'p2' })
    state.players.p1!.hand.push({ ...tempStun, instanceId: 'stun', ownerId: 'p1' })
    const attacked = applyAction(state, { type: GAME_ACTION_TYPE.DECLARE_ATTACKS, playerId: 'p1', attackers: ['a'] }).state
    const blocked = applyAction(attacked, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS, playerId: 'p2',
      blocks: [{ attackerInstanceId: 'a', defenderInstanceId: 'b' }],
      spells: [{ cardInstanceId: 'buff', targets: ['b'] }],
    }).state
    const reply = applyAction(blocked, { type: GAME_ACTION_TYPE.PLAY_SPELL, playerId: 'p1', cardInstanceId: 'stun', targets: ['b'] }).state
    const resolved = applyAction(reply, { type: GAME_ACTION_TYPE.PASS, playerId: 'p2' }).state
    expect(resolved.combat).toBeNull()
    expect(resolved.players.p2!.reputation).toBe(20)
    expect(resolved.players.p2!.board[0]!.keywords).toContain(KEYWORD.STUNNED)
    expect(resolved.players.p1!.board[0]!.health).toBe(4)
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
      targets: [targetInstanceId],
    }).state

    const firstDeclinePassOutcome = applyAction(firstCast, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    })
    const firstDeclinePass = firstDeclinePassOutcome.state

    const afterFirstResolve = firstDeclinePassOutcome.state

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
      targets: [targetInstanceId],
    }).state

    const secondDeclinePassOutcome = applyAction(secondCast, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    })
    const secondDeclinePass = secondDeclinePassOutcome.state

    const afterSecondResolve = secondDeclinePassOutcome.state

    const stunnedUnit = afterSecondResolve.players[p1Id]!.board.find((u) => u.id === 'target-unit')!

    expect(stunnedUnit.keywords?.filter((k) => k === KEYWORD.STUNNED)).toHaveLength(1)
    expect(stunnedUnit.tempKeywords?.filter((k) => k === KEYWORD.STUNNED)).toHaveLength(1)
  })
})
