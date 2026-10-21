// Edge Function: crear-cajero
// Crea un usuario cajero. Solo la puede usar un admin con sesión iniciada.
// Body: { nombre, email, password }
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // 1. ¿Quién llama? Validamos su sesión con el token que manda la app
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return responder({ error: 'Debes iniciar sesión' }, 401)
  const { data: quien, error: errUsuario } = await admin.auth.getUser(token)
  if (errUsuario || !quien.user) return responder({ error: 'Tu sesión no es válida. Vuelve a entrar.' }, 401)

  // 2. ¿Es admin activo?
  const { data: perfil } = await admin.from('perfiles').select('rol, activo').eq('id', quien.user.id).maybeSingle()
  if (!perfil || perfil.rol !== 'admin' || !perfil.activo) {
    return responder({ error: 'Solo un admin puede crear cajeros' }, 403)
  }

  // 3. Validar datos
  let body: { nombre?: string; email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return responder({ error: 'Datos inválidos' }, 400)
  }
  const nombre = (body.nombre ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  if (!nombre) return responder({ error: 'El nombre es obligatorio' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return responder({ error: 'El correo no es válido' }, 400)
  if (password.length < 6) return responder({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400)

  // 4. Crear el usuario. El trigger handle_new_user crea su perfil con rol 'cajero'
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, rol: 'cajero' },
  })
  if (error) {
    const yaExiste = /already|registered|exists/i.test(error.message)
    return responder({ error: yaExiste ? 'Ya existe una cuenta con ese correo' : error.message }, yaExiste ? 409 : 400)
  }

  return responder({ id: data.user?.id, nombre, email })
})
