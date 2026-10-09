import { expect, test } from '@playwright/test'
import sharp from 'sharp'

test.beforeEach(async ({ page }) => {
  await page.goto('/app')
  await page.getByLabel('Correo').fill('ana@ungim.test')
  await page.locator('input[autocomplete="current-password"]').fill('donuts')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible()
})

test('brand logo returns to the landing page while signed in and out', async ({
  page
}) => {
  await page.getByRole('link', { name: 'Ir a la página de inicio' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/app')
  await page.locator('.account-button').click()
  await page.getByRole('button', { name: 'Salir' }).click()
  await expect(
    page.getByRole('heading', { name: 'Entra a tu cuenta' })
  ).toBeVisible()
  await page.getByRole('link', { name: 'Ir al inicio' }).click()
  await expect(page).toHaveURL('/')
})

test('keeps modal actions reachable in a short mobile viewport', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 640 })
  await page.locator('.account-button').click()
  await page.getByRole('button', { name: 'Ajustar mi plan' }).click()

  const panel = page.locator('.sheet-panel')
  const body = page.locator('.sheet-body')
  const saveButton = page.getByRole('button', { name: 'Guardar plan' })
  await expect(panel).toBeVisible()
  await expect(panel).toHaveCSS('transform', 'none')
  await expect(saveButton).toBeVisible()
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(saveButton).toBeInViewport()

  const fitsViewport = await panel.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return bounds.top >= 0 && bounds.bottom <= window.innerHeight
  })
  expect(fitsViewport, JSON.stringify(await panel.boundingBox())).toBe(true)
})

test('offers the update and reloads on demand', async ({ page }) => {
  await page.evaluate(() => window.dispatchEvent(new Event('ungim:sw-update')))
  const updateButton = page.getByRole('button', { name: 'Actualizar' })
  await expect(page.getByText('Hay versión nueva')).toBeVisible()
  await expect(updateButton).toBeVisible()

  await page.getByRole('button', { name: 'Después' }).click()
  await expect(updateButton).toHaveCount(0)

  await page.evaluate(() => window.dispatchEvent(new Event('ungim:sw-update')))
  await Promise.all([page.waitForEvent('load'), updateButton.click()])
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible()
})

test('offers install when the browser fires beforeinstallprompt', async ({
  page
}) => {
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt')
    Object.assign(event, {
      prompt: () => {
        const target = window as unknown as { __installPrompted: boolean }
        target.__installPrompted = true
        return Promise.resolve()
      },
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' })
    })
    window.dispatchEvent(event)
  })

  await expect(page.getByText('Instala Un Gim')).toBeVisible()
  await page.getByRole('button', { name: 'Instalar' }).click()
  await expect(page.getByText('Instala Un Gim')).toHaveCount(0)
  await expect(
    page.evaluate(
      () =>
        (window as unknown as { __installPrompted?: boolean }).__installPrompted
    )
  ).resolves.toBe(true)
})

test('shows iOS install instructions once', async ({ browser }) => {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  })
  const page = await context.newPage()
  await page.goto('/app')
  await expect(page.getByText('Instala Un Gim')).toBeVisible()
  await expect(page.getByText('Añadir a pantalla de inicio')).toBeVisible()

  await page.getByRole('button', { name: 'Entendido' }).click()
  await expect(page.getByText('Instala Un Gim')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Instala Un Gim')).toHaveCount(0)
  await context.close()
})

