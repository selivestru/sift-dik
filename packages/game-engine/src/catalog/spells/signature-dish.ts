import { CARD_FACTION, CARD_TYPE, SPELL_SPEED, type SpellCard } from '../../types'
import { SPELL_TYPES } from '../../types/spells.types'

export const signatureDish: SpellCard = {
  id: SPELL_TYPES.SIGNATURE_DISH,
  faction: CARD_FACTION.DIK,
  type: CARD_TYPE.SPELL,
  baseCost: 3,
  cost: 3,
  speed: SPELL_SPEED.FAST,
}
