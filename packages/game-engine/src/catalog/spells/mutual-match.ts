import { CARD_FACTION, CARD_TYPE, SPELL_SPEED, type SpellCard } from '../../types'
import { SPELL_TYPES } from '../../types/spells.types'

export const mutualMatch: SpellCard = {
  id: SPELL_TYPES.MUTUAL_MATCH,
  faction: CARD_FACTION.DIK,
  baseCost: 0,
  cost: 0,
  type: CARD_TYPE.SPELL,
  speed: SPELL_SPEED.BURST,
}
