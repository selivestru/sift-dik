import type { PassAction } from '~/types/action.types'
import type { GameEvent } from '~/types/event.types'
import type { GameState } from '~/types/game-state.types'

import type { ApplyActionResult } from '../apply-action'

export function passAction(state: GameState, action: PassAction): ApplyActionResult {
  const events: GameEvent[] = []

  return {
    state,
    events,
  }
}
