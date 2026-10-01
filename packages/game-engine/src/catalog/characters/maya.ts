import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'

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
  abilities: [ABILITY.MAYA_SEARCH, ABILITY.MAYA_SUPPORT, ABILITY.MAYA_VENGEANCE],
}
