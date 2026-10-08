import { useState } from 'react'

import type { KeywordId } from './generator/keywords'
import { keywords } from './generator/keywords'

export default function KeywordPicker({
  selected,
  onChange,
}: {
  selected: readonly KeywordId[]
  onChange: (value: KeywordId[]) => void
}) {
  const [search, setSearch] = useState('')
  const visible = keywords.filter((keyword) =>
    keyword.name.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru').trim()),
  )

  return (
    <fieldset className="keyword-picker">
      <legend>
        Статические навыки <span>{selected.length} выбрано</span>
      </legend>
      <label className="keyword-search">
        Найти навык
        <input
          type="search"
          value={search}
          placeholder="Например, Щит"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="keyword-list">
        {visible.map((keyword) => {
          const enabled = selected.includes(keyword.id)
          return (
            <button
              key={keyword.id}
              type="button"
              className="keyword-toggle"
              role="switch"
              aria-checked={enabled}
              onClick={() =>
                onChange(
                  enabled ? selected.filter((id) => id !== keyword.id) : [...selected, keyword.id],
                )
              }
            >
              <span className="keyword-icons" aria-hidden="true">
                {keyword.icons.map((icon) => (
                  <img
                    key={icon}
                    src={`${import.meta.env.BASE_URL}assets/keywords/${icon}`}
                    alt=""
                  />
                ))}
              </span>
              <span>{keyword.name}</span>
              <span className="switch-track" aria-hidden="true" />
            </button>
          )
        })}
        {!visible.length && <p className="hint">Навык не найден.</p>}
      </div>
      <p className="hint">
        Один навык — иконка и название. Несколько — только иконки над описанием.
      </p>
      {selected.length > 0 && (
        <button type="button" className="clear-button" onClick={() => onChange([])}>
          Снять все навыки
        </button>
      )}
    </fieldset>
  )
}
