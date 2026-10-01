import { describe, expect, test } from 'vitest'

import { preemptiveStrike } from '../catalog/spells/preemptive-strike'
import { tempStun } from '../catalog/spells/temp-stun'
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

describe('Spell stack resolution', () => {
  test('spells resolve one at a time, top of the stack first, with a reaction window between', () => {
    const psTarget = createUnit({ id: 'ps-target' })

    const state = createGame(
      [
        {
          id: 'p1',
          cards: [psTarget, preemptiveStrike, createUnit(), createUnit(), createUnit()],
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
    state.players[p1Id]!.energy = 10

    // Step 1: P2 plays a dummy, P1 plays the spell target
    const afterP2Play = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'unit-template')!.instanceId,
    }).state

    const afterP1Play = applyAction(afterP2Play, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterP2Play.players[p1Id]!.hand.find((c) => c.id === 'ps-target')!.instanceId,
    }).state

    const targetInstanceId = afterP1Play.players[p1Id]!.board.find(
      (u) => u.id === 'ps-target',
    )!.instanceId

    // Step 2: P2 casts stun, P1 responds with Preemptive Strike on the same unit
    const stunCast = applyAction(afterP1Play, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: afterP1Play.players[p2Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_STUN)!
        .instanceId,
      targetUnitInstanceId: targetInstanceId,
    }).state

    const psCast = applyAction(stunCast, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p1Id,
      cardInstanceId: stunCast.players[p1Id]!.hand.find(
        (c) => c.id === SPELL_TYPES.PREEMPTIVE_STRIKE,
      )!.instanceId,
      targetUnitInstanceId: targetInstanceId,
    }).state

    expect(psCast.spellStack).toHaveLength(2)
    expect(psCast.spellStack[0]!.spell.id).toBe(SPELL_TYPES.TEMP_STUN)
    expect(psCast.spellStack[1]!.spell.id).toBe(SPELL_TYPES.PREEMPTIVE_STRIKE)

    // Step 3: Both players pass -> only the TOP spell (Preemptive Strike) resolves
    const firstDecline = applyAction(psCast, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: psCast.turnPlayerId,
    }).state

    const firstResolve = applyAction(firstDecline, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: firstDecline.turnPlayerId,
    })

    expect(firstResolve.state.spellStack).toHaveLength(1)
    expect(firstResolve.state.spellStack[0]!.spell.id).toBe(SPELL_TYPES.TEMP_STUN)
    expect(firstResolve.state.players[p1Id]!.graveyard).toContainEqual(
      expect.objectContaining({ id: SPELL_TYPES.PREEMPTIVE_STRIKE }),
    )

    // The resolved spell took effect immediately
    const buffedUnit = firstResolve.state.players[p1Id]!.board.find((u) => u.id === 'ps-target')!
    expect(buffedUnit.attack).toBe(4)
    expect(buffedUnit.health).toBe(3)
    expect(buffedUnit.keywords).toContain(KEYWORD.QUICK_ATTACK)

    // Priority after resolution: opponent of the resolved spell's caster
    expect(firstResolve.state.turnPlayerId).toBe(p2Id)

    // Step 4: Both players pass again -> the stun resolves
    const secondDecline = applyAction(firstResolve.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: firstResolve.state.turnPlayerId,
    }).state

    const secondResolve = applyAction(secondDecline, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: secondDecline.turnPlayerId,
    })

    expect(secondResolve.state.spellStack).toHaveLength(0)
    const stunnedUnit = secondResolve.state.players[p1Id]!.board.find((u) => u.id === 'ps-target')!
    expect(stunnedUnit.keywords).toContain(KEYWORD.STUNNED)
    expect(secondResolve.state.round).toBe(1)
  })
})
