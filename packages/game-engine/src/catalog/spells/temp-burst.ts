import { CARD_FACTION, CARD_TYPE, SPELL_SPEED, type SpellCard } from '../../types'
import { SPELL_TYPES } from '../../types/spells.types'

export const tempBurst: SpellCard = {
  id: SPELL_TYPES.TEMP_BURST,
  faction: CARD_FACTION.DIK,
  baseCost: 1,
  cost: 1,
  type: CARD_TYPE.SPELL,
  speed: SPELL_SPEED.BURST,
}
