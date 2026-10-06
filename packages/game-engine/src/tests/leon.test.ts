import { describe, expect, test } from 'vitest'

import { leonCard } from '../catalog/characters/leon'
import { swiperCard } from '../catalog/spells/swiper'
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
  relatedCards: [],
  ...overrides,
})

const p1Cards = (...cards: UnitCard[]): { id: string; cards: UnitCard[] } => ({
  id: 'p1',
  cards: [...cards, createUnit(), createUnit(), createUnit(), createUnit(), createUnit()],
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
  const pool: CardInstance[] = [...player.hand, ...player.deck]

  const take = (id: string): CardInstance => {
    const index = pool.findIndex((c) => c.id === id)

    return pool.splice(index, 1)[0]!
  }

  player.hand = handIds.map(take)
  player.deck = deckIds.map(take)
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

const setupBoard = (
  enemies: UnitCard[],
  option?: string,
): { playResult: ReturnType<typeof applyAction>; state: GameState; p1Id: string; p2Id: string } => {
  const state = createGame(
    [p1Cards(...enemies), p2Cards(leonCard, swiperCard, createUnit(), createUnit(), createUnit())],
    { seed: 42 },
  )

  const p2Id = state.turnPlayerId
  const p1Id = getNextPlayerId(state)

  state.players[p2Id]!.energy = 10
  state.players[p1Id]!.energy = 10
  arrangeZones(
    state,
    p2Id,
    ['leon', 'unit-template'],
    ['unit-template', 'unit-template', 'unit-template'],
  )
  arrangeZones(
    state,
    p1Id,
    enemies.map((e) => e.id),
    ['unit-template', 'unit-template', 'unit-template'],
  )

  const afterDummy = applyAction(state, {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: p2Id,
    cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'unit-template')!.instanceId,
  }).state

  const afterEnemies = applyAction(afterDummy, {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: p1Id,
    cardInstanceId: afterDummy.players[p1Id]!.hand.find((c) => c.id === enemies[0]!.id)!.instanceId,
  }).state

  let currentState = afterEnemies

  if (enemies.length > 1) {
    const p2Pass = applyAction(afterEnemies, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p2Id,
    }).state

    currentState = applyAction(p2Pass, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p1Id,
      cardInstanceId: p2Pass.players[p1Id]!.hand.find((c) => c.id === enemies[1]!.id)!.instanceId,
    }).state
  }

  const leonInHand = currentState.players[p2Id]!.hand.find((c) => c.id === 'leon')!

  const playResult = applyAction(currentState, {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: p2Id,
    cardInstanceId: leonInHand.instanceId,
    ...(option
      ? {
          abilityContexts: {
            leon_swipe: { option: option as 'mutual_match' | 'swipe_left' | 'super_like' },
          },
        }
      : {}),
  })

  return { playResult, state: playResult.state, p1Id, p2Id }
}

