import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, KEYWORD, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'
import { SPELL_TYPES } from '../../types/spells.types'

export const leonCard: UnitCard = {
  id: CHARACTERS.LEON,
  faction: CARD_FACTION.DIK,
  type: CARD_TYPE.UNIT,
  baseCost: 2,
  cost: 2,
  baseAttack: 2,
  attack: 2,
  baseHealth: 2,
  health: 2,
  maxHealth: 2,
  keywords: [KEYWORD.ELUSIVE],
  relatedCards: [
    SPELL_TYPES.SWIPER,
    SPELL_TYPES.MUTUAL_MATCH,
    SPELL_TYPES.SWIPE_LEFT,
    SPELL_TYPES.SUPER_LIKE,
  ],
  abilities: [ABILITY.LEON_SWIPE, ABILITY.LEON_CHARM],
}
