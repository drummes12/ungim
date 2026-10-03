export const swUpdateEvent = 'ungim:sw-update'

const dismissedKey = 'ungim-install-dismissed'
const installedKey = 'ungim-installed'

export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredPrompt: InstallPromptEvent | null = null
let swUpdateReady = false
let watching = false
const promptListeners = new Set<(prompt: InstallPromptEvent | null) => void>()
const installedListeners = new Set<() => void>()

export function watchInstallPrompt() {
  if (watching || typeof window === 'undefined') return
  watching = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    for (const listener of promptListeners) listener(deferredPrompt)
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    markInstalled()
    dismissInstallHint()
    for (const listener of promptListeners) listener(null)
    for (const listener of installedListeners) listener()
  })
}

export function subscribeInstallPrompt(
  listener: (prompt: InstallPromptEvent | null) => void
) {
  promptListeners.add(listener)
  return () => {
    promptListeners.delete(listener)
  }
}

export function subscribeAppInstalled(listener: () => void) {
  installedListeners.add(listener)
  return () => {
    installedListeners.delete(listener)
  }
}

export function getInstallPrompt() {
  return deferredPrompt
}

export function notifySwUpdate() {
  swUpdateReady = true
  window.dispatchEvent(new Event(swUpdateEvent))
}

export function swUpdatePending() {
  return swUpdateReady
}

export function isIos() {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function isStandaloneMode() {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  const standalone = (navigator as Navigator & { standalone?: boolean })
    .standalone
  if (standalone === true) return true
  return new URLSearchParams(window.location.search).get('source') === 'pwa'
}

export function markInstalled() {
  try {
    localStorage.setItem(installedKey, '1')
  } catch {
    return
  }
}

export function wasInstalled() {
  try {
    return localStorage.getItem(installedKey) === '1'
  } catch {
    return false
  }
}

export function dismissInstallHint() {
  try {
    localStorage.setItem(dismissedKey, '1')
  } catch {
    return
  }
}

export function installHintDismissed() {
  try {
    return localStorage.getItem(dismissedKey) === '1'
  } catch {
    return false
  }
}
