import { describe, expect, test } from 'vitest'

import { josyCard } from '../catalog/characters/josy'
import { lowBlow } from '../catalog/spells/low-blow'
import { applyAction } from '../core'
import { createGame } from './scenario'
import {
  GAME_ACTION_TYPE,
  KEYWORD,
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

const p1Cards = (...cards: UnitCard[]): { id: string; cards: UnitCard[] } => ({
  id: 'p1',
  cards: [...cards, createUnit(), createUnit(), createUnit()],
})

const p2WithDeck = (...cards: UnitCard[]): { id: string; cards: UnitCard[] } => ({
  id: 'p2',
  cards: [...cards, createUnit(), createUnit(), createUnit()],
})

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

const attackUnblockedWithJosy = (state: GameState, p1Id: string, p2Id: string) => {
  const backToP2 = applyAction(state, {
    type: GAME_ACTION_TYPE.PASS,
    playerId: p1Id,
  }).state

  const josyOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === 'josy')!

  const attackState = applyAction(backToP2, {
    type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
    playerId: p2Id,
    attackers: [josyOnBoard.instanceId],
  }).state

  return applyAction(attackState, {
    type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
    playerId: p1Id,
    blocks: [],
  })
}

describe('Character: Josy', () => {
  test('striking the Reputation draws a card', () => {
    const state = createGame([p1Cards(), p2WithDeck(josyCard)], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    arrangeZones(state, p2Id, ['josy'], ['unit-template', 'unit-template', 'unit-template'])

    const handSizeBefore = state.players[p2Id]!.hand.length
    const deckSizeBefore = state.players[p2Id]!.deck.length

    const afterJosy = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'josy')!.instanceId,
    }).state

    const combatResult = attackUnblockedWithJosy(afterJosy, p1Id, p2Id)

    expect(combatResult.state.players[p1Id]!.reputation).toBe(19)
    expect(combatResult.state.players[p2Id]!.hand.length).toBe(handSizeBefore)
    expect(combatResult.state.players[p2Id]!.deck.length).toBe(deckSizeBefore - 1)
    expect(combatResult.events).toContainEqual(
      expect.objectContaining({ type: 'CARD_DRAWN', playerId: p2Id }),
    )
  })

  test('drawn HOTs or DIKs card gets its cost reduced by 1 this round', () => {
    const rewardUnit = createUnit({ id: 'reward-unit', baseCost: 2, cost: 2 })
    const state = createGame([p1Cards(), p2WithDeck(josyCard, rewardUnit)], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    arrangeZones(state, p2Id, ['josy'], ['reward-unit', 'unit-template', 'unit-template'])

    const afterJosy = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'josy')!.instanceId,
    }).state

    const combatResult = attackUnblockedWithJosy(afterJosy, p1Id, p2Id)

    const discounted = combatResult.state.players[p2Id]!.hand.find((c) => c.id === 'reward-unit')!

    expect(discounted.cost).toBe(1)
    expect(discounted.tempCost).toBe(1)
  })

  test('drawn card of another faction keeps its cost', () => {
    const rewardUnit = createUnit({ id: 'reward-unit', faction: 'aaa', baseCost: 2, cost: 2 })
    const state = createGame([p1Cards(), p2WithDeck(josyCard, rewardUnit)], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    arrangeZones(state, p2Id, ['josy'], ['reward-unit', 'unit-template', 'unit-template'])

    const afterJosy = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'josy')!.instanceId,
    }).state

    const combatResult = attackUnblockedWithJosy(afterJosy, p1Id, p2Id)

    const drawn = combatResult.state.players[p2Id]!.hand.find((c) => c.id === 'reward-unit')!

    expect(drawn.cost).toBe(2)
    expect(drawn.tempCost ?? 0).toBe(0)
  })

  test('cost reduction expires at round end', () => {
    const rewardUnit = createUnit({ id: 'reward-unit', baseCost: 2, cost: 2 })
    const state = createGame([p1Cards(), p2WithDeck(josyCard, rewardUnit)], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    arrangeZones(state, p2Id, ['josy'], ['reward-unit', 'unit-template', 'unit-template'])

    const afterJosy = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'josy')!.instanceId,
    }).state

    const combatResult = attackUnblockedWithJosy(afterJosy, p1Id, p2Id)

    const round2 = finishRound(combatResult.state)

    const restored = round2.players[p2Id]!.hand.find((c) => c.id === 'reward-unit')!

    expect(restored.cost).toBe(2)
    expect(restored.tempCost ?? 0).toBe(0)
  })

  test('drawing from an empty deck loses the game', () => {
    const state = createGame([p1Cards(), { id: 'p2', cards: [josyCard] }], { seed: 42 })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterJosy = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'josy')!.instanceId,
    }).state

    const combatResult = attackUnblockedWithJosy(afterJosy, p1Id, p2Id)

    expect(combatResult.state.winnerPlayerId).toBe(p1Id)
    expect(combatResult.events).toContainEqual(
      expect.objectContaining({ type: 'GAME_OVER', winnerPlayerId: p1Id }),
    )
  })

  const setupLowBlow = (victim: UnitCard) => {
    const state = createGame([p1Cards(victim), { id: 'p2', cards: [josyCard, lowBlow] }], {
      seed: 42,
    })

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    state.players[p1Id]!.energy = 10

    const afterJosy = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'josy')!.instanceId,
    }).state

    const afterVictim = applyAction(afterJosy, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: afterJosy.players[p1Id]!.hand.find((c) => c.id === victim.id)!.instanceId,
    }).state

    const victimOnBoard = afterVictim.players[p1Id]!.board.find((u) => u.id === victim.id)!

    return { state: afterVictim, p1Id, p2Id, victimOnBoard }
  }

  const castLowBlow = (setup: ReturnType<typeof setupLowBlow>, targetInstanceId: string) => {
    const castResult = applyAction(setup.state, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: setup.p2Id,
      cardInstanceId: setup.state.players[setup.p2Id]!.hand.find(
        (c) => c.id === SPELL_TYPES.LOW_BLOW,
      )!.instanceId,
      targets: [targetInstanceId],
    })

    return applyAction(castResult.state, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: castResult.state.turnPlayerId,
    })
  }

  test('Low Blow kills a weak enemy unit without stunning it', () => {
    const setup = setupLowBlow(createUnit({ id: 'victim' }))
    const combatResult = castLowBlow(setup, setup.victimOnBoard.instanceId)

    expect(
      combatResult.state.players[setup.p1Id]!.graveyard.find((u) => u.id === 'victim'),
    ).toBeDefined()
    expect(combatResult.events).toContainEqual(
      expect.objectContaining({
        type: 'UNIT_DIED',
        unitInstanceId: setup.victimOnBoard.instanceId,
      }),
    )
  })

  test('Low Blow wounds and stuns a surviving enemy until round end', () => {
    const setup = setupLowBlow(createUnit({ id: 'victim', baseHealth: 6, health: 6, maxHealth: 6 }))
    const combatResult = castLowBlow(setup, setup.victimOnBoard.instanceId)

    const wounded = combatResult.state.players[setup.p1Id]!.board.find((u) => u.id === 'victim')!

    expect(wounded.health).toBe(2)
    expect(wounded.keywords).toContain(KEYWORD.STUNNED)
    expect(wounded.tempKeywords).toContain(KEYWORD.STUNNED)

    const round2 = finishRound(combatResult.state)

    const recovered = round2.players[setup.p1Id]!.board.find((u) => u.id === 'victim')!

    expect(recovered.health).toBe(2)
    expect(recovered.keywords ?? []).not.toContain(KEYWORD.STUNNED)
    expect(recovered.tempKeywords).toHaveLength(0)
  })

  test('Low Blow damage is reduced by Tough', () => {
    const setup = setupLowBlow(
      createUnit({
        id: 'victim',
        baseHealth: 7,
        health: 7,
        maxHealth: 7,
        keywords: [KEYWORD.TOUGH],
      }),
    )
    const combatResult = castLowBlow(setup, setup.victimOnBoard.instanceId)

    const wounded = combatResult.state.players[setup.p1Id]!.board.find((u) => u.id === 'victim')!

    expect(wounded.health).toBe(4)
    expect(wounded.keywords).toContain(KEYWORD.STUNNED)
  })

  test('Low Blow cannot target an own unit', () => {
    const setup = setupLowBlow(createUnit({ id: 'victim' }))

    const josyOnBoard = setup.state.players[setup.p2Id]!.board.find((u) => u.id === 'josy')!

    expect(() => {
      castLowBlow(setup, josyOnBoard.instanceId)
    }).toThrow('Target must be a live enemy unit')
  })
})
