import type { GameEvent, GameState } from '../../types'
import { SPELL_REGISTRY } from './registry'

export const resolveSpellStack = (state: GameState, events: GameEvent[]): void => {
  while (state.spellStack.length > 0) {
    const spellItem = state.spellStack.pop()!
    const handler = SPELL_REGISTRY[spellItem.spell.id]

    if (handler) {
      handler(state, events, { spellItem })
    }

    const owner = state.players[spellItem.spell.ownerId]!
    owner.graveyard.push(spellItem.spell)
  }
}
