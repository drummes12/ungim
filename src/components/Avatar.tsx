import { blobatar } from 'blobatar/blob'

export function Avatar({
  name,
  size = 'md'
}: {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const svg = blobatar(name, { background: 'circle' })
  return (
    <span
      className={`avatar avatar-${size}`}
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-hidden='true'
    />
  )
}
