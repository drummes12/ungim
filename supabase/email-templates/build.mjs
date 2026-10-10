import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Generates the paste-ready HTML files in this folder. Each output keeps the
// Supabase template variables ({{ .TokenHash }}, {{ .Token }}, {{ .SiteURL }})
// as literal placeholders — Supabase interpolates them when sending.
// Run: node supabase/email-templates/build.mjs

const PAPER = '#faf1e7'
const SURFACE = '#fffdf9'
const INK = '#14110f'
const MUTED = '#6b6156'
const CORAL = '#ff9078'
const PINK = '#ffb3c9'
const AMBER = '#ffefc4'
const FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

// The brand mark is pure HTML/CSS: Gmail and Apple Mail render the rounded
// donut/plates, Outlook degrades to squares. No remote image to block and no
// SVG (Gmail/Outlook do not render SVG at all).
const PLATE = (width, height, radius) =>
  `<div style="width: ${width}px; height: ${height}px; background: ${INK}; border-radius: ${radius}px;"></div>`

const MARK = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
  <tr>
    <td style="vertical-align: middle; padding-right: 5px;">${PLATE(9, 17, 4)}</td>
    <td style="vertical-align: middle; padding-right: 7px;">${PLATE(10, 28, 5)}</td>
    <td style="vertical-align: middle;">
      <div style="width: 54px; height: 54px; line-height: 0; background: ${PINK}; border: 3px solid ${INK}; border-radius: 50%; text-align: center;">
        <div style="display: inline-block; width: 18px; height: 18px; margin-top: 15px; background: ${SURFACE}; border: 3px solid ${INK}; border-radius: 50%;"></div>
      </div>
    </td>
    <td style="vertical-align: middle; padding-left: 7px;">${PLATE(10, 28, 5)}</td>
    <td style="vertical-align: middle; padding-left: 5px;">${PLATE(9, 17, 4)}</td>
  </tr>
</table>`

const link = (type) =>
  `{{ .SiteURL }}?token_hash={{ .TokenHash }}&amp;type=${type}`

function shell({ preheader, heading, body, cta, code, note }) {
  const ctaRow = cta
    ? `<tr>
      <td align="center" style="padding: 8px 32px 24px;">
        <a href="${cta.url}" target="_blank" style="display: inline-block; background: ${CORAL}; color: ${INK}; border: 2px solid ${INK}; border-radius: 12px; box-shadow: 4px 4px 0 ${INK}; font-family: ${FONT}; font-size: 16px; font-weight: 800; line-height: 20px; padding: 14px 28px; text-decoration: none;">${cta.label}</a>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px 20px; word-break: break-all;">
        <p style="margin: 0; font-family: ${FONT}; font-size: 12px; line-height: 18px; color: ${MUTED};">Si el botón no funciona, pega este enlace en tu navegador:<br><a href="${cta.url}" style="color: ${MUTED};">${cta.url}</a></p>
      </td>
    </tr>`
    : ''
  const codeRow = code
    ? `<tr>
      <td align="center" style="padding: 8px 32px 24px;">
        <div style="display: inline-block; background: ${PAPER}; border: 2px solid ${INK}; border-radius: 12px; font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 10px; padding: 14px 10px 14px 24px;">${code}</div>
      </td>
    </tr>`
    : ''

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ahhh, un gim!</title>
</head>
<body style="margin: 0; padding: 0; background: ${PAPER};">
  <div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${PAPER};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 480px; background: ${SURFACE}; border: 2px solid ${INK}; border-radius: 18px; overflow: hidden;">
          <tr>
            <td align="center" style="background: ${AMBER}; border-bottom: 2px solid ${INK}; padding: 28px 16px;">
              ${MARK}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 28px 32px 8px;">
              <h1 style="margin: 0; font-family: ${FONT}; font-size: 24px; font-weight: 900; line-height: 30px; color: ${INK};">${heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 8px;">
              <p style="margin: 0; font-family: ${FONT}; font-size: 15px; line-height: 24px; color: ${MUTED}; text-align: center;">${body}</p>
            </td>
          </tr>
          ${ctaRow}
          ${codeRow}
          <tr>
            <td style="border-top: 2px solid ${INK}; padding: 16px 32px;">
              <p style="margin: 0; font-family: ${FONT}; font-size: 12px; line-height: 18px; color: ${MUTED}; text-align: center;">${note ?? 'Ejercicio, comidas y rosquillas. Una competencia privada por Cumbres.'}</p>
            </td>
          </tr>
        </table>
        <p style="margin: 16px 0 0; font-family: ${FONT}; font-size: 12px; line-height: 18px; color: ${MUTED};">Ahhh, un gim! · correo automático, no respondas aquí.</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

const templates = {
  'invite.html': {
    subject: 'Te invitaron a Ahhh, un gim!',
    heading: 'Te guardaron una rosquilla',
    body: 'Te invitaron a una Cumbre en a <strong>Ahhh, un gim!</strong>: ejercicio, comidas y rosquillas en una competencia privada por Cumbres. Crea tu contraseña y entra a competir.',
    cta: { label: 'Crear mi contraseña', url: link('invite') }
  },
  'recovery.html': {
    subject: 'Recupera tu contraseña — Ahhh, un gim!',
    heading: '¿Se te olvidó la llave del gim?',
    body: 'Pasa con los mejores planes. Usa este enlace para crear una contraseña nueva. Si no fuiste tú, ignora este correo y todo sigue igual.',
    cta: { label: 'Restablecer contraseña', url: link('recovery') }
  },
  'magic-link.html': {
    subject: 'Tu pase al gim — Ahhh, un gim!',
    heading: 'Tu pase de entrada',
    body: 'Un toque y estás dentro del marcador. El enlace caduca pronto y solo funciona una vez.',
    cta: { label: 'Entrar al gim', url: link('magiclink') }
  },
  'confirm-signup.html': {
    subject: 'Confirma tu correo — Ahhh, un gim!',
    heading: 'Un último calentamiento',
    body: 'Confirma que este correo es tuyo y queda todo listo para repartir rosquillas.',
    cta: { label: 'Confirmar correo', url: link('signup') }
  },
  'email-change.html': {
    subject: 'Confirma tu correo nuevo — Ahhh, un gim!',
    heading: '¿Correo nuevo?',
    body: 'Confirma esta dirección para que siga siendo tu entrada al gim. Si no pediste el cambio, ignora este correo.',
    cta: { label: 'Confirmar correo nuevo', url: link('email_change') }
  },
  'reauthentication.html': {
    subject: '{{ .Token }} es tu código — Ahhh, un gim!',
    heading: 'Tu código de verificación',
    body: 'Úsalo para confirmar que eres tú. Caduca pronto.',
    code: '{{ .Token }}'
  },
  'password-changed.html': {
    subject: 'Tu contraseña cambió — Ahhh, un gim!',
    heading: 'Contraseña actualizada',
    body: 'Se confirmó el cambio de contraseña de tu cuenta. Si no fuiste tú, restablécela de inmediato desde la app.'
  }
}

const outDir = dirname(fileURLToPath(import.meta.url))
for (const [file, template] of Object.entries(templates)) {
  const { subject, ...options } = template
  writeFileSync(
    join(outDir, file),
    `<!-- Subject: ${subject} -->\n` +
      shell({ preheader: options.heading, ...options })
  )
  console.log(`wrote ${file} — subject: ${subject}`)
}
