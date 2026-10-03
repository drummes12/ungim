# Ahhh Un Gim!

PWA privada para dos personas que compiten cada mes por cumplir sus planes de ejercicio y alimentación. Registra comidas y entrenamientos en uno o dos toques, funciona sin conexión y sincroniza cuando vuelve la red.

## Stack

- Vite 8 + React 19 + TypeScript
- `vite-plugin-pwa`/Workbox + IndexedDB (`idb`)
- Supabase Auth, PostgreSQL, RLS, Realtime y RPC transaccionales
- Cloudflare Pages para el build estático
- pnpm + Node 24.21.0

## Desarrollo

```bash
corepack enable
pnpm install
pnpm dev
```

La app exige Supabase en producción. Para revisar solo la interfaz usa `VITE_DEMO_MODE=true`; ese modo crea dos cuentas locales de demostración y nunca debe activarse en el deploy.

```bash
VITE_DEMO_MODE=true pnpm dev
```

Demo local:

- `ana@ungim.test` / `donuts`
- `leo@ungim.test` / `donuts`

## Supabase local

Docker debe estar iniciado.

```bash
pnpm supabase start
pnpm supabase db reset
```

`supabase/seed.sql` crea `ana@ungim.test` y `leo@ungim.test` con contraseña `donuts123`. Después ejecuta el frontend con la URL y clave pública que muestra `supabase status` en `.env.local`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local-key
VITE_DEMO_MODE=false
```

Las dos cuentas se configuran desde la app. La zona horaria del hogar se fija con el primer plan guardado y la competencia empieza cuando ambos perfiles tienen plan.

## Producción

1. Crear un proyecto Supabase.
2. Aplicar `supabase/migrations/20261003150000_initial_schema.sql`.
3. Desactivar registro público. El trigger `handle_new_user` crea el perfil automáticamente por cada `auth.user` nuevo y rechaza un tercero.
4. Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en el hosting.
5. Publicar `dist/` con el comando `pnpm build`.

Supabase Free puede pausar un proyecto con poca actividad; los registros locales seguirán funcionando, pero no sincronizarán hasta reanudarlo.

### Acceso de los dos jugadores

Cada persona se autentica con su correo y su propia contraseña desde su dispositivo:

1. En Dashboard → Authentication → Users → **Add user** → *Send invitation*, invita ambos correos (el tuyo y el de tu pareja).
2. Cada correo lleva a la app con `?token_hash=…&type=invite`: allí cada uno crea su contraseña y queda dentro con sesión iniciada.
3. Después basta el login normal. "Olvidé mi contraseña" envía un correo de recuperación al mismo flujo (`type=recovery`).

Los enlaces de correo apuntan a `auth.site_url` (ver la sección de Resend abajo): debe quedar en el dominio de la app antes del `config push`, y el dominio va también en `auth.additional_redirect_urls`.

### Correos con Resend

Los correos de auth salen por Resend vía SMTP — todo versionado en `supabase/config.toml` (`[auth.email.smtp]` + `[auth.email.template.*]`):

1. Verifica el dominio remitente en Resend y genera la API key.
2. En `config.toml`: pon tu dominio en `auth.email.smtp.admin_email` y cambia `auth.site_url` al dominio de la app — **sin esto los correos apuntan a localhost**.
3. Aplica la config al proyecto:

```bash
export RESEND_API_KEY="re_..."
supabase link --project-ref <ref>
supabase config push
```

Los links usan `{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=…` y la app los verifica con `verifyOtp`. Templates cubiertos por config: `invite`, `confirmation`, `recovery`, `magic_link`, `email_change` y la notificación `password_changed`. El template de **Reauthentication** no se puede definir por config — pega `reauthentication.html` a mano en Dashboard → Authentication → Emails si lo necesitas.

Si editas el diseño, regenera los HTML con `node supabase/email-templates/build.mjs` (el `.mjs` es la fuente de verdad).

## Verificación

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm build
pnpm test:e2e
```

La prueba PWA/offline usa un build de producción con `VITE_DEMO_MODE=true`. En iPhone, la cola se sincroniza al abrir la app, al volver a primer plano o al recuperar conexión; Safari no proporciona Background Sync fiable para hacerlo con la app cerrada.
