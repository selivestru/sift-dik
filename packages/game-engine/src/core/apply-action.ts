import { type GameAction, type GameEvent, type GameState } from '../types'
import { declareAttacksAction } from './actions/declare-attacks-action'
import { declareBlocksAction } from './actions/declare-blocks-action'
import { passAction } from './actions/pass-action'
import { playUnitAction } from './actions/play-unit-action'

export interface ApplyActionResult {
  state: GameState
  events: GameEvent[]
}

export const applyAction = (state: GameState, action: GameAction): ApplyActionResult => {
  switch (action.type) {
    case 'PLAY_UNIT':
      return playUnitAction(state, action)
    case 'DECLARE_ATTACKS':
      return declareAttacksAction(state, action)
    case 'DECLARE_BLOCKS':
      return declareBlocksAction(state, action)
    case 'PASS':
      return passAction(state, action)
  }
}
