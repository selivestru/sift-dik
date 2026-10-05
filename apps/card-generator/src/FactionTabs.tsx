import { factions } from './generator/factions'
import type { FactionId } from './generator/factions'

export default function FactionTabs({
  value,
  onChange,
}: {
  value: FactionId
  onChange: (value: FactionId) => void
}) {
  const current = factions.find((faction) => faction.id === value)!
  return (
    <section className="faction-picker" aria-label="Фракция карточки">
      <h3 id="faction-label">Фракция</h3>
      <div className="faction-tabs" role="tablist" aria-labelledby="faction-label">
        {factions.map((faction, index) => (
          <button
            type="button"
            id={`faction-${faction.id}`}
            key={faction.id}
            role="tab"
            aria-selected={value === faction.id}
            aria-controls="faction-detail"
            tabIndex={value === faction.id ? 0 : -1}
            onClick={() => onChange(faction.id)}
            onKeyDown={(event) => {
              let next: number
              if (event.key === 'ArrowRight') next = (index + 1) % factions.length
              else if (event.key === 'ArrowLeft')
                next = (index + factions.length - 1) % factions.length
              else if (event.key === 'Home') next = 0
              else if (event.key === 'End') next = factions.length - 1
              else return
              event.preventDefault()
              const target = factions[next]!
              onChange(target.id)
              document.getElementById(`faction-${target.id}`)?.focus()
            }}
          >
            <img src={`${import.meta.env.BASE_URL}assets/factions/${faction.icon}`} alt="" />
            <span>{faction.name}</span>
          </button>
        ))}
      </div>
      <div
        id="faction-detail"
        role="tabpanel"
        aria-labelledby={`faction-${value}`}
        className="faction-detail"
      >
        <img src={`${import.meta.env.BASE_URL}assets/factions/${current.icon}`} alt="" />
        <div>
          <strong style={{ color: current.color }}>{current.name}</strong>
          <p>{current.description}</p>
        </div>
      </div>
    </section>
  )
}