test('records a meal and workout from Today', async ({ page }) => {
  await page.getByRole('button', { name: 'Sí' }).first().click()
  await expect(
    page.getByRole('button', { name: 'Sí' }).first()
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Entrené' }).click()
  await expect(page.locator('.toast')).toHaveText('¡Ahhh, un gim!')
  await page.getByRole('button', { name: 'Marcador' }).click()
  await expect(
    page.getByRole('heading', { name: 'Marcador', exact: true })
  ).toBeVisible()
  await expect(page.getByText('Rosquillas por semanas perfectas')).toBeVisible()
  await page.getByRole('button', { name: 'Compartir marcador' }).click()
  await expect(page.locator('.share-poster')).toHaveAttribute(
    'aria-label',
    'La carrera del mes, historia de Ahhh, un gim!'
  )
})

test('creates shareable story and anonymous transparent sticker cards', async ({
  page
}) => {
  await page.getByRole('button', { name: 'Entrené' }).click()
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined
    })
  )
  await expect
    .poll(() => page.evaluate(() => typeof navigator.share))
    .toBe('undefined')
  await page.getByRole('button', { name: 'Compartir mi avance' }).click()
  await expect(
    page.getByRole('heading', { name: 'Comparte tu proceso' })
  ).toBeVisible()
  const poster = page.locator('.share-poster')
  await expect(poster).toContainText('OTRO DÍA QUE SUMA')
  await page.getByRole('button', { name: 'Siguiente frase' }).click()
  await expect(poster).toContainText('MI PROCESO. MI RITMO.')
  await expect(poster).toContainText('Ahhh, un gim!')
  await expect(page.locator('.share-poster')).toHaveAttribute(
    'viewBox',
    '0 0 1080 1920'
  )
  await poster.evaluate((node) => {
    const svg = node as SVGSVGElement
    svg.style.transform = 'translate3d(-120px, 0, 0)'
  })
  const storySave = page.getByRole('button', { name: 'Guardar imagen' })
  await expect(storySave).toBeEnabled()
  const storyDownload = page.waitForEvent('download')
  await storySave.click()
  await expect(page.locator('.share-feedback')).toHaveText(
    'Imagen guardada. Ya puedes añadirla a tu historia.'
  )
  const story = await storyDownload
  const storyPath = await story.path()
  if (!storyPath) throw new Error('No se generó el PNG de story.')
  const storyMetadata = await sharp(storyPath).metadata()
  expect(storyMetadata.width).toBe(1080)
  expect(storyMetadata.height).toBe(1920)
  const { data: storyPixels, info: storyInfo } = await sharp(storyPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  expect(storyPixels[3]).toBe(255)
  const bottomRight =
    (storyInfo.width * storyInfo.height - 1) * storyInfo.channels + 3
  expect(storyPixels[bottomRight]).toBe(255)

  await poster.evaluate((node) => {
    const target = window as Window & { __cardTransitionCount?: number }
    target.__cardTransitionCount = 0
    node.addEventListener('transitionstart', (event) => {
      if (
        !(event instanceof TransitionEvent) ||
        event.propertyName !== 'transform'
      )
        return
      target.__cardTransitionCount = (target.__cardTransitionCount ?? 0) + 1
    })
  })
  const preview = page.locator('.share-preview')
  const bounds = await preview.boundingBox()
  if (!bounds) throw new Error('No se encontró la vista previa de la tarjeta.')
  await page.mouse.move(
    bounds.x + bounds.width * 0.75,
    bounds.y + bounds.height / 2
  )
  await page.mouse.down()
  await page.mouse.move(
    bounds.x + bounds.width * 0.3,
    bounds.y + bounds.height / 2,
    {
      steps: 5
    }
  )
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Rachas' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __cardTransitionCount?: number })
            .__cardTransitionCount
      )
    )
    .toBeGreaterThanOrEqual(2)
  const streakTextFits = await page
    .locator('.share-poster text')
    .evaluateAll((nodes) =>
      nodes.every((node) => {
        const bounds = (node as SVGTextElement).getBBox()
        return bounds.x >= 0 && bounds.x + bounds.width <= 1080
      })
    )
  expect(streakTextFits).toBe(true)

  await page.getByRole('button', { name: 'Carrera' }).click()
  await expect(page.getByRole('button', { name: 'Carrera' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(poster).toContainText('LA CARRERA.')
  await expect(poster).toContainText('OCTUBRE')
  await page.getByRole('button', { name: 'Sticker · PNG' }).click()
  await expect(page.locator('.share-poster')).toHaveAttribute(
    'viewBox',
    '0 0 1080 980'
  )
  await expect(poster).toContainText('LA CARRERA.')
  const stickerSave = page.getByRole('button', { name: 'Guardar imagen' })
  await expect(stickerSave).toBeEnabled()
  const stickerDownload = page.waitForEvent('download')
  await stickerSave.click()
  const sticker = await stickerDownload
  const stickerPath = await sticker.path()
  if (!stickerPath) throw new Error('No se generó el PNG del sticker.')
  const { data, info } = await sharp(stickerPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  expect(info.width).toBe(1080)
  expect(info.height).toBe(980)
  expect(data[3]).toBe(0)
  const filledPixel = (250 * info.width + 200) * info.channels
  expect(data[filledPixel + 3]).toBe(255)

  await page.getByRole('button', { name: 'Rachas' }).click()
  await expect(page.getByRole('button', { name: 'Rachas' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(poster).toContainText('DOS RACHAS')
  await expect(poster).toContainText('DÍAS SEGUIDOS')
  await expect(poster).toContainText('SEMANAS PERFECTAS')
  await expect(
    poster.locator('rect[x="70"][y="220"][width="940"][height="600"]')
  ).toHaveCount(1)
  await expect(
    poster.locator('rect[x="70"][y="220"][width="455"][height="590"]')
  ).toHaveCount(0)
  const shareCardButtons = page.getByRole('group', {
    name: 'Elige una tarjeta'
  })
  await shareCardButtons.getByRole('button', { name: 'Hoy' }).click()
  await expect(
    shareCardButtons.getByRole('button', { name: 'Hoy' })
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    poster.locator('rect[x="70"][y="120"][width="940"][height="205"]')
  ).toHaveCount(0)
  await expect(poster.locator('path[d^="M104 124"]')).toHaveCount(1)
})

test('uses native sharing with the already-rendered PNG file', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 640 })
  await page.evaluate(() => {
    const target = window as Window & { __sharedFile?: string }
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data: ShareData) => Boolean(data.files?.[0]?.type === 'image/png')
    })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        target.__sharedFile = data.files?.[0]?.name
      }
    })
  })
  await page.getByRole('button', { name: 'Entrené' }).click()
  await page.getByRole('button', { name: 'Compartir mi avance' }).click()
  const shareButton = page.getByRole('button', { name: 'Compartir imagen' })
  await expect(shareButton).toBeEnabled()
  await expect(shareButton).toBeInViewport()
  await shareButton.click()
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __sharedFile?: string }).__sharedFile
      )
    )
    .toMatch(/ahhh-un-gim-today-story-.*\.png/)
})

