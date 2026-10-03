import { mkdirSync, readFileSync } from 'node:fs'
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

mkdirSync('public/splash', { recursive: true })
for (const [width, height, ratio] of [
  [375, 812, 3],
  [390, 844, 3],
  [393, 852, 3],
  [402, 874, 3],
  [414, 896, 3],
  [428, 926, 3],
  [430, 932, 3],
  [440, 956, 3]
]) {
  const pixelWidth = width * ratio
  const pixelHeight = height * ratio
  const logoSize = Math.round(pixelWidth * 0.38)
  const logo = await sharp(Buffer.from(svg), { density: 600 })
    .resize(logoSize, logoSize)
    .png()
    .toBuffer()
  await sharp({
    create: {
      width: pixelWidth,
      height: pixelHeight,
      channels: 4,
      background: '#faf1e7'
    }
  })
    .composite([
      {
        input: logo,
        left: Math.round((pixelWidth - logoSize) / 2),
        top: Math.round((pixelHeight - logoSize) / 2)
      }
    ])
    .png()
    .toFile(`public/splash/iphone-${width}x${height}.png`)
}
