import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, KEYWORD, type UnitCard } from '../../types'
import { ABILITY } from '../../types/abilities.types'

export const rustyCard: UnitCard = {
  id: CHARACTERS.RUSTY,
  faction: CARD_FACTION.DIK,
  type: CARD_TYPE.UNIT,
  baseCost: 5,
  cost: 5,
  baseAttack: 3,
  attack: 3,
  baseHealth: 5,
  health: 5,
  maxHealth: 5,
  keywords: [KEYWORD.REGENERATION],
  abilities: [ABILITY.RUSTY_RECRUITMENT, ABILITY.RUSTY_RALLY],
}
