import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'
import { SPELL_TYPES } from '../../types/spells.types'

export const elenaCard: UnitCard = {
  id: CHARACTERS.ELENA,
  faction: CARD_FACTION.HOT,
  type: CARD_TYPE.UNIT,
  baseCost: 3,
  cost: 3,
  baseAttack: 2,
  attack: 2,
  baseHealth: 3,
  health: 3,
  maxHealth: 3,
  relatedCards: [SPELL_TYPES.WATER_GUN],
  abilities: [ABILITY.ELENA_SUMMON, ABILITY.ELENA_SUPPORT],
}
