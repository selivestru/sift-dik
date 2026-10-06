import { describe, expect, test } from 'vitest'

import { rustyCard } from '../catalog/characters/rusty'
import { brotherhood } from '../catalog/spells/brotherhood'
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

const p1Cards = (...cards: UnitCard[]): { id: string; cards: UnitCard[] } => ({
  id: 'p1',
  cards: [...cards, createUnit(), createUnit(), createUnit()],
})

const p2Cards = (...cards: CardDefinition[]): { id: string; cards: CardDefinition[] } => ({
  id: 'p2',
  cards,
})

const arrangeZones = (
  state: GameState,
  playerId: string,
  handIds: string[],
  deckIds: string[],
): void => {
  const player = state.players[playerId]!
  const cards: CardInstance[] = [...player.hand, ...player.deck]

  player.hand = handIds.map((id) => cards.find((c) => c.id === id)!)
  player.deck = deckIds.map((id) => cards.find((c) => c.id === id)!)
}

const finishRound = (state: GameState): GameState => {
  const pass1 = applyAction(state, {
    type: GAME_ACTION_TYPE.PASS,
    playerId: state.turnPlayerId,
  }).state

  return applyAction(pass1, {
    type: GAME_ACTION_TYPE.PASS,
    playerId: pass1.turnPlayerId,
  }).state
}

