import { CARD_FACTION } from '../../../types'
import type { GameEvent, GameState } from '../../../types'
import type { AbilityContext } from '../../../types/abilities.types'
import { grantCostReduction } from '../../utils/card-cost'

const RECRUITMENT_DISCOUNT = 1

export const handleRustyRecruitment = (
  state: GameState,
  _events: GameEvent[],
  context: AbilityContext,
): void => {
  const player = state.players[context.sourceUnit.ownerId]!

  for (const card of [...player.hand, ...player.deck]) {
    if (card.faction !== CARD_FACTION.DIK) continue

    grantCostReduction(card, RECRUITMENT_DISCOUNT)
  }
}
