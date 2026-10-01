import type { GameEvent, GameState, StackSpell } from '../../types'
import { SPELL_REGISTRY } from './registry'

export const resolveSpellItem = (
  state: GameState,
  events: GameEvent[],
  spellItem: StackSpell,
): void => {
  const handler = SPELL_REGISTRY[spellItem.spell.id]

  if (handler) {
    handler(state, events, { spellItem })
  }

  const owner = state.players[spellItem.spell.ownerId]!
  owner.graveyard.push(spellItem.spell)
}
