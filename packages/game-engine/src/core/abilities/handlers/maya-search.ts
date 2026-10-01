import { CHARACTERS } from '../../../constants/characters'
import { MAX_CARDS_IN_HAND } from '../../../constants/game'
import type { GameEvent, GameState } from '../../../types'
import type { AbilityContext } from '../../../types/abilities.types'

export const handleMayaSearch = (
  state: GameState,
  _events: GameEvent[],
  context: AbilityContext,
): void => {
  const player = state.players[context.sourceUnit.ownerId]!

  const derekCard = player.deck.find((card) => card.id === CHARACTERS.DEREK)

  if (!derekCard) return

  player.deck = player.deck.filter((card) => card.instanceId !== derekCard.instanceId)

  if (player.hand.length < MAX_CARDS_IN_HAND) {
    player.hand.push(derekCard)
  } else {
    player.graveyard.push(derekCard)
  }
}
