import { CARD_FACTION, type GameEvent, type GameState } from '../../../types'
import type { AbilityContext } from '../../../types/abilities.types'
import { drawCard } from '../../utils/draw-card'

export const handleJosyDraw = (
  state: GameState,
  events: GameEvent[],
  context: AbilityContext,
): void => {
  const player = state.players[context.sourceUnit.ownerId]!

  const drawnCard = drawCard(state, player.id, events)

  if (!drawnCard) return

  const isAlliedFaction =
    drawnCard.faction === CARD_FACTION.HOT || drawnCard.faction === CARD_FACTION.DIK

  if (!isAlliedFaction) return

  drawnCard.cost -= 1
  drawnCard.tempCost = (drawnCard.tempCost ?? 0) + 1
}
