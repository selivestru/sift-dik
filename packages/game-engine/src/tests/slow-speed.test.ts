import { describe, expect, test } from 'vitest'

import { tempSlow } from '../catalog/spells/temp-slow'
import { tempStun } from '../catalog/spells/temp-stun'
import { applyAction } from '../core'
import { createGame } from './scenario'
import { GAME_ACTION_TYPE, type UnitCard } from '../types'
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

const createStackState = () => {
  const state = createGame(
    [
      {
        id: 'p1',
        cards: [tempSlow, createUnit(), createUnit(), createUnit(), createUnit()],
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

  const afterP2Play = applyAction(state, {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: p2Id,
    cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'unit-template')!.instanceId,
  }).state

  const afterP1Play = applyAction(afterP2Play, {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: p1Id,
    cardInstanceId: afterP2Play.players[p1Id]!.hand.find((c) => c.id === 'unit-template')!
      .instanceId,
  }).state

  return { state: afterP1Play, p1Id, p2Id }
}

describe('Spell speed: Slow', () => {
  test('slow spell resolves when the opponent accepts the committed sequence', () => {
    const { state, p1Id, p2Id } = createStackState()

    // P2 passes priority so P1 can cast the slow spell
    const p2Pass = applyAction(state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p2Id,
    }).state

    const targetUnit = p2Pass.players[p1Id]!.board.find((u) => u.id === 'unit-template')!

    const castResult = applyAction(p2Pass, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p1Id,
      cardInstanceId: p2Pass.players[p1Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_SLOW)!
        .instanceId,
      targets: [targetUnit.instanceId],
    })

    expect(castResult.state.spellStack).toHaveLength(1)
    expect(castResult.state.turnPlayerId).toBe(p2Id)

    const declinePassOutcome = applyAction(castResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p2Id,
    })
    const declinePass = declinePassOutcome.state

    expect(declinePass.spellStack).toHaveLength(0)

    const resolvePass = declinePassOutcome

    expect(resolvePass.state.spellStack).toHaveLength(0)
    const buffedUnit = resolvePass.state.players[p1Id]!.board.find((u) => u.id === 'unit-template')!
    expect(buffedUnit.attack).toBe(3)
    expect(buffedUnit.health).toBe(3)
    expect(buffedUnit.maxHealth).toBe(3)
    expect(resolvePass.state.players[p1Id]!.graveyard).toContainEqual(
      expect.objectContaining({ id: SPELL_TYPES.TEMP_SLOW }),
    )
    expect(resolvePass.state.turnPlayerId).toBe(p2Id)
  })

  test('slow spell cannot be cast while combat is in progress', () => {
    const { state, p1Id, p2Id } = createStackState()

    const attackerUnit = state.players[p2Id]!.board.find((u) => u.id === 'unit-template')!
    const attackState = applyAction(state, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [attackerUnit.instanceId],
    }).state

    expect(() => {
      applyAction(attackState, {
        type: GAME_ACTION_TYPE.PLAY_SPELL,
        playerId: p1Id,
        cardInstanceId: attackState.players[p1Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_SLOW)!
          .instanceId,
      })
    }).toThrow('Cannot play slow spell while combat is in progress')
  })

  test('slow spell cannot be cast while spells are on the stack', () => {
    const { state, p1Id, p2Id } = createStackState()

    const targetUnit = state.players[p1Id]!.board.find((u) => u.id === 'unit-template')!
    const stackState = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_STUN)!
        .instanceId,
      targets: [targetUnit.instanceId],
    }).state

    expect(() => {
      applyAction(stackState, {
        type: GAME_ACTION_TYPE.PLAY_SPELL,
        playerId: p1Id,
        cardInstanceId: stackState.players[p1Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_SLOW)!
          .instanceId,
        targets: [targetUnit.instanceId],
      })
    }).toThrow('Cannot play slow spell while other spells are on the stack')
  })

  test('unit cannot be played while spells are on the stack', () => {
    const { state, p1Id, p2Id } = createStackState()

    const targetUnit = state.players[p1Id]!.board.find((u) => u.id === 'unit-template')!
    const stackState = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === SPELL_TYPES.TEMP_STUN)!
        .instanceId,
      targets: [targetUnit.instanceId],
    }).state

    const unitInHand = stackState.players[p1Id]!.hand.find((c) => c.id === 'unit-template')!

    expect(() => {
      applyAction(stackState, {
        type: GAME_ACTION_TYPE.PLAY_UNIT,
        playerId: p1Id,
        cardInstanceId: unitInHand.instanceId,
      })
    }).toThrow('Cannot play unit while spells are on the stack')
  })
})
