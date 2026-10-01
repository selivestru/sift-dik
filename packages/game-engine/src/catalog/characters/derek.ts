import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'

export const derekCard: UnitCard = {
  id: CHARACTERS.DEREK,
  faction: CARD_FACTION.DIK,
  type: CARD_TYPE.UNIT,
  baseCost: 2,
  cost: 2,
  baseAttack: 2,
  attack: 2,
  baseHealth: 3,
  health: 3,
  maxHealth: 3,
  abilities: [ABILITY.DEREK_SEARCH, ABILITY.DEREK_BROTHERHOOD, ABILITY.DEREK_REVENGE],
}
