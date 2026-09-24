import { MAX_UNITS_ON_BOARD_PER_PLAYER } from '../../constants/game'
import type { GameEvent, GameState, PlayUnitAction } from '../../types'
import { getNextPlayerId } from '../../utils/getNextPlayerId'
import type { ApplyActionResult } from '../apply-action'

export const playUnitAction = (state: GameState, action: PlayUnitAction): ApplyActionResult => {
  const nextState: GameState = structuredClone(state)

  if (nextState.winnerPlayerId !== null) {
    throw new Error(`Game has already ended. Winner: ${nextState.winnerPlayerId}`)
  }

  if (nextState.turnPlayerId !== action.playerId) {
    throw new Error(`It is not player "${action.playerId}" turn to act`)
  }

  if (nextState.combat !== null) {
    throw new Error('Cannot play unit: combat is currently in progress')
  }

  const playerState = nextState.players[action.playerId]

  if (!playerState) {
    throw new Error(`Player with ID "${action.playerId}" not found`)
  }

  const card = playerState.hand.find((card) => card.instanceId === action.cardInstanceId)

  if (!card) {
    throw new Error(`Card with instance ID "${action.cardInstanceId}" not found in player hand`)
  }

  if (card.type !== 'unit') {
    throw new Error(`Card with instance ID "${action.cardInstanceId}" is not a unit card`)
  }

  if (playerState.energy < card.cost) {
    throw new Error(
      `Not enough energy to play unit (required: ${card.cost}, available: ${playerState.energy})`,
    )
  }

  if (playerState.board.length >= MAX_UNITS_ON_BOARD_PER_PLAYER) {
    throw new Error(
      `Cannot play unit: board has reached maximum capacity (${MAX_UNITS_ON_BOARD_PER_PLAYER})`,
    )
  }

  const events: GameEvent[] = []

  playerState.energy -= card.cost

  events.push({
    type: 'ENERGY_CHANGED',
    energy: playerState.energy,
    playerId: action.playerId,
  })

  playerState.hand = playerState.hand.filter((card) => card.instanceId !== action.cardInstanceId)
  playerState.board.push(card)

  events.push({
    type: 'UNIT_SPAWNED',
    playerId: action.playerId,
    unit: card,
  })

  nextState.turnPlayerId = getNextPlayerId(nextState)
  nextState.consecutivePasses = 0

  return {
    state: nextState,
    events,
  }
}
