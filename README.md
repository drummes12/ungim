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
VITE_SUPABASE_ANON_KEY=local-publishable-key
VITE_DEMO_MODE=false
```

Las dos cuentas se configuran desde la app. La zona horaria del hogar se fija con el primer plan guardado y la competencia empieza cuando ambos perfiles tienen plan.

## Producción

1. Crear un proyecto Supabase.
2. Aplicar `supabase/migrations/20261003150000_initial_schema.sql`.
3. Desactivar registro público y crear exactamente dos usuarios con correo/contraseña. El trigger `handle_new_user` rechaza perfiles adicionales.
4. Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Cloudflare Pages.
5. Publicar `dist/` con el comando `pnpm build`.

Supabase Free puede pausar un proyecto con poca actividad; los registros locales seguirán funcionando, pero no sincronizarán hasta reanudarlo.

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
