import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Correo').fill('ana@ungim.test')
  await page.getByLabel('Contraseña').fill('donuts')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible()
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
  await page.goto('/')
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
  await expect(page.getByRole('heading', { name: 'Marcador' })).toBeVisible()
  await expect(page.getByText('Rosquillas por semanas perfectas')).toBeVisible()
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
