import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const svg = readFileSync('public/favicon.svg', 'utf8')

async function render(size, file, inset = 0) {
  const inner = Math.round(size * (1 - inset * 2))
  const icon = await sharp(Buffer.from(svg), { density: 600 })
    .resize(inner, inner)
    .png()
    .toBuffer()
  if (!inset) {
    await sharp(icon).png().toFile(file)
    return
  }
  const offset = Math.round((size - inner) / 2)
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: '#faf1e7'
    }
  })
    .composite([{ input: icon, left: offset, top: offset }])
    .png()
    .toFile(file)
}

await render(192, 'public/icons/icon-192.png')
await render(512, 'public/icons/icon-512.png')
await render(512, 'public/icons/icon-maskable.png', 0.1)
await render(180, 'public/apple-touch-icon.png')
