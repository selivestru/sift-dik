import { CHARACTERS } from '../../../constants/characters'
import { MAX_CARDS_IN_HAND } from '../../../constants/game'
import type { GameEvent, GameState } from '../../../types'
import type { AbilityContext } from '../../../types/abilities.types'

export const handleDerekSearch = (
  state: GameState,
  _events: GameEvent[],
  context: AbilityContext,
): void => {
  const player = state.players[context.sourceUnit.ownerId]!

  const mayaCard = player.deck.find((card) => card.id === CHARACTERS.MAYA)

  if (!mayaCard) return

  player.deck = player.deck.filter((card) => card.instanceId !== mayaCard.instanceId)

  if (player.hand.length < MAX_CARDS_IN_HAND) {
    player.hand.push(mayaCard)
  } else {
    player.graveyard.push(mayaCard)
  }
}
