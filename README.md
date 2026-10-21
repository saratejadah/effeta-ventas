# Jornadas de Ventas Effetá

App web para las jornadas de ventas del grupo Effetá. Ver `SPEC.md` para la descripción completa.

| Dirección | Para quién |
|---|---|
| `/pedido` | Compradores (link público, sin cuenta) |
| `/login` | Entrada del equipo |
| `/caja` | Cajeros (y admin) |
| `/admin` | Admin |

## Pasos pendientes en Supabase (una sola vez)

1. **Permisos de las fotos.** En Supabase > SQL Editor > New query, pega el contenido de `supabase/storage.sql` y dale *Run*. Sin esto el admin no puede subir fotos.
2. **Que nadie se registre solo.** Authentication > Sign In / Providers > Email: desactiva *Allow new users to sign up*.
3. **Función para crear cajeros.**
   - Edge Functions > *Deploy a new function* > *Via Editor*.
   - Nombre: `crear-cajero` (exactamente así).
   - Borra el código de ejemplo, pega el contenido de `supabase/functions/crear-cajero/index.ts` y dale *Deploy*.
   - En la pestaña *Details/Settings* de la función, **desactiva "Verify JWT"** y guarda. (La función revisa por su cuenta que quien la usa sea admin.)

## Publicar en Vercel

1. En vercel.com: *Add New > Project* e importa este repositorio de GitHub.
2. En *Environment Variables* agrega:
   - `VITE_SUPABASE_URL` = `https://xeiyscusvfxwobkteznx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = tu publishable key
3. *Deploy*. El link para compradores será `https://<tu-proyecto>.vercel.app/pedido`.

## Para desarrollo

```bash
npm install
cp .env.example .env
npm run dev
```
