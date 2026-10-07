import { describe, expect, it } from 'vitest'

import { applyAction, createGame } from '../index'
import { GAME_ACTION_TYPE } from '../types/action.types'
import { CARD_FACTION, CARD_TYPE, type CardDefinition } from '../types/card.types'
import { PHASE } from '../types/game-state.types'

function makeCards(count = 40): CardDefinition[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `unit-${index}`,
    type: CARD_TYPE.UNIT,
    faction: CARD_FACTION.OTHER,
    cost: 1,
    attack: 1,
    baseHealth: 2,
    health: 2,
  }))
}

function createWithCards(cards: CardDefinition[]) {
  return createGame(
    [
      { id: 'a', cards },
      { id: 'b', cards: makeCards() },
    ],
    { seed: 123 },
  )
}

describe('create game input validation', () => {
  it('creates two players with exactly forty card instances each', () => {
    const game = createWithCards(makeCards())

    expect(Object.keys(game.players)).toHaveLength(2)
    for (const player of Object.values(game.players)) {
      expect([...player.hand, ...player.deck]).toHaveLength(40)
      expect(player.hand).toHaveLength(4)
      expect(player.deck).toHaveLength(36)
      expect(new Set([...player.hand, ...player.deck].map((card) => card.instanceId)).size).toBe(40)
    }
  })

  it.each([39, 41])('rejects a deck with %i cards', (cardCount) => {
    const cards = makeCards(cardCount)
    expect(() => createWithCards(cards)).toThrow('exactly 40 cards')
  })

  it('rejects input unless it contains exactly two players', () => {
    const onePlayer = [{ id: 'a', cards: makeCards() }] as unknown as [
      { id: string; cards: CardDefinition[] },
      { id: string; cards: CardDefinition[] },
    ]
    const threePlayers = [
      { id: 'a', cards: makeCards() },
      { id: 'b', cards: makeCards() },
      { id: 'c', cards: makeCards() },
    ] as unknown as typeof onePlayer

    expect(() => createGame(onePlayer, { seed: 123 })).toThrow('received undefined')
    expect(() => createGame(threePlayers, { seed: 123 })).toThrow('expected never')
  })

  it('rejects blank player and card ids', () => {
    const cards = makeCards()
    expect(() =>
      createGame(
        [
          { id: '', cards },
          { id: 'b', cards: makeCards() },
        ],
        { seed: 123 },
      ),
    ).toThrow('Ids cannot be empty')

    cards[0] = { ...cards[0]!, id: '' }
    expect(() => createWithCards(cards)).toThrow('Ids cannot be empty')
  })

  it('rejects duplicate player ids', () => {
    const cards = makeCards()
    expect(() =>
      createGame(
        [
          { id: 'same', cards },
          { id: 'same', cards: makeCards() },
        ],
        { seed: 123 },
      ),
    ).toThrow('unique ids')
  })

  it.each([
    ['negative cost', { cost: -1 }, 'Too small'],
    ['fractional attack', { attack: 1.5 }, 'Card attack must be an integer'],
    ['zero base health', { baseHealth: 0 }, 'positive'],
    ['damaged card definition', { health: 1 }, 'match base health'],
    ['unknown faction', { faction: 'unknown' }, 'Unknown card faction'],
    ['non-unit card', { type: 'spell' }, 'Card type must be a unit'],
  ])('rejects a card with %s', (_description, patch, message) => {
    const cards = makeCards()
    cards[0] = { ...cards[0]!, ...patch } as CardDefinition

    expect(() => createWithCards(cards)).toThrow(message)
  })

  it('safely supports player ids that are object prototype property names', () => {
    const cards = makeCards()
    const game = createGame(
      [
        { id: '__proto__', cards },
        { id: 'constructor', cards: makeCards() },
      ],
      { seed: 123 },
    )

    expect(Object.hasOwn(game.players, '__proto__')).toBe(true)
    expect(Object.hasOwn(game.players, 'constructor')).toBe(true)

    const first = applyAction(game, {
      type: GAME_ACTION_TYPE.MULLIGAN_CHANGE_CARDS,
      playerId: '__proto__',
      cardInstanceIds: [],
    })
    const second = applyAction(first.state, {
      type: GAME_ACTION_TYPE.MULLIGAN_CHANGE_CARDS,
      playerId: 'constructor',
      cardInstanceIds: [],
    })

    expect(second.state.phase).toBe(PHASE.PLAYING)
    expect(() =>
      applyAction(game, {
        type: GAME_ACTION_TYPE.MULLIGAN_CHANGE_CARDS,
        playerId: 'toString',
        cardInstanceIds: [],
      }),
    ).toThrow('Player not found')
  })
})
