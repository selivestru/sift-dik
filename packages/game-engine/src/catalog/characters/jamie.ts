import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, KEYWORD, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'

export const jamieCard: UnitCard = {
  id: CHARACTERS.JAMIE,
  faction: CARD_FACTION.DIK,
  type: CARD_TYPE.UNIT,
  baseCost: 1,
  cost: 1,
  baseAttack: 1,
  attack: 1,
  baseHealth: 2,
  health: 2,
  maxHealth: 2,
  keywords: [KEYWORD.IMPULSE],
  abilities: [ABILITY.JAMIE_BLOOM],
}
