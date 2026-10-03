import { CARD_FACTION, CARD_TYPE, SPELL_SPEED, type SpellCard } from '../../types'
import { SPELL_TYPES } from '../../types/spells.types'

export const brotherhood: SpellCard = {
  id: SPELL_TYPES.BROTHERHOOD,
  faction: CARD_FACTION.DIK,
  baseCost: 4,
  cost: 4,
  type: CARD_TYPE.SPELL,
  speed: SPELL_SPEED.FAST,
}
