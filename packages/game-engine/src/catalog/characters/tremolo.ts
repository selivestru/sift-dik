import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'

export const tremoloCard: UnitCard = {
  id: CHARACTERS.TREMOLO,
  faction: CARD_FACTION.DIK,
  type: CARD_TYPE.UNIT,
  baseCost: 3,
  cost: 3,
  baseAttack: 3,
  attack: 3,
  baseHealth: 3,
  health: 3,
  maxHealth: 3,
  abilities: [ABILITY.TREMOLO_PATH],
}
