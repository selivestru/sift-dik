import { CHARACTERS } from '../../constants/characters'
import { CARD_FACTION, CARD_TYPE, KEYWORD, type UnitCard } from '../../types'

export const guestsCard: UnitCard = {
  id: CHARACTERS.GUESTS,
  faction: CARD_FACTION.DIK,
  type: CARD_TYPE.UNIT,
  baseCost: 2,
  cost: 2,
  baseAttack: 4,
  attack: 4,
  baseHealth: 3,
  health: 3,
  maxHealth: 3,
  keywords: [KEYWORD.EPHEMERAL],
  relatedCards: [],
}
