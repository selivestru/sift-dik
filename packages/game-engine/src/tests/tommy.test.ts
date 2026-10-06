import { describe, expect, test } from 'vitest'

import { tommyCard } from '../catalog/characters/tommy'
import { warmUpTheCrowd } from '../catalog/spells/warm-up-the-crowd'
import { applyAction } from '../core'
import { createGame } from './scenario'
import {
  GAME_ACTION_TYPE,
  KEYWORD,
  type CardDefinition,
  type CardInstance,
  type GameState,
  type UnitCard,
} from '../types'
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
  relatedCards: [],
  ...overrides,
})

const p1Cards = (...cards: UnitCard[]): { id: string; cards: UnitCard[] } => ({
  id: 'p1',
  cards: [...cards, createUnit(), createUnit(), createUnit(), createUnit(), createUnit()],
})

const p2Cards = (...cards: CardDefinition[]): { id: string; cards: CardDefinition[] } => ({
  id: 'p2',
  cards: [...cards, createUnit(), createUnit(), createUnit()],
})

const arrangeZones = (
  state: GameState,
  playerId: string,
  handIds: string[],
  deckIds: string[],
): void => {
  const player = state.players[playerId]!
  const pool: CardInstance[] = [...player.hand, ...player.deck]

  const take = (id: string): CardInstance => {
    const index = pool.findIndex((c) => c.id === id)

    return pool.splice(index, 1)[0]!
  }

  player.hand = handIds.map(take)
  player.deck = deckIds.map(take)
}

const findSlot = (state: GameState, unitId: string) =>
  state.combat!.slots.find((slot) => slot.attacker.instanceId === unitId)

