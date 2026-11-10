// Edge Function: crear-cajero
// Gestiona las cuentas de los cajeros. Solo la puede usar un admin con sesión iniciada.
//
// Body según la acción:
//   Crear (por defecto):   { nombre, usuario, password }   o   { nombre, email, password }
//   Cambiar contraseña:    { accion: 'cambiar-clave', id, password }
//   Ver usuarios/correos:  { accion: 'listar' }  -> { usuarios: { [id]: email } }
//
// Con "usuario" (ej. "caja1") el cajero entra sin correo: por dentro se guarda como
// caja1@DOMINIO_USUARIOS, un correo que no existe y nunca recibe nada.
import { createClient } from 'npm:@supabase/supabase-js@2'

// OJO: debe ser el mismo que en src/lib/usuarios.ts
const DOMINIO_USUARIOS = 'cajeros.effeta.example.com'
const PATRON_USUARIO = /^[a-z0-9._-]{3,30}$/

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
    return responder({ error: 'Solo un admin puede gestionar cajeros' }, 403)
  }

  let body: { accion?: string; id?: string; nombre?: string; usuario?: string; email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return responder({ error: 'Datos inválidos' }, 400)
  }

  // ---------- Ver con qué usuario/correo entra cada uno ----------
  if (body.accion === 'listar') {
    const usuarios: Record<string, string> = {}
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
      if (error) return responder({ error: error.message }, 400)
      for (const u of data.users) if (u.email) usuarios[u.id] = u.email
      if (data.users.length < 100) break
    }
    return responder({ usuarios })
  }

  const password = body.password ?? ''
  if (password.length < 6) return responder({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400)

  // ---------- Cambiar la contraseña de un cajero ----------
  if (body.accion === 'cambiar-clave') {
    const id = body.id ?? ''
    const { data: objetivo } = await admin.from('perfiles').select('rol').eq('id', id).maybeSingle()
    if (!objetivo) return responder({ error: 'No encontramos a ese cajero' }, 404)
    if (objetivo.rol !== 'cajero') return responder({ error: 'Solo se puede cambiar la contraseña de los cajeros' }, 403)
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) return responder({ error: error.message }, 400)
    return responder({ ok: true })
  }

  // ---------- Crear un cajero ----------
  const nombre = (body.nombre ?? '').trim()
  if (!nombre) return responder({ error: 'El nombre es obligatorio' }, 400)

  let email: string
  const usuario = (body.usuario ?? '').trim().toLowerCase()
  if (usuario) {
    if (!PATRON_USUARIO.test(usuario)) {
      return responder({ error: 'El usuario debe tener de 3 a 30 letras o números, sin espacios ni tildes (puede llevar . - _)' }, 400)
    }
    email = `${usuario}@${DOMINIO_USUARIOS}`
  } else {
    email = (body.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return responder({ error: 'El correo no es válido' }, 400)
  }

  // El trigger handle_new_user crea su perfil con rol 'cajero'
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, rol: 'cajero' },
  })
  if (error) {
    const yaExiste = /already|registered|exists/i.test(error.message)
    const msg = usuario ? 'Ya existe un cajero con ese usuario' : 'Ya existe una cuenta con ese correo'
    return responder({ error: yaExiste ? msg : error.message }, yaExiste ? 409 : 400)
  }

  return responder({ id: data.user?.id, nombre, email })
})
