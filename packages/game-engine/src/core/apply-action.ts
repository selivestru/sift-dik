import { GAME_ACTION_TYPE, type GameAction, type GameEvent, type GameState } from '../types'
import { declareAttacksAction } from './actions/declare-attacks-action'
import { declareBlocksAction } from './actions/declare-blocks-action'
import { passAction } from './actions/pass-action'
import { playSpellAction, playSpellsAction } from './actions/play-spell-action'
import { playUnitAction } from './actions/play-unit-action'
import { mulliganAction } from './actions/mulligan-action'

export interface ApplyActionResult {
  state: GameState
  events: GameEvent[]
}

export const applyAction = (state: GameState, action: GameAction): ApplyActionResult => {
  if (state.winnerPlayerId !== null) {
    throw new Error(`Game has already ended. Winner: ${state.winnerPlayerId}`)
  }
  if (!Object.hasOwn(state.players, action.playerId)) {
    throw new Error(`Player with ID "${action.playerId}" not found`)
  }
  if (state.phase === 'finished') throw new Error('Game has already ended')
  if (state.phase === 'mulligan' && action.type !== GAME_ACTION_TYPE.MULLIGAN) {
    throw new Error('Both players must finish the mulligan before playing')
  }
  const nextState = structuredClone(state)
  const result = dispatchAction(nextState, action)
  if (result.state.winnerPlayerId !== null || result.state.isDraw) result.state.phase = 'finished'
  return result
}

const dispatchAction = (nextState: GameState, action: GameAction): ApplyActionResult => {
  switch (action.type) {
    case GAME_ACTION_TYPE.MULLIGAN:
      return mulliganAction(nextState, action)
    case GAME_ACTION_TYPE.PLAY_UNIT:
      return playUnitAction(nextState, action)
    case GAME_ACTION_TYPE.DECLARE_ATTACKS:
      return declareAttacksAction(nextState, action)
    case GAME_ACTION_TYPE.DECLARE_BLOCKS:
      return declareBlocksAction(nextState, action)
    case GAME_ACTION_TYPE.PASS:
      return passAction(nextState, action)
    case GAME_ACTION_TYPE.PLAY_SPELL:
      return playSpellAction(nextState, action)
    case GAME_ACTION_TYPE.PLAY_SPELLS:
      return playSpellsAction(nextState, action)
    default:
      throw new Error('Unknown game action')
  }
}
