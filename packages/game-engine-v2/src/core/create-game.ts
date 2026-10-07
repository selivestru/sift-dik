import { MAX_REPUTATION } from '../constants/game'
import { compiledCheckPlayers } from '../schemas/create-game.schema'
import type { CardDefinition, CardInstance } from '../types/card.types'
import { PHASE, type GameState, type PlayerState } from '../types/game-state.types'
import { createRng } from '../utils/create-rng'
import { randomItem } from '../utils/random-item'
import { shuffle } from '../utils/shuffle'

interface CreateGamePlayer {
  id: string
  cards: CardDefinition[]
}

interface CreateGameOptions {
  seed?: number
}

export function createGame(
  players: [CreateGamePlayer, CreateGamePlayer],
  options?: CreateGameOptions,
) {
  const checkResult = compiledCheckPlayers.safeParse(players)

  if (!checkResult.success) {
    throw new Error(checkResult.error.message)
  }

  const validPlayers = checkResult.data

  const random = {
    rngState: (options?.seed ?? Math.floor(Math.random() * 0x100000000)) >>> 0,
  }
  const rng = createRng(random)

  const initiativePlayer = randomItem(validPlayers, rng)

  const playerStates: [string, PlayerState][] = []

  for (const player of validPlayers) {
    const cardInstances: CardInstance[] = player.cards.map((card, index) => ({
      ...card,
      instanceId: `${player.id}-card-${index + 1}`,
      ownerId: player.id,
    }))

    const deckCards = shuffle(cardInstances, rng)
    const handCards = deckCards.splice(0, 4)

    playerStates.push([
      player.id,
      {
        id: player.id,
        reputation: MAX_REPUTATION,
        maxEnergy: 0,
        energy: 0,
        reservedEnergy: 0,
        mulliganCompleted: false,
        hasAttackToken: initiativePlayer.id === player.id,
        deck: deckCards,
        hand: handCards,
        board: [],
        graveyard: [],
      },
    ])
  }

  const gameState: GameState = {
    phase: PHASE.MULLIGAN,
    rngState: random.rngState,
    round: 0,
    players: Object.fromEntries(playerStates),
    initiativePlayerId: initiativePlayer.id,
    turnPlayerId: initiativePlayer.id,
    combat: null,
    winnerPlayerId: null,
    consecutivePasses: 0,
  }

  return gameState
}
