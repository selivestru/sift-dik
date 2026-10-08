import type { SpellSpeed } from './generator/spell-speeds'
import { spellSpeeds } from './generator/spell-speeds'

export default function SpellSpeedTabs({
  value,
  onChange,
}: {
  value: SpellSpeed
  onChange: (value: SpellSpeed) => void
}) {
  const selected = spellSpeeds.find((speed) => speed.id === value)!
  return (
    <section className="spell-speed-picker" aria-label="Тип заклинания">
      <h3 id="spell-speed-label">Тип заклинания</h3>
      <div className="spell-speed-tabs" role="tablist" aria-labelledby="spell-speed-label">
        {spellSpeeds.map((speed, index) => (
          <button
            type="button"
            key={speed.id}
            id={`speed-${speed.id}`}
            role="tab"
            aria-selected={value === speed.id}
            aria-controls="spell-speed-detail"
            tabIndex={value === speed.id ? 0 : -1}
            onClick={() => onChange(speed.id)}
            onKeyDown={(event) => {
              let next: number
              if (event.key === 'ArrowRight') next = (index + 1) % spellSpeeds.length
              else if (event.key === 'ArrowLeft')
                next = (index + spellSpeeds.length - 1) % spellSpeeds.length
              else if (event.key === 'Home') next = 0
              else if (event.key === 'End') next = spellSpeeds.length - 1
              else return
              event.preventDefault()
              const target = spellSpeeds[next]!
              onChange(target.id)
              document.getElementById(`speed-${target.id}`)?.focus()
            }}
          >
            <img src={`${import.meta.env.BASE_URL}assets/spell-speeds/${speed.icon}`} alt="" />
            {speed.label}
          </button>
        ))}
      </div>
      <p
        id="spell-speed-detail"
        role="tabpanel"
        aria-labelledby={`speed-${value}`}
        className="hint"
      >
        {selected.name} · отображается под названием карточки
      </p>
    </section>
  )
}