describe('Character: Rusty', () => {
  test('summon makes all allied DIKs in hand and deck cost 1 less', () => {
    const dikUnitA = createUnit({ id: 'dik-a', baseCost: 2, cost: 2 })
    const dikUnitB = createUnit({ id: 'dik-b', baseCost: 2, cost: 2 })
    const dikUnitC = createUnit({ id: 'dik-c', baseCost: 2, cost: 2 })
    const aaaUnit = createUnit({ id: 'aaa-unit', faction: 'aaa', baseCost: 2, cost: 2 })

    const state = createGame(
      [
        p1Cards(),
        p2Cards(
          rustyCard,
          dikUnitA,
          dikUnitB,
          dikUnitC,
          aaaUnit,
          createUnit(),
          createUnit(),
          createUnit(),
        ),
      ],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    arrangeZones(
      state,
      p2Id,
      ['rusty', 'dik-a', 'aaa-unit', 'dik-b'],
      ['dik-c', 'unit-template', 'unit-template'],
    )

    state.players[p2Id]!.energy = 10

    const afterPlay = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'rusty')!.instanceId,
    }).state

    expect(afterPlay.players[p2Id]!.hand.find((c) => c.id === 'dik-a')!.cost).toBe(1)
    expect(afterPlay.players[p2Id]!.hand.find((c) => c.id === 'dik-b')!.cost).toBe(1)
    expect(afterPlay.players[p2Id]!.deck.find((c) => c.id === 'dik-c')!.cost).toBe(1)
    expect(afterPlay.players[p2Id]!.hand.find((c) => c.id === 'aaa-unit')!.cost).toBe(2)
  })

  test('discount cannot bring a card cost below 0', () => {
    const cheapUnit = createUnit({ id: 'cheap-unit', baseCost: 1, cost: 1 })

    const state = createGame(
      [p1Cards(), p2Cards(rustyCard, cheapUnit, createUnit(), createUnit())],
      {
        seed: 42,
      },
    )

    const p2Id = state.turnPlayerId
    arrangeZones(
      state,
      p2Id,
      ['rusty', 'cheap-unit'],
      ['unit-template', 'unit-template', 'unit-template'],
    )

    state.players[p2Id]!.energy = 10

    const afterPlay = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'rusty')!.instanceId,
    }).state

    expect(afterPlay.players[p2Id]!.hand.find((c) => c.id === 'cheap-unit')!.cost).toBe(0)
  })

  test('the discount is permanent and survives the round end', () => {
    const dikUnit = createUnit({ id: 'dik-unit', baseCost: 2, cost: 2 })

    const state = createGame([p1Cards(), p2Cards(rustyCard, dikUnit)], { seed: 42 })

    const p2Id = state.turnPlayerId

    state.players[p2Id]!.energy = 10

    const afterPlay = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'rusty')!.instanceId,
    }).state

    const round2 = finishRound(afterPlay)

    expect(round2.players[p2Id]!.hand.find((c) => c.id === 'dik-unit')!.cost).toBe(1)
  })

  test('attacking grants all attacking allies +1|+1 except Rusty himself', () => {
    const allyA = createUnit({ id: 'ally-a' })
    const allyB = createUnit({ id: 'ally-b' })

    const state = createGame([p1Cards(), p2Cards(rustyCard, allyA, allyB)], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterRusty = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'rusty')!.instanceId,
    }).state

    const p1Pass1 = applyAction(afterRusty, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const afterAllyA = applyAction(p1Pass1, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: p1Pass1.players[p2Id]!.hand.find((c) => c.id === 'ally-a')!.instanceId,
    }).state

    const p1Pass2 = applyAction(afterAllyA, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const afterAllyB = applyAction(p1Pass2, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: p1Pass2.players[p2Id]!.hand.find((c) => c.id === 'ally-b')!.instanceId,
    }).state

    const p1Pass3 = applyAction(afterAllyB, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const rustyOnBoard = p1Pass3.players[p2Id]!.board.find((u) => u.id === 'rusty')!
    const allyAOnBoard = p1Pass3.players[p2Id]!.board.find((u) => u.id === 'ally-a')!
    const allyBOnBoard = p1Pass3.players[p2Id]!.board.find((u) => u.id === 'ally-b')!

    const attackState = applyAction(p1Pass3, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [rustyOnBoard.instanceId, allyAOnBoard.instanceId, allyBOnBoard.instanceId],
    }).state

    const blockStateOutcome = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: p1Id,
      blocks: [],
    })
    const blockState = blockStateOutcome.state

    const strikePass = blockStateOutcome.state

    const combatResult = blockStateOutcome.state

    const rustyOnBoardAfter = combatResult.players[p2Id]!.board.find((u) => u.id === 'rusty')!
    const allyASlot = combatResult.players[p2Id]!.board.find((u) => u.id === 'ally-a')!
    const allyBSlot = combatResult.players[p2Id]!.board.find((u) => u.id === 'ally-b')!

    expect(rustyOnBoardAfter.attack).toBe(3)
    expect(rustyOnBoardAfter.tempAttack ?? 0).toBe(0)
    expect(allyASlot.attack).toBe(3)
    expect(allyASlot.health).toBe(3)
    expect(allyASlot.tempAttack).toBe(1)
    expect(allyBSlot.tempAttack).toBe(1)
    expect(allyBSlot.tempHealth).toBe(1)

    const round2 = finishRound(combatResult)

    const allyAAfterRound = round2.players[p2Id]!.board.find((u) => u.id === 'ally-a')!

    expect(allyAAfterRound.attack).toBe(2)
    expect(allyAAfterRound.health).toBe(2)
    expect(allyAAfterRound.tempAttack).toBe(0)
  })

  test('Brotherhood in combat grants Barrier to all own units on board and in slots', () => {
    const allyA = createUnit({ id: 'ally-a' })

    const state = createGame(
      [p1Cards(), p2Cards(rustyCard, allyA, brotherhood, { ...createUnit({ id: 'bench-ally' }) })],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterRusty = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'rusty')!.instanceId,
    }).state

    const p1Pass1 = applyAction(afterRusty, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const afterAlly = applyAction(p1Pass1, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: p1Pass1.players[p2Id]!.hand.find((c) => c.id === 'ally-a')!.instanceId,
    }).state

    const p1Pass2 = applyAction(afterAlly, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const rustyOnBoard = p1Pass2.players[p2Id]!.board.find((u) => u.id === 'rusty')!
    const allyOnBoard = p1Pass2.players[p2Id]!.board.find((u) => u.id === 'ally-a')!

    const attackState = applyAction(p1Pass2, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [rustyOnBoard.instanceId, allyOnBoard.instanceId],
      spells: [{ cardInstanceId: p1Pass2.players[p2Id]!.hand.find((c) => c.id === 'brotherhood')!.instanceId }],
    }).state

    const castResult = { state: attackState, events: [] }

    expect(castResult.state.spellStack).toHaveLength(1)

    const declinePassOutcome = applyAction(castResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    })
    const declinePass = declinePassOutcome.state

    const resolved = declinePassOutcome.state

    expect(resolved.combat).toBeNull()
    expect(resolved.players[p2Id]!.board.find((unit) => unit.instanceId === rustyOnBoard.instanceId)!.keywords).toContain(KEYWORD.BARRIER)
    expect(resolved.players[p2Id]!.board.find((unit) => unit.instanceId === allyOnBoard.instanceId)!.keywords).toContain(KEYWORD.BARRIER)

    expect(resolved.players[p1Id]!.board.every((u) => !u.keywords?.includes(KEYWORD.BARRIER))).toBe(
      true,
    )
  })

  test('Brotherhood Barrier expires at round end', () => {
    const state = createGame(
      [p1Cards(), p2Cards(rustyCard, brotherhood, { ...createUnit({ id: 'bench-ally' }) })],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterRusty = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'rusty')!.instanceId,
    }).state

    const backToP2 = applyAction(afterRusty, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const castResult = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: backToP2.players[p2Id]!.hand.find((c) => c.id === SPELL_TYPES.BROTHERHOOD)!
        .instanceId,
    })

    const declinePassOutcome = applyAction(castResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    })
    const declinePass = declinePassOutcome.state

    const resolved = declinePassOutcome.state

    expect(resolved.players[p2Id]!.board.find((u) => u.id === 'rusty')!.keywords).toContain(
      KEYWORD.BARRIER,
    )

    const round2 = finishRound(resolved)

    const rustyAfterRound = round2.players[p2Id]!.board.find((u) => u.id === 'rusty')!

    expect(rustyAfterRound.keywords ?? []).not.toContain(KEYWORD.BARRIER)
  })
})
