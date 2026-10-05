import { CARD_FACTION, CARD_TYPE, SPELL_SPEED, type SpellCard } from '../../types'
import { SPELL_TYPES } from '../../types/spells.types'

export const waterGun: SpellCard = {
  id: SPELL_TYPES.WATER_GUN,
  faction: CARD_FACTION.HOT,
  type: CARD_TYPE.SPELL,
  baseCost: 1,
  cost: 1,
  speed: SPELL_SPEED.BURST,
}
