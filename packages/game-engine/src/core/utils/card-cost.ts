import type { CardInstance } from '../../types'

export const grantCostReduction = (card: CardInstance, amount: number): void => {
  const temporaryReduction = card.tempCost ?? 0
  const permanentCost = Math.max(0, card.cost + temporaryReduction - amount)
  card.tempCost = Math.min(temporaryReduction, permanentCost)
  card.cost = permanentCost - card.tempCost
}