describe('Character: Tommy', () => {
  test('attacking summons Guests as an attacking unit in combat', () => {
    const state = createGame([p1Cards(), p2Cards(tommyCard)], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterTommy = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'tommy')!.instanceId,
    }).state

    const backToP2 = applyAction(afterTommy, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const tommyOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === 'tommy')!

    const attackResult = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [tommyOnBoard.instanceId],
    })

    const attackState = attackResult.state

    const guestsSlot = attackState.combat!.slots.find((slot) => slot.attacker.id === 'guests')!

    expect(attackState.combat!.slots).toHaveLength(2)
    expect(guestsSlot.attacker.attack).toBe(4)
    expect(guestsSlot.attacker.health).toBe(3)
    expect(guestsSlot.attacker.keywords).toContain(KEYWORD.EPHEMERAL)
    expect(guestsSlot.blocker).toBeNull()
    expect(attackResult.events).toContainEqual(
      expect.objectContaining({ type: 'UNIT_SPAWNED', playerId: p2Id }),
    )

    const blockStateOutcome = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: p1Id,
      blocks: [],
    })
    const blockState = blockStateOutcome.state

    const strikePass = blockStateOutcome.state

    const combatResult = blockStateOutcome.state

    expect(combatResult.players[p1Id]!.reputation).toBe(12)
    expect(combatResult.players[p2Id]!.graveyard.find((u) => u.id === 'guests')).toBeDefined()
    expect(combatResult.players[p2Id]!.board.find((u) => u.id === 'tommy')).toBeDefined()
  })

  test('defender can block the summoned Guests; both die in the trade', () => {
    const state = createGame(
      [p1Cards(createUnit({ id: 'blocker', attack: 4, baseAttack: 4 })), p2Cards(tommyCard)],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    state.players[p1Id]!.energy = 10

    const afterTommy = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'tommy')!.instanceId,
    }).state

    const afterBlocker = applyAction(afterTommy, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterTommy.players[p1Id]!.hand.find((c) => c.id === 'blocker')!.instanceId,
    }).state

    const tommyOnBoard = afterBlocker.players[p2Id]!.board.find((u) => u.id === 'tommy')!

    const attackState = applyAction(afterBlocker, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [tommyOnBoard.instanceId],
    }).state

    const guestsSlot = attackState.combat!.slots.find((slot) => slot.attacker.id === 'guests')!
    const blockerOnBoard = attackState.players[p1Id]!.board.find((u) => u.id === 'blocker')!

    const blockStateOutcome = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: p1Id,
      blocks: [
        {
          attackerInstanceId: guestsSlot.attacker.instanceId,
          defenderInstanceId: blockerOnBoard.instanceId,
        },
      ],
    })
    const blockState = blockStateOutcome.state

    const strikePass = blockStateOutcome.state

    const combatResult = blockStateOutcome.state

    expect(combatResult.players[p2Id]!.graveyard.find((u) => u.id === 'guests')).toBeDefined()
    expect(combatResult.players[p1Id]!.graveyard.find((u) => u.id === 'blocker')).toBeDefined()
    expect(combatResult.players[p2Id]!.board.find((u) => u.id === 'tommy')).toBeDefined()
  })

  test('each Tommy summons his own Guests', () => {
    const state = createGame([p1Cards(), p2Cards(tommyCard, tommyCard)], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    arrangeZones(
      state,
      p2Id,
      ['tommy', 'tommy'],
      ['unit-template', 'unit-template', 'unit-template'],
    )

    const afterTommyA = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'tommy')!.instanceId,
    }).state

    const backToP2 = applyAction(afterTommyA, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const afterTommyB = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: backToP2.players[p2Id]!.hand.find((c) => c.id === 'tommy')!.instanceId,
    }).state

    const p1Pass = applyAction(afterTommyB, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const tommys = p1Pass.players[p2Id]!.board.filter((u) => u.id === 'tommy')

    const attackState = applyAction(p1Pass, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: tommys.map((t) => t.instanceId),
    }).state

    const guestsSlots = attackState.combat!.slots.filter((slot) => slot.attacker.id === 'guests')

    expect(attackState.combat!.slots).toHaveLength(4)
    expect(guestsSlots).toHaveLength(2)
    expect(new Set(guestsSlots.map((slot) => slot.attacker.instanceId)).size).toBe(2)
  })

  test('Guests are not summoned when there are already 6 attackers', () => {
    const state = createGame(
      [
        p1Cards(),
        p2Cards(tommyCard, createUnit(), createUnit(), createUnit(), createUnit(), createUnit()),
      ],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    arrangeZones(
      state,
      p2Id,
      [
        'tommy',
        'unit-template',
        'unit-template',
        'unit-template',
        'unit-template',
        'unit-template',
      ],
      [],
    )

    let currentState = state

    for (let i = 0; i < 6; i++) {
      const card =
        currentState.players[p2Id]!.hand.find((c) => c.id === 'tommy') ??
        currentState.players[p2Id]!.hand.find((c) => c.id === 'unit-template')!

      currentState = applyAction(currentState, {
        type: GAME_ACTION_TYPE.PLAY_UNIT,
        playerId: p2Id,
        cardInstanceId: card.instanceId,
      }).state

      currentState = applyAction(currentState, {
        type: GAME_ACTION_TYPE.PASS,
        playerId: p1Id,
      }).state
    }

    expect(currentState.players[p2Id]!.board).toHaveLength(6)

    const attackers = currentState.players[p2Id]!.board.map((u) => u.instanceId)

    const attackResult = applyAction(currentState, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers,
    })

    const attackState = attackResult.state

    expect(attackState.combat!.slots).toHaveLength(6)
    expect(attackState.combat!.slots.some((slot) => slot.attacker.id === 'guests')).toBe(false)
    expect(attackResult.events.some((e) => e.type === 'UNIT_SPAWNED')).toBe(false)
  })

  test('Warm Up the Crowd grants +1|+0 to all own fighters outside combat', () => {
    const ally = createUnit({ id: 'ally' })
    const state = createGame([p1Cards(), p2Cards(tommyCard, ally, warmUpTheCrowd)], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    arrangeZones(
      state,
      p2Id,
      ['tommy', 'ally', 'warm-up-the-crowd'],
      ['unit-template', 'unit-template', 'unit-template'],
    )

    const afterTommy = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'tommy')!.instanceId,
    }).state

    const backToP2 = applyAction(afterTommy, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const afterAlly = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: backToP2.players[p2Id]!.hand.find((c) => c.id === 'ally')!.instanceId,
    }).state

    const backToP2Again = applyAction(afterAlly, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const tommyOnBoard = backToP2Again.players[p2Id]!.board.find((u) => u.id === 'tommy')!
    const allyOnBoard = backToP2Again.players[p2Id]!.board.find((u) => u.id === 'ally')!

    const castResult = applyAction(backToP2Again, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: backToP2Again.players[p2Id]!.hand.find((c) => c.id === 'warm-up-the-crowd')!
        .instanceId,
    })

    expect(castResult.state.spellStack).toHaveLength(1)

    const declinePassOutcome = applyAction(castResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    })
    const declinePass = declinePassOutcome.state

    const resolved = declinePassOutcome.state

    expect(
      resolved.players[p2Id]!.board.find((u) => u.instanceId === tommyOnBoard.instanceId)!.attack,
    ).toBe(5)
    expect(
      resolved.players[p2Id]!.board.find((u) => u.instanceId === allyOnBoard.instanceId)!
        .tempAttack,
    ).toBe(1)
    expect(resolved.players[p1Id]!.board.every((u) => u.attack === 2)).toBe(true)
  })

  test('Warm Up the Crowd in combat buffs attackers and board units, reverting at round end', () => {
    const ally = createUnit({ id: 'ally' })
    const state = createGame([p1Cards(), p2Cards(tommyCard, ally, warmUpTheCrowd)], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    arrangeZones(
      state,
      p2Id,
      ['tommy', 'ally', 'warm-up-the-crowd'],
      ['unit-template', 'unit-template', 'unit-template'],
    )

    const afterTommy = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'tommy')!.instanceId,
    }).state

    const p1Pass1 = applyAction(afterTommy, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const afterAlly = applyAction(p1Pass1, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: p1Pass1.players[p2Id]!.hand.find((c) => c.id === 'ally')!.instanceId,
    }).state

    const p1Pass2 = applyAction(afterAlly, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const tommyOnBoard = p1Pass2.players[p2Id]!.board.find((u) => u.id === 'tommy')!
    const allyOnBoard = p1Pass2.players[p2Id]!.board.find((u) => u.id === 'ally')!

    const attackState = applyAction(p1Pass2, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [tommyOnBoard.instanceId],
      spells: [{ cardInstanceId: p1Pass2.players[p2Id]!.hand.find((c) => c.id === 'warm-up-the-crowd')!.instanceId }],
    }).state

    const castResult = { state: attackState, events: [] }

    const declinePassOutcome = applyAction(castResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    })
    const declinePass = declinePassOutcome.state

    const resolved = declinePassOutcome.state

    const tommyAfterCombat = resolved.players[p2Id]!.board.find((unit) => unit.instanceId === tommyOnBoard.instanceId)!
    const allyOnBoardAfter = resolved.players[p2Id]!.board.find(
      (u) => u.instanceId === allyOnBoard.instanceId,
    )!

    expect(tommyAfterCombat.attack).toBe(5)
    expect(allyOnBoardAfter.attack).toBe(3)

    const combatResult = resolved

    const round2 = finishRound(combatResult)

    const tommyAfterRound = round2.players[p2Id]!.board.find((u) => u.id === 'tommy')!
    const allyAfterRound = round2.players[p2Id]!.board.find((u) => u.id === 'ally')!

    expect(tommyAfterRound.attack).toBe(4)
    expect(tommyAfterRound.tempAttack ?? 0).toBe(0)
    expect(allyAfterRound.attack).toBe(2)
    expect(allyAfterRound.tempAttack ?? 0).toBe(0)
  })
})

function finishRound(state: GameState): GameState {
  const pass1 = applyAction(state, {
    type: GAME_ACTION_TYPE.PASS,
    playerId: state.turnPlayerId,
  }).state

  return applyAction(pass1, {
    type: GAME_ACTION_TYPE.PASS,
    playerId: pass1.turnPlayerId,
  }).state
}
