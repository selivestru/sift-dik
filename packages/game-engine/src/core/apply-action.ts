import { gameActionSchema } from '~/schemas/action.schema'
import { GAME_ACTION_TYPE, type GameAction } from '~/types/action.types'
import type { GameEvent } from '~/types/event.types'
import type { GameState } from '~/types/game-state.types'

import { declareAttacksAction } from './actions/declare-attacks-action'
import { declareBlocksAction } from './actions/declare-blocks-action'
import { mulliganChangeCardsAction } from './actions/mulligan-change-cards-action'
import { passAction } from './actions/pass-action'
import { playUnitAction } from './actions/play-unit-action'

export interface ApplyActionResult {
  state: GameState
  events: GameEvent[]
}

export const applyAction = (state: GameState, action: GameAction): ApplyActionResult => {
  const result = gameActionSchema.safeParse(action)

  if (!result.success) {
    throw new Error(result.error.message)
  }

  const nextState = structuredClone(state)

  switch (result.data.type) {
    case GAME_ACTION_TYPE.MULLIGAN_CHANGE_CARDS:
      return mulliganChangeCardsAction(nextState, result.data)
    case GAME_ACTION_TYPE.PLAY_UNIT:
      return playUnitAction(nextState, result.data)
    case GAME_ACTION_TYPE.DECLARE_ATTACKS:
      return declareAttacksAction(nextState, result.data)
    case GAME_ACTION_TYPE.DECLARE_BLOCKS:
      return declareBlocksAction(nextState, result.data)
    case GAME_ACTION_TYPE.PASS:
      return passAction(nextState, result.data)
  }
}
