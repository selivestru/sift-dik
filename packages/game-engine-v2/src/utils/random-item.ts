import type { RandomFn } from './random-fn'

export function randomItem<T>(items: T[], rng: RandomFn = Math.random): T {
  return items[Math.floor(rng() * items.length)]!
}
