import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(buffer) {
  let value = 0xffffffff
  for (const byte of buffer) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const buffer = Buffer.alloc(12 + data.length)
  buffer.writeUInt32BE(data.length, 0)
  buffer.write(type, 4)
  data.copy(buffer, 8)
  buffer.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 8 + data.length)
  return buffer
}

function mix(a, b, amount) {
  return Math.round(a + (b - a) * amount)
}

function drawIcon(size, file, padding = 0) {
  const rows = []
  const cx = size / 2
  const cy = size * 0.55
  const outer = size * 0.35 * (1 - padding)
  const inner = outer * 0.31
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4)
    row[0] = 0
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx
      const dy = y - cy
      const distance = Math.sqrt(dx * dx + dy * dy)
      const edge = Math.abs(distance - outer)
      const insideDonut = distance < outer && distance > inner
      const wave = Math.sin(Math.atan2(dy, dx) * 8 + 0.7) * outer * 0.055
      const icingDistance = distance - outer * 0.9 - wave
      const insideIcing = insideDonut && icingDistance < 0
      let r = 255
      let g = 244
      let b = 232
      let a = 255
      if (insideDonut) {
        r = 217
        g = 144
        b = 67
      }
      if (insideIcing) {
        r = 255
        g = 117
        b = 168
      }
      if (distance > outer) {
        const bg = Math.min(1, Math.hypot(x / size - 0.2, y / size - 0.1) * 0.55)
        r = mix(255, 255, bg)
        g = mix(244, 231, bg)
        b = mix(232, 213, bg)
      }
      if (edge < 1.2 && distance > inner) {
        r = mix(r, 122, 0.12)
        g = mix(g, 82, 0.12)
        b = mix(b, 45, 0.12)
      }
      const offset = 1 + x * 4
      row[offset] = r
      row[offset + 1] = g
      row[offset + 2] = b
      row[offset + 3] = a
    }
    rows.push(row)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(file, png)
}

drawIcon(192, 'public/icons/icon-192.png')
drawIcon(512, 'public/icons/icon-512.png')
drawIcon(512, 'public/icons/icon-maskable.png', 0.18)
drawIcon(180, 'public/apple-touch-icon.png')
