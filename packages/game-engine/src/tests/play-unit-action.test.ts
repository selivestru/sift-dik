import { describe, expect, it } from 'vite-plus/test'

import { applyAction } from '../core/apply-action'
import { createGame } from '../core/create-game'
import { GAME_ACTION_TYPE, type PlayUnitAction } from '../types/action.types'
import { CARD_FACTION, CARD_TYPE, type CardDefinition } from '../types/card.types'
import { GAME_EVENT_TYPE } from '../types/event.types'

function setup(boardSize = 6) {
  const cards: CardDefinition[] = Array.from({ length: 40 }, () => ({
    id: 'unit',
    type: CARD_TYPE.UNIT,
    faction: CARD_FACTION.OTHER,
    cost: 1,
    attack: 1,
    baseHealth: 2,
    health: 2,
  }))
  let state = createGame(
    [
      { id: 'a', cards },
      { id: 'b', cards },
    ],
    { seed: 123 },
  )
  for (const playerId of ['a', 'b']) {
    state = applyAction(state, {
      type: GAME_ACTION_TYPE.MULLIGAN_CHANGE_CARDS,
      playerId,
      cardInstanceIds: [],
    }).state
  }
  const player = state.players[state.turnPlayerId]
  player.board = player.deck.splice(0, boardSize)
  state.consecutivePasses = 1
  const action: PlayUnitAction = {
    type: GAME_ACTION_TYPE.PLAY_UNIT,
    playerId: player.id,
    cardInstanceId: player.hand[0].instanceId,
    replaceInstanceId: player.board[2]?.instanceId,
  }
  return { state, player, action }
}

describe('play unit with replacement', () => {
  it('obliterates the chosen unit, plays the new one and passes priority once', () => {
    const { state, player, action } = setup()
    const before = structuredClone(state)
    const result = applyAction(state, action)
    const nextPlayer = result.state.players[player.id]

    expect(nextPlayer.board.map((unit) => unit.instanceId)).toEqual([
      ...player.board
        .filter((unit) => unit.instanceId !== action.replaceInstanceId)
        .map((unit) => unit.instanceId),
      action.cardInstanceId,
    ])
    expect(nextPlayer.board).toHaveLength(6)
    expect(nextPlayer.hand).toHaveLength(4)
    expect(nextPlayer.graveyard).toEqual(player.graveyard)
    expect(nextPlayer.energy).toBe(0)
    expect(nextPlayer.hasAttackToken).toBe(player.hasAttackToken)
    expect(result.state.turnPlayerId).not.toBe(player.id)
    expect(result.state.consecutivePasses).toBe(0)
    expect(result.events).toEqual([
      { type: GAME_EVENT_TYPE.ENERGY_CHANGED, playerId: player.id, energy: 0 },
      {
        type: GAME_EVENT_TYPE.UNIT_OBLITERATED,
        playerId: player.id,
        cardInstanceId: action.replaceInstanceId,
      },
      {
        type: GAME_EVENT_TYPE.UNIT_PLAYED,
        playerId: player.id,
        cardInstanceId: action.cardInstanceId,
      },
    ])
    expect(state).toEqual(before)
  })

  it.each([
    ['missing', 'Unit to replace not on player board'],
    ['opponent', 'Unit to replace not on player board'],
    ['hand', 'Unit to replace not on player board'],
    ['deck', 'Unit to replace not on player board'],
    ['no-selection', 'Cannot play more cards'],
    ['no-energy', 'Not enough energy to play card'],
  ])('rejects %s without changing the original state', (scenario, message) => {
    const { state, player, action } = setup()
    if (scenario === 'missing') action.replaceInstanceId = 'missing'
    if (scenario === 'opponent') {
      const opponent = Object.values(state.players).find((p) => p.id !== player.id)!
      opponent.board.push(opponent.deck.shift()!)
      action.replaceInstanceId = opponent.board[0].instanceId
    }
    if (scenario === 'hand') action.replaceInstanceId = player.hand[0].instanceId
    if (scenario === 'deck') action.replaceInstanceId = player.deck[0].instanceId
    if (scenario === 'no-selection') action.replaceInstanceId = undefined
    if (scenario === 'no-energy') player.energy = 0
    const before = structuredClone(state)
    expect(() => applyAction(state, action)).toThrow(message)
    expect(state).toEqual(before)
  })

  it('rejects replacement on a non-full board and allows an ordinary play', () => {
    const { state, action } = setup(5)
    expect(() => applyAction(state, action)).toThrow('unless board is full')
    const result = applyAction(state, { ...action, replaceInstanceId: undefined })
    expect(result.state.players[action.playerId].board).toHaveLength(6)
    expect(result.events.map((event) => event.type)).toEqual([
      GAME_EVENT_TYPE.ENERGY_CHANGED,
      GAME_EVENT_TYPE.UNIT_PLAYED,
    ])
  })
})
