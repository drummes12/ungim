import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Correo').fill('ana@ungim.test')
  await page.getByLabel('Contraseña').fill('donuts')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible()
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
