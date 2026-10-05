import type { GameEvent, GameState, StackSpell } from '../../types'
import { SPELL_REGISTRY } from './registry'

export const resolveSpellItem = (
  state: GameState,
  events: GameEvent[],
  spellItem: StackSpell,
): void => {
  const entry = SPELL_REGISTRY[spellItem.spell.id]

  if (entry) {
    const payload = entry.payloadSchema?.parse(spellItem.payload ?? {})
    entry.execute(state, events, { spellItem, payload })
  }

  const owner = state.players[spellItem.spell.ownerId]!
  owner.graveyard.push(spellItem.spell)
}
