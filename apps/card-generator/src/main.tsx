import { createRoot } from 'react-dom/client'

import App from './App'
import { factions } from './generator/factions'
import type { FactionImages } from './generator/factions'
import { keywords } from './generator/keywords'
import type { KeywordImages } from './generator/keywords'
import { loadImage } from './generator/render'
import { spellSpeeds } from './generator/spell-speeds'
import type { SpellSpeedImages } from './generator/spell-speeds'

import './style.css'

const root = createRoot(document.getElementById('root')!)
root.render(<p className="loading">Загрузка рамок и шрифта…</p>)
const assets = `${import.meta.env.BASE_URL}assets/`

async function start() {
  try {
    const iconFiles = [...new Set(keywords.flatMap((keyword) => [...keyword.icons]))]
    const [unit, spell, entries, factionEntries, speedEntries] = await Promise.all([
      loadImage(`${assets}unit.png`),
      loadImage(`${assets}spell.png`),
      Promise.all(
        iconFiles.map(
          async (file) => [file, await loadImage(`${assets}keywords/${file}`)] as const,
        ),
      ),
      Promise.all(
        factions.map(
          async (faction) =>
            [faction.id, await loadImage(`${assets}factions/${faction.icon}`)] as const,
        ),
      ),
      Promise.all(
        spellSpeeds.map(
          async (speed) =>
            [speed.id, await loadImage(`${assets}spell-speeds/${speed.icon}`)] as const,
        ),
      ),
      document.fonts.load('700 66px CardTitle'),
      document.fonts.load('44px CardSans'),
      document.fonts.load('700 104px CardSans'),
    ])
    const keywordImages: KeywordImages = Object.fromEntries(entries)
    const factionImages = Object.fromEntries(factionEntries) as FactionImages
    const spellSpeedImages = Object.fromEntries(speedEntries) as SpellSpeedImages
    root.render(
      <App
        frames={{ unit, spell }}
        keywordImages={keywordImages}
        factionImages={factionImages}
        spellSpeedImages={spellSpeedImages}
      />,
    )
  } catch {
    root.render(
      <p className="loading" role="alert">
        Не удалось загрузить рамки, иконки или шрифты. Перезагрузите страницу.
      </p>,
    )
  }
}
void start()
