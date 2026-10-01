import { CARD_FACTION, CARD_TYPE, SPELL_SPEED, type SpellCard } from '../../types'
import { SPELL_TYPES } from '../../types/spells.types'

export const alwaysAndForever: SpellCard = {
  id: SPELL_TYPES.ALWAYS_AND_FOREVER,
  faction: CARD_FACTION.HOT,
  baseCost: 2,
  cost: 2,
  type: CARD_TYPE.SPELL,
  speed: SPELL_SPEED.BURST,
}
