import type { DescriptionSegment } from './types'

const TERM_PATTERN = /{(\w+)}/g

export const parseDescription = (description: string): DescriptionSegment[] => {
  const segments: DescriptionSegment[] = []
  let lastIndex = 0

  for (const match of description.matchAll(TERM_PATTERN)) {
    const index = match.index!

    if (index > lastIndex) {
      segments.push({ kind: 'text', value: description.slice(lastIndex, index) })
    }

    segments.push({ kind: 'term', key: match[1]! })
    lastIndex = index + match[0].length
  }

  if (lastIndex < description.length) {
    segments.push({ kind: 'text', value: description.slice(lastIndex) })
  }

  return segments
}
