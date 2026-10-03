import { useEffect, useState } from 'react'
import {
  dismissInstallHint,
  getInstallPrompt,
  installHintDismissed,
  isIos,
  isStandaloneMode,
  markInstalled,
  subscribeAppInstalled,
  subscribeInstallPrompt,
  swUpdateEvent,
  swUpdatePending,
  wasInstalled,
  watchInstallPrompt,
  type InstallPromptEvent
} from '../lib/pwa'

export function PwaNotices() {
  const [standalone, setStandalone] = useState(isStandaloneMode)
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(
    getInstallPrompt
  )
  const [dismissed, setDismissed] = useState(installHintDismissed)
  const [updateReady, setUpdateReady] = useState(swUpdatePending)
  const [updateLater, setUpdateLater] = useState(false)

  useEffect(() => {
    watchInstallPrompt()
    const unsubscribePrompt = subscribeInstallPrompt(setPrompt)
    const unsubscribeInstalled = subscribeAppInstalled(() => {
      setStandalone(true)
      setDismissed(true)
    })
    const onUpdate = () => {
      setUpdateLater(false)
      setUpdateReady(true)
    }
    window.addEventListener(swUpdateEvent, onUpdate)
    if (isStandaloneMode()) markInstalled()
    return () => {
      unsubscribePrompt()
      unsubscribeInstalled()
      window.removeEventListener(swUpdateEvent, onUpdate)
    }
  }, [])

  function dismiss() {
    dismissInstallHint()
    setDismissed(true)
  }

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    setPrompt(null)
    dismiss()
  }

  if (updateReady && !updateLater)
    return (
      <div className='toast toast-panel' role='status'>
        <strong>Hay versión nueva</strong>
        <p>Un toque para actualizar.</p>
        <div className='toast-actions'>
          <button
            className='btn'
            type='button'
            onClick={() => setUpdateLater(true)}
          >
            Después
          </button>
          <button
            className='btn btn-primary'
            type='button'
            onClick={() => window.location.reload()}
          >
            Actualizar
          </button>
        </div>
      </div>
    )

  if (standalone || dismissed) return null

  if (prompt)
    return (
      <div className='toast toast-panel' role='status'>
        <strong>Instala Un Gim</strong>
        <p>Un toque y queda en tu pantalla de inicio.</p>
        <div className='toast-actions'>
          <button className='btn' type='button' onClick={dismiss}>
            Ahora no
          </button>
          <button
            className='btn btn-primary'
            type='button'
            onClick={() => void install()}
          >
            Instalar
          </button>
        </div>
      </div>
    )

  if (isIos())
    return (
      <div className='toast toast-panel' role='status'>
        <strong>Instala Un Gim</strong>
        <p>Toca Compartir → «Añadir a pantalla de inicio».</p>
        <div className='toast-actions'>
          <button className='btn btn-primary' type='button' onClick={dismiss}>
            Entendido
          </button>
        </div>
      </div>
    )

  return null
}

export function InstallHelp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(
    getInstallPrompt
  )

  useEffect(() => {
    watchInstallPrompt()
    return subscribeInstallPrompt(setPrompt)
  }, [])

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    setPrompt(null)
  }

  if (isStandaloneMode())
    return (
      <div className='stack'>
        <p className='page-sub'>Ya estás dentro de la app instalada.</p>
      </div>
    )

  if (prompt)
    return (
      <div className='stack'>
        <p className='page-sub'>
          Un toque y queda en tu pantalla de inicio.
        </p>
        <button
          className='btn btn-primary btn-block'
          type='button'
          onClick={() => void install()}
        >
          Instalar
        </button>
      </div>
    )

  return (
    <div className='stack'>
      <p className='page-sub'>
        {isIos()
          ? 'En Safari toca Compartir → «Añadir a pantalla de inicio».'
          : wasInstalled()
            ? 'Ya la instalaste: busca el ícono de Un Gim en tu pantalla de inicio.'
            : 'Abre el menú del navegador y elige «Instalar app» o «Añadir a pantalla de inicio».'}
      </p>
    </div>
  )
}
