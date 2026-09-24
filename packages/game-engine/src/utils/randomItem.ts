import type { RandomFn } from '../types'

export const randomItem = <T>(items: T[], rng: RandomFn = Math.random): T => {
  return items[Math.floor(rng() * items.length)]!
}
