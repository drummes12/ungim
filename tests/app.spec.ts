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
  await expect(page.getByRole('status')).toHaveText('¡Ahhh, un gim!')
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
  await expect(page.getByText('Sin conexión')).toBeVisible()
  await page.getByRole('button', { name: 'No' }).first().click()
  await page.getByRole('button', { name: 'No' }).nth(1).click()
  await expect(page.getByText('2 por sincronizar')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: /Hola, Ana/ })).toBeVisible()
  await expect(page.getByText(/por sincronizar/)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'No' }).first()
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'No' }).nth(1)).toHaveAttribute(
    'aria-pressed',
    'true'
  )

  await context.setOffline(false)
  await expect(page.getByText('Al día')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'No' }).first()
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'No' }).nth(1)).toHaveAttribute(
    'aria-pressed',
    'true'
  )
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
  await expect(page.getByText('Sin conexión')).toBeVisible()
})
