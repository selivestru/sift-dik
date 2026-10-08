import { useLayoutEffect, useRef, useState } from 'react'

import DescriptionEditor from './DescriptionEditor'
import FactionTabs from './FactionTabs'
import type { DescriptionPart } from './generator/description'
import { descriptionPlainText } from './generator/description'
import type { FactionId, FactionImages } from './generator/factions'
import type { KeywordId, KeywordImages } from './generator/keywords'
import type { CardData } from './generator/render'
import { exportPng, loadImage, renderCard } from './generator/render'
import type { SpellSpeed, SpellSpeedImages } from './generator/spell-speeds'
import type { CardType } from './generator/templates'
import { templates } from './generator/templates'
import KeywordPicker from './KeywordPicker'
import SpellSpeedTabs from './SpellSpeedTabs'

interface Draft {
  name: string
  keywords: KeywordId[]
  spellSpeed: SpellSpeed
  energy: string
  attack: string
  health: string
  description: DescriptionPart[]
  art?: HTMLImageElement
  faction: FactionId
  artName?: string
  pending: number
  error: string
}
const createDraft = (): Draft => ({
  name: '',
  faction: 'dik',
  keywords: [],
  spellSpeed: 'slow',
  energy: '2',
  attack: '3',
  health: '4',
  description: [],
  pending: 0,
  error: '',
})
const validNumber = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value))

function cardData(type: CardType, draft: Draft): CardData {
  return {
    type,
    name: draft.name,
    keywords: type === 'unit' ? draft.keywords : [],
    spellSpeed: type === 'spell' ? draft.spellSpeed : undefined,
    energy: validNumber(draft.energy) ? Number(draft.energy) : 0,
    attack: validNumber(draft.attack) ? Number(draft.attack) : 0,
    health: validNumber(draft.health) ? Number(draft.health) : 0,
    description: descriptionPlainText(draft.description),
    descriptionParts: draft.description,
  }
}

