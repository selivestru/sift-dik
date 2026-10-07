import { MAX_UNITS_ON_BOARD } from '~/constants/game'
import type { PlayUnitAction } from '~/types/action.types'
import { GAME_EVENT_TYPE, type GameEvent } from '~/types/event.types'
import { PHASE, type GameState } from '~/types/game-state.types'
import { getPlayer } from '~/utils/get-player'
import { getSecondPlayer } from '~/utils/get-second-player'

import type { ApplyActionResult } from '../apply-action'

export function playUnitAction(state: GameState, action: PlayUnitAction): ApplyActionResult {
  if (state.phase !== PHASE.PLAYING) {
    throw new Error('Cannot play cards in this phase')
  }

  if (state.combat) {
    throw new Error('Cannot play units during combat')
  }

  const player = getPlayer(state.players, action.playerId)

  if (state.turnPlayerId !== player.id) {
    throw new Error("Not player's turn")
  }

  const card = player.hand.find((card) => card.instanceId === action.cardInstanceId)

  if (!card) {
    throw new Error('Card not in hand')
  }

  if (card.cost > player.energy) {
    throw new Error('Not enough energy to play card')
  }

  if (player.board.length >= MAX_UNITS_ON_BOARD && !action.replaceInstanceId) {
    throw new Error('Cannot play more cards')
  }

  let replacementIndex = -1

  if (action.replaceInstanceId !== undefined) {
    if (player.board.length < MAX_UNITS_ON_BOARD) {
      throw new Error('Cannot replace a unit unless board is full')
    }

    replacementIndex = player.board.findIndex(
      (unit) => unit.instanceId === action.replaceInstanceId,
    )

    if (replacementIndex === -1) {
      throw new Error('Unit to replace not on player board')
    }
  }

  const events: GameEvent[] = []

  player.energy -= card.cost

  events.push({
    type: GAME_EVENT_TYPE.ENERGY_CHANGED,
    playerId: player.id,
    energy: player.energy,
  })

  if (replacementIndex !== -1) {
    const replacedUnit = player.board.splice(replacementIndex, 1)[0]!

    events.push({
      type: GAME_EVENT_TYPE.UNIT_OBLITERATED,
      playerId: player.id,
      cardInstanceId: replacedUnit.instanceId,
    })
  }

  player.hand = player.hand.filter((unit) => unit.instanceId !== card.instanceId)
  player.board.push(card)

  events.push({
    type: GAME_EVENT_TYPE.UNIT_PLAYED,
    playerId: player.id,
    cardInstanceId: card.instanceId,
  })

  state.turnPlayerId = getSecondPlayer(state.players, player.id).id
  state.consecutivePasses = 0

  return {
    state,
    events,
  }
}
