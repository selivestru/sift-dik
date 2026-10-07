import { describe, expect, it } from 'vitest'

import { applyAction } from '../core/apply-action'
import { createGame } from '../core/create-game'
import { GAME_ACTION_TYPE } from '../types/action.types'
import { CARD_FACTION, CARD_TYPE, type CardDefinition } from '../types/card.types'
import { GAME_EVENT_TYPE } from '../types/event.types'
import { PHASE, type GameState } from '../types/game-state.types'

function makeGame() {
  const cards: CardDefinition[] = Array.from({ length: 40 }, () => ({
    id: 'unit',
    type: CARD_TYPE.UNIT,
    faction: CARD_FACTION.OTHER,
    cost: 1,
    attack: 1,
    baseHealth: 2,
    health: 2,
  }))
  return createGame(
    [
      { id: 'a', cards },
      { id: 'b', cards },
    ],
    { seed: 123 },
  )
}

function confirm(state: GameState, playerId: string, cardInstanceIds: string[] = []) {
  return applyAction(state, {
    type: GAME_ACTION_TYPE.MULLIGAN_CHANGE_CARDS,
    playerId,
    cardInstanceIds,
  })
}

describe('mulligan completed event', () => {
  it('pairs replaced and received instances in hand order', () => {
    const game = makeGame()
    const before = structuredClone(game)
    const selected = [game.players.a.hand[2].instanceId, game.players.a.hand[0].instanceId]
    const received = game.players.a.deck.slice(0, 2).map((card) => card.instanceId)
    const result = confirm(game, 'a', selected)

    expect(result.events).toEqual([
      {
        type: GAME_EVENT_TYPE.MULLIGAN_COMPLETED,
        playerId: 'a',
        replacedCardInstanceIds: [selected[1], selected[0]],
        receivedCardInstanceIds: received,
      },
    ])
    expect(result.state.players.a.hand[0].instanceId).toBe(received[0])
    expect(result.state.players.a.hand[2].instanceId).toBe(received[1])
    expect(result.state.players.a.hand).toHaveLength(4)
    const ids = [...result.state.players.a.hand, ...result.state.players.a.deck].map(
      (card) => card.instanceId,
    )
    expect(ids).toHaveLength(40)
    expect(new Set(ids).size).toBe(40)
    expect(game).toEqual(before)
  })

  it('emits completion with empty arrays when the player keeps the hand', () => {
    const game = makeGame()
    const result = confirm(game, 'a')

    expect(result.events).toEqual([
      {
        type: GAME_EVENT_TYPE.MULLIGAN_COMPLETED,
        playerId: 'a',
        replacedCardInstanceIds: [],
        receivedCardInstanceIds: [],
      },
    ])
    expect(result.state.phase).toBe(PHASE.MULLIGAN)
    expect(result.state.players.a.hand).toEqual(game.players.a.hand)
    expect(result.state.rngState).toBe(game.rngState)
    expect(() => confirm(result.state, 'a')).toThrow('already completed')
  })

  it('emits completion before the single round-start event and opening draws', () => {
    const first = confirm(makeGame(), 'a').state
    const replacementId = first.players.b.deck[0].instanceId
    const result = confirm(first, 'b', [first.players.b.hand[0].instanceId])

    expect(result.events.map((event) => event.type)).toEqual([
      GAME_EVENT_TYPE.MULLIGAN_COMPLETED,
      GAME_EVENT_TYPE.ROUND_STARTED,
      GAME_EVENT_TYPE.ENERGY_CHANGED,
      GAME_EVENT_TYPE.CARD_DRAWN,
      GAME_EVENT_TYPE.ENERGY_CHANGED,
      GAME_EVENT_TYPE.CARD_DRAWN,
    ])
    expect(result.events[0]).toMatchObject({ receivedCardInstanceIds: [replacementId] })
    const drawEvent = result.events.find(
      (event) => event.type === GAME_EVENT_TYPE.CARD_DRAWN && event.playerId === 'b',
    )
    expect(drawEvent).toMatchObject({
      cardInstanceId: result.state.players.b.hand[4].instanceId,
    })
    expect(result.state.phase).toBe(PHASE.PLAYING)
    expect(result.state.round).toBe(1)
    for (const player of Object.values(result.state.players)) {
      expect(player.hand).toHaveLength(5)
      expect(player.energy).toBe(1)
      expect(player.reservedEnergy).toBe(0)
    }
  })
})
