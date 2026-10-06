import { useSyncExternalStore } from 'react'

export type TemplateExercise = {
  name: string
  sets: number
  reps: number
  weight: number
}

export type RoutineTemplate = {
  id: number
  name: string
  exercises: TemplateExercise[]
}

type RoutineState = {
  templates: RoutineTemplate[]
  // Optional routine per weekday; index 0 = lunes … 6 = domingo
  weekday: (number | null)[]
}

let state: RoutineState = {
  templates: [
    {
      id: 1,
      name: 'Pierna',
      exercises: [
        { name: 'Sentadilla', sets: 4, reps: 8, weight: 60 },
        { name: 'Prensa', sets: 4, reps: 10, weight: 90 },
        { name: 'Extensión de cuádriceps', sets: 3, reps: 12, weight: 30 },
        { name: 'Peso muerto rumano', sets: 3, reps: 10, weight: 50 }
      ]
    }
  ],
  weekday: Array<number | null>(7).fill(null)
}

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useRoutineState() {
  return useSyncExternalStore(subscribe, () => state)
}

let nextTemplateId = 2

export function addTemplate(name: string, exercises: TemplateExercise[]) {
  const id = nextTemplateId++
  state = {
    ...state,
    templates: [...state.templates, { id, name, exercises }]
  }
  emit()
  return id
}

export function updateTemplate(
  id: number,
  patch: Partial<Omit<RoutineTemplate, 'id'>>
) {
  state = {
    ...state,
    templates: state.templates.map((template) =>
      template.id === id ? { ...template, ...patch } : template
    )
  }
  emit()
}

export function removeTemplate(id: number) {
  state = {
    templates: state.templates.filter((template) => template.id !== id),
    weekday: state.weekday.map((assigned) => (assigned === id ? null : assigned))
  }
  emit()
}

export function setWeekdayRoutine(index: number, templateId: number | null) {
  state = {
    ...state,
    weekday: state.weekday.map((assigned, day) =>
      day === index ? templateId : assigned
    )
  }
  emit()
}

// JS getDay() → store index (0 = lunes … 6 = domingo)
export function weekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7
}
