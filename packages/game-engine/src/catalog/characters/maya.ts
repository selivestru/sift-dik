import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'
import { SPELL_TYPES } from '../../types/spells.types'

export const mayaCard: UnitCard = {
  id: CHARACTERS.MAYA,
  faction: CARD_FACTION.HOT,
  type: CARD_TYPE.UNIT,
  baseCost: 2,
  cost: 2,
  baseAttack: 1,
  attack: 1,
  baseHealth: 3,
  health: 3,
  maxHealth: 3,
  relatedCards: [SPELL_TYPES.ALWAYS_AND_FOREVER],
  abilities: [ABILITY.MAYA_SEARCH, ABILITY.MAYA_SUPPORT, ABILITY.MAYA_VENGEANCE],
}
