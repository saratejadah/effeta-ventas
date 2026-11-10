/**
 * Los cajeros pueden entrar con un usuario simple (ej. "caja1") en vez de un correo.
 * Supabase igual necesita un correo, así que por dentro se guarda como "caja1@<DOMINIO>".
 * Ese correo no existe y nunca recibe nada (example.com está reservado para esto).
 *
 * OJO: este dominio debe ser el mismo que en supabase/functions/crear-cajero/index.ts
 */
export const DOMINIO_USUARIOS = 'cajeros.effeta.example.com'

/** Solo minúsculas, números, punto, guion y guion bajo; de 3 a 30 caracteres */
export const PATRON_USUARIO = /^[a-z0-9._-]{3,30}$/

/** Lo que escribe la persona al entrar -> el correo con el que está registrada */
export function correoParaEntrar(texto: string): string {
  const t = texto.trim().toLowerCase()
  return t.includes('@') ? t : `${t}@${DOMINIO_USUARIOS}`
}

/** El correo registrado -> lo que se le muestra al admin ("caja1" o el correo real) */
export function usuarioVisible(email: string): string {
  const sufijo = `@${DOMINIO_USUARIOS}`
  return email.endsWith(sufijo) ? email.slice(0, -sufijo.length) : email
}