test('queues an entry offline, persists across reopen, and synchronizes', async ({
  page,
  context
}) => {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await context.setOffline(true)
  await expect(page.getByRole('status', { name: 'Sin conexión' })).toBeVisible()
  await page.getByRole('button', { name: 'No' }).first().click()
  await page.getByRole('button', { name: 'No' }).nth(1).click()
  await expect(
    page.getByRole('status', { name: '2 por sincronizar' })
  ).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible()
  await expect(
    page.getByRole('status', { name: /por sincronizar/ })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'No' }).first()
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'No' }).nth(1)).toHaveAttribute(
    'aria-pressed',
    'true'
  )

  await context.setOffline(false)
  await expect(page.getByRole('status', { name: 'Al día' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'No' }).first()
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'No' }).nth(1)).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})

test('reveals the app through the donut on each cold opening', async ({
  page
}) => {
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.launch-screen')).toBeVisible()
  await expect(page.locator('.launch-screen.is-zooming')).toBeVisible()
  await expect(page.locator('.launch-screen')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible()
})

test('reduced motion opens without scaling the donut', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.launch-screen')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible()
})

test('shows the offline screen when there is no cached session', async ({
  page,
  context
}) => {
  await page.evaluate(() => localStorage.removeItem('ungim-demo-session-v1'))
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await context.setOffline(true)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Nos vemos en línea.' })
  ).toBeVisible()
  await expect(
    page.getByText('Conéctate para iniciar sesión una vez.')
  ).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
})

test('installed production build can reopen its shell offline', async ({
  page,
  context
}) => {
  await page.waitForFunction(() => 'serviceWorker' in navigator)
  await page.waitForTimeout(1000)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Sin conexión' })).toBeVisible()
})
