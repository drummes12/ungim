function readableInk(hex: string): string {
  const value = hex.replace('#', '')
  if (value.length !== 6) return '#14110f'
  const [r, g, b] = [0, 2, 4].map((index) => {
    const channel = parseInt(value.slice(index, index + 2), 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return (luminance + 0.05) / 0.0559 >= 4.5 ? '#14110f' : '#ffffff'
}

export function Avatar({
  name,
  color,
  size = 'md'
}: {
  name: string
  color: string
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ backgroundColor: color, color: readableInk(color) }}
      aria-hidden='true'
    >
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  )
}
