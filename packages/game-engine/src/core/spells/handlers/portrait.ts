import { MAX_CARDS_IN_HAND } from '../../../constants/game'
import { KEYWORD, type GameEvent, type GameState } from '../../../types'
import type { SpellContext } from '../../../types/spells.types'
import { createCardCopy } from '../../utils/card-copy'

export const handlePortrait = (
  state: GameState,
  _events: GameEvent[],
  { spellItem }: SpellContext,
): void => {
  const casterId = spellItem.spell.ownerId
  const targetId = spellItem.targets?.[0]

  if (!targetId) {
    throw new Error('Portrait requires a card in your hand')
  }

  const player = state.players[casterId]!
  const target = player.hand.find((card) => card.instanceId === targetId)

  if (!target) {
    throw new Error(`Portrait target card "${targetId}" is not in your hand`)
  }

  const keywords = target.keywords ?? []

  if (!keywords.includes(KEYWORD.FLEETING)) {
    keywords.push(KEYWORD.FLEETING)
  }

  const copy = createCardCopy(state, casterId, target, {
    cost: Math.max(0, target.cost - 1),
    keywords,
  })

  if (player.hand.length < MAX_CARDS_IN_HAND) {
    player.hand.push(copy)
  } else {
    player.graveyard.push(copy)
  }
}
