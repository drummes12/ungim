import { useState } from 'react'
import { Sheet } from './Sheet'
import { ChevronIcon } from './icons'

export type MealDraft = { name: string; rule: string }

export function MealManager({
  meals,
  onChange
}: {
  meals: MealDraft[]
  onChange: (meals: MealDraft[]) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <fieldset className='routine-manager'>
      <legend>Comidas del plan</legend>
      <p className='field-note'>
        {meals.length} comida{meals.length === 1 ? '' : 's'}
      </p>
      <button
        type='button'
        className='btn'
        onClick={() => setOpen(true)}
      >
        Editar comidas
      </button>
      {open && (
        <Sheet title='Comidas' onClose={() => setOpen(false)}>
          <MealEditor meals={meals} onChange={onChange} />
        </Sheet>
      )}
    </fieldset>
  )
}

function MealEditor({
  meals,
  onChange
}: {
  meals: MealDraft[]
  onChange: (meals: MealDraft[]) => void
}) {
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const meal = editIndex !== null ? meals[editIndex] : undefined

  function patch(index: number, changes: Partial<MealDraft>) {
    onChange(
      meals.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item
      )
    )
  }

  if (meal && editIndex !== null) {
    return (
      <div className='stack'>
        <div className='run-head'>
          <button
            type='button'
            className='btn-link'
            onClick={() => setEditIndex(null)}
          >
            ← Comidas
          </button>
          <button
            type='button'
            className='btn btn-primary'
            onClick={() => setEditIndex(null)}
          >
            Listo
          </button>
        </div>
        <input
          aria-label='Nombre de la comida'
          value={meal.name}
          placeholder='Comida'
          maxLength={40}
          onChange={(event) => patch(editIndex, { name: event.target.value })}
        />
        <input
          aria-label={`Regla de ${meal.name || 'la comida'}`}
          value={meal.rule}
          placeholder='Regla breve (ej. sin harina, proteína primero)'
          maxLength={180}
          onChange={(event) => patch(editIndex, { rule: event.target.value })}
        />
        <button
          type='button'
          className='btn-quiet'
          disabled={meals.length <= 1}
          onClick={() => {
            onChange(meals.filter((_, index) => index !== editIndex))
            setEditIndex(null)
          }}
        >
          Eliminar comida
        </button>
      </div>
    )
  }

  return (
    <div className='stack'>
      <p className='routine-note'>
        Las comidas del plan se marcan Sí o No en el día. Toca una para
        editarla.
      </p>
      <ul className='tpl-list'>
        {meals.map((item, index) => (
          <li className='tpl-row' key={index}>
            <button
              type='button'
              className='tpl-open'
              onClick={() => setEditIndex(index)}
            >
              <strong>{item.name || 'Sin nombre'}</strong>
              <span>{item.rule || 'Sin regla'}</span>
              <ChevronIcon />
            </button>
          </li>
        ))}
      </ul>
      <button
        type='button'
        className='btn'
        disabled={meals.length >= 5}
        onClick={() => {
          onChange([...meals, { name: '', rule: '' }])
          setEditIndex(meals.length)
        }}
      >
        + Nueva comida
      </button>
    </div>
  )
}