describe('Character: Leon', () => {
  test('summon plays Swiper and the chosen option resolves; Swiper goes to graveyard', () => {
    const { playResult, p1Id } = setupBoard(
      [createUnit({ id: 'enemy-a', baseHealth: 3, health: 3, maxHealth: 3 })],
      'super_like',
    )

    const enemyAfter = playResult.state.players[p1Id]!.board.find((u) => u.id === 'enemy-a')!

    expect(enemyAfter.health).toBe(1)
    expect(enemyAfter.keywords).toContain(KEYWORD.STUNNED)
    expect(
      playResult.state.players.p2!.graveyard.find((c) => c.id === SPELL_TYPES.SWIPER),
    ).toBeDefined()
  })

  test('summon without a chosen option is rejected', () => {
    const state = createGame([p1Cards(), p2Cards(leonCard, swiperCard)], { seed: 42 })

    const p2Id = state.turnPlayerId

    state.players[p2Id]!.energy = 10
    arrangeZones(
      state,
      p2Id,
      ['leon'],
      ['unit-template', 'unit-template', 'unit-template', 'unit-template'],
    )

    expect(() => {
      applyAction(state, {
        type: GAME_ACTION_TYPE.PLAY_UNIT,
        playerId: p2Id,
        cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'leon')!.instanceId,
      })
    }).toThrow('Invalid payload for ability "leon_swipe"')
  })

  test('Mutual Match draws a card and restores 1 Reserved Energy', () => {
    const { playResult, p2Id } = setupBoard([createUnit({ id: 'enemy-a' })], 'mutual_match')

    expect(playResult.state.players[p2Id]!.hand.length).toBe(1)
    expect(playResult.state.players[p2Id]!.deck.length).toBe(2)
    expect(playResult.state.players[p2Id]!.reservedEnergy).toBe(1)
  })

  test('Swipe Left deals 1 damage to all enemy units and 1 to enemy Reputation', () => {
    const toughUnit = createUnit({
      id: 'tough-enemy',
      baseHealth: 5,
      health: 5,
      maxHealth: 5,
      keywords: [KEYWORD.TOUGH],
    })
    const { playResult, p1Id } = setupBoard(
      [createUnit({ id: 'enemy-a' }), toughUnit],
      'swipe_left',
    )

    expect(playResult.state.players[p1Id]!.board.find((u) => u.id === 'enemy-a')!.health).toBe(1)
    expect(playResult.state.players[p1Id]!.board.find((u) => u.id === 'tough-enemy')!.health).toBe(
      5,
    )
    expect(playResult.state.players[p1Id]!.reputation).toBe(19)
  })

  test('Super Like hits the strongest enemy and stuns it until round end', () => {
    const strong = createUnit({
      id: 'strong-enemy',
      attack: 3,
      baseAttack: 3,
      baseHealth: 5,
      health: 5,
      maxHealth: 5,
    })
    const weak = createUnit({ id: 'weak-enemy', attack: 1, baseAttack: 1 })
    const { playResult, p1Id } = setupBoard([weak, strong], 'super_like')

    const strongAfter = playResult.state.players[p1Id]!.board.find((u) => u.id === 'strong-enemy')!
    const weakAfter = playResult.state.players[p1Id]!.board.find((u) => u.id === 'weak-enemy')!

    expect(strongAfter.health).toBe(3)
    expect(strongAfter.keywords).toContain(KEYWORD.STUNNED)
    expect(weakAfter.health).toBe(2)

    const round2 = finishRound(playResult.state)

    expect(
      round2.players[p1Id]!.board.find((u) => u.id === 'strong-enemy')!.keywords ?? [],
    ).not.toContain(KEYWORD.STUNNED)
  })

  test('Swiper cast from hand with a payload works', () => {
    const state = createGame(
      [p1Cards(), p2Cards(leonCard, swiperCard, createUnit(), createUnit(), createUnit())],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    arrangeZones(
      state,
      p2Id,
      ['leon', 'swiper'],
      ['unit-template', 'unit-template', 'unit-template'],
    )

    const afterLeon = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'leon')!.instanceId,
      abilityContexts: { leon_swipe: { option: 'mutual_match' } },
    }).state

    const backToP2 = applyAction(afterLeon, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const deckSizeBefore = backToP2.players[p2Id]!.deck.length

    const castResult = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.PLAY_SPELL,
      playerId: p2Id,
      cardInstanceId: backToP2.players[p2Id]!.hand.find((c) => c.id === SPELL_TYPES.SWIPER)!
        .instanceId,
      payload: { option: 'swipe_left' },
    })

    expect(castResult.state.spellStack).toHaveLength(0)
    expect(castResult.state.players[p1Id]!.reputation).toBe(19)
    expect(castResult.state.players[p2Id]!.deck.length).toBe(deckSizeBefore)
    expect(
      castResult.state.players[p2Id]!.graveyard.filter((c) => c.id === SPELL_TYPES.SWIPER),
    ).toHaveLength(2)
  })

  test('Swiper from hand without a payload is rejected at resolution', () => {
    const state = createGame(
      [p1Cards(), p2Cards(leonCard, swiperCard, createUnit(), createUnit(), createUnit())],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10
    arrangeZones(
      state,
      p2Id,
      ['leon', 'swiper'],
      ['unit-template', 'unit-template', 'unit-template'],
    )

    const afterLeon = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'leon')!.instanceId,
      abilityContexts: { leon_swipe: { option: 'super_like' } },
    }).state

    const backToP2 = applyAction(afterLeon, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    expect(() => {
      applyAction(backToP2, {
        type: GAME_ACTION_TYPE.PLAY_SPELL,
        playerId: p2Id,
        cardInstanceId: backToP2.players[p2Id]!.hand.find((c) => c.id === SPELL_TYPES.SWIPER)!
          .instanceId,
      })
    }).toThrow()
  })

  test('striking the Reputation restores 1 Reserved Energy', () => {
    const state = createGame(
      [p1Cards(), p2Cards(leonCard, createUnit(), createUnit(), createUnit(), createUnit())],
      { seed: 42 },
    )

    const p2Id = state.turnPlayerId
    const p1Id = getNextPlayerId(state)

    state.players[p2Id]!.energy = 10

    const afterLeon = applyAction(state, {
      type: GAME_ACTION_TYPE.PLAY_UNIT,
      playerId: p2Id,
      cardInstanceId: state.players[p2Id]!.hand.find((c) => c.id === 'leon')!.instanceId,
      abilityContexts: { leon_swipe: { option: 'mutual_match' } },
    }).state

    const backToP2 = applyAction(afterLeon, {
      type: GAME_ACTION_TYPE.PASS,
      playerId: p1Id,
    }).state

    const leonOnBoard = backToP2.players[p2Id]!.board.find((u) => u.id === 'leon')!

    const attackState = applyAction(backToP2, {
      type: GAME_ACTION_TYPE.DECLARE_ATTACKS,
      playerId: p2Id,
      attackers: [leonOnBoard.instanceId],
    }).state

    const blockStateOutcome = applyAction(attackState, {
      type: GAME_ACTION_TYPE.DECLARE_BLOCKS,
      playerId: p1Id,
      blocks: [],
    })
    const blockState = blockStateOutcome.state

    const strikePass = blockStateOutcome.state

    const combatResult = blockStateOutcome

    expect(combatResult.state.players[p1Id]!.reputation).toBe(18)
    expect(combatResult.state.players[p2Id]!.reservedEnergy).toBe(2)
    expect(combatResult.events).toContainEqual(
      expect.objectContaining({ type: 'ENERGY_CHANGED', playerId: p2Id, isReserved: true }),
    )
  })
})