export default function App({
  frames,
  keywordImages,
  factionImages,
  spellSpeedImages,
}: {
  frames: Record<CardType, HTMLImageElement>
  keywordImages: KeywordImages
  factionImages: FactionImages
  spellSpeedImages: SpellSpeedImages
}) {
  const [type, setType] = useState<CardType>('unit')
  const [drafts, setDrafts] = useState<Record<CardType, Draft>>({
    unit: createDraft(),
    spell: createDraft(),
  })
  const [fits, setFits] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const versions = useRef<Record<string, number>>({})
  const draft = drafts[type]
  const numbersValid =
    validNumber(draft.energy) &&
    (type === 'spell' || (validNumber(draft.attack) && validNumber(draft.health)))

  function update(field: 'name' | 'energy' | 'attack' | 'health', value: string) {
    setDrafts((current) => ({ ...current, [type]: { ...current[type], [field]: value } }))
    setExportError('')
  }

  useLayoutEffect(() => {
    if (canvasRef.current) {
      const result = renderCard(canvasRef.current, cardData(type, draft), {
        spellSpeeds: spellSpeedImages,
        keywords: keywordImages,
        frame: frames[type],
        art: draft.art,
        faction: factionImages[draft.faction],
      })
      setFits(result.descriptionFits)
    }
  }, [draft, type, frames, keywordImages, factionImages, spellSpeedImages])

  async function upload(field: 'art', file?: File) {
    if (!file) return
    const selectedType = type
    const key = `${selectedType}-${field}`
    const version = (versions.current[key] ?? 0) + 1
    versions.current[key] = version
    setDrafts((current) => ({
      ...current,
      [selectedType]: {
        ...current[selectedType],
        pending: current[selectedType].pending + 1,
        error: '',
      },
    }))
    const url = URL.createObjectURL(file)
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
        throw new Error('Выберите PNG, JPEG или WebP')
      const image = await loadImage(url)
      if (versions.current[key] === version) {
        setDrafts((current) => ({
          ...current,
          [selectedType]: { ...current[selectedType], [field]: image, [`${field}Name`]: file.name },
        }))
      }
    } catch (error) {
      if (versions.current[key] === version)
        setDrafts((current) => ({
          ...current,
          [selectedType]: {
            ...current[selectedType],
            error: error instanceof Error ? error.message : 'Ошибка загрузки',
          },
        }))
    } finally {
      URL.revokeObjectURL(url)
      setDrafts((current) => ({
        ...current,
        [selectedType]: { ...current[selectedType], pending: current[selectedType].pending - 1 },
      }))
    }
  }

  async function download() {
    const canvas = canvasRef.current
    if (!canvas || !numbersValid || !draft.art || draft.pending || !fits || exporting) return
    setExporting(true)
    setExportError('')
    try {
      const output = document.createElement('canvas')
      const result = renderCard(output, cardData(type, draft), {
        spellSpeeds: spellSpeedImages,
        keywords: keywordImages,
        frame: frames[type],
        art: draft.art,
        faction: factionImages[draft.faction],
      })
      if (!result.descriptionFits) throw new Error('Текст и навыки не помещаются в карточку')
      const blob = await exportPng(output)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `siftdik-${type}.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Ошибка экспорта')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <span className="eyebrow">SIFTDIK / CARD STUDIO</span>
          <h1>Создайте свою карточку</h1>
          <p>Арт, характеристики и описание — готовое изображение для игры.</p>
        </div>
        <span className="format-badge">PNG · 1200 × 1600 · 3:4</span>
      </header>
      <div className="workspace">
        <section className="settings" aria-label="Настройки карточки">
          <div className="tabs" role="tablist" aria-label="Тип карточки">
            {(['unit', 'spell'] as const).map((item) => (
              <button
                key={item}
                id={`tab-${item}`}
                role="tab"
                aria-selected={type === item}
                aria-controls="card-settings"
                tabIndex={type === item ? 0 : -1}
                onClick={() => setType(item)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault()
                    const next = item === 'unit' ? 'spell' : 'unit'
                    setType(next)
                    document.getElementById(`tab-${next}`)?.focus()
                  }
                }}
              >
                {item === 'unit' ? 'Unit' : 'Spell'}
              </button>
            ))}
          </div>
          <div id="card-settings" role="tabpanel" aria-labelledby={`tab-${type}`}>
            <h2>Параметры {type === 'unit' ? 'юнита' : 'заклинания'}</h2>
            <label className="name-label">
              Название карточки
              <input
                type="text"
                maxLength={80}
                placeholder="Название"
                value={draft.name}
                onChange={(event) => update('name', event.target.value)}
              />
            </label>
            <div className="stats-inputs">
              {(
                ['energy', ...(type === 'unit' ? (['attack', 'health'] as const) : [])] as const
              ).map((field) => (
                <label key={field}>
                  {{ energy: 'Энергия', attack: 'Атака', health: 'Здоровье' }[field]}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={draft[field]}
                    aria-invalid={!validNumber(draft[field])}
                    onChange={(event) => update(field, event.target.value)}
                  />
                </label>
              ))}
            </div>
            {type === 'unit' ? (
              <KeywordPicker
                key={type}
                selected={draft.keywords}
                onChange={(value) =>
                  setDrafts((current) => ({
                    ...current,
                    [type]: { ...current[type], keywords: value },
                  }))
                }
              />
            ) : (
              <SpellSpeedTabs
                value={draft.spellSpeed}
                onChange={(spellSpeed) =>
                  setDrafts((current) => ({ ...current, spell: { ...current.spell, spellSpeed } }))
                }
              />
            )}
            <DescriptionEditor
              key={`description-${type}`}
              value={draft.description}
              onChange={(description) => {
                setDrafts((current) => ({ ...current, [type]: { ...current[type], description } }))
                setExportError('')
              }}
            />
            <FactionTabs
              value={draft.faction}
              onChange={(faction) =>
                setDrafts((current) => ({ ...current, [type]: { ...current[type], faction } }))
              }
            />
            <div className="upload" key={type}>
              <label>
                Арт карточки
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    void upload('art', event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </label>
              <p className="hint">
                {draft.artName ?? 'PNG, JPEG или WebP · кадрирование по центру'}
              </p>
              {draft.art && (
                <button
                  type="button"
                  className="clear-button"
                  onClick={() => {
                    versions.current[`${type}-art`] = (versions.current[`${type}-art`] ?? 0) + 1
                    setDrafts((current) => ({
                      ...current,
                      [type]: { ...current[type], art: undefined, artName: undefined },
                    }))
                  }}
                >
                  Убрать изображение
                </button>
              )}
            </div>
            <div className="messages" aria-live="polite">
              {!numbersValid && (
                <p className="error">Характеристики должны быть целыми неотрицательными числами.</p>
              )}
              {!fits && (
                <p className="error">
                  Блок текста превышает высоту карточки.{' '}
                  {type === 'unit'
                    ? 'Сократите описание или уменьшите количество навыков.'
                    : 'Сократите описание.'}
                </p>
              )}
              {!!draft.pending && <p>Загрузка изображения…</p>}
              {draft.error && <p className="error">{draft.error}</p>}
              {exportError && <p className="error">{exportError}</p>}
            </div>
            <button
              className="download"
              disabled={!draft.art || !numbersValid || !fits || !!draft.pending || exporting}
              onClick={() => void download()}
            >
              {exporting ? 'Создание PNG…' : 'Скачать PNG'}
              <span aria-hidden="true">↓</span>
            </button>
            {!draft.art && <p className="hint">Загрузите арт, чтобы скачать карточку.</p>}
          </div>
        </section>
        <section className="preview" aria-label="Предпросмотр карточки">
          <div className="preview-heading">
            <h2>Предпросмотр</h2>
            <span>
              <i />
              Обновляется автоматически
            </span>
          </div>
          <div className="canvas-stage">
            <canvas
              ref={canvasRef}
              aria-label={`Карточка ${draft.name || type}: энергия ${draft.energy}${type === 'unit' ? `, атака ${draft.attack}, здоровье ${draft.health}` : ''}. ${descriptionPlainText(draft.description)}`}
            />
          </div>
          <p className="preview-note">
            {templates[type].frame} <span>Прозрачный фон · полное разрешение при экспорте</span>
          </p>
        </section>
      </div>
    </main>
  )
}
