import { useEffect, useState } from 'react'
import { hora } from './format'

/** Minutos de espera después de la hora elegida; pasado ese tiempo el pedido se pierde */
export const MINUTOS_GRACIA = 10

/** La hora actual, que se actualiza sola (por defecto cada 30 segundos) */
export function useAhora(cadaMs = 30000): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), cadaMs)
    return () => clearInterval(t)
  }, [cadaMs])
  return ahora
}

/** Horarios de recogida (hora, minutos), en la hora local */
export const HORARIOS: [number, number][] = [
  [9, 0],
  [10, 30],
  [12, 0],
  [13, 30],
  [17, 30],
  [19, 0],
  [20, 30],
]

/** Horarios que todavía se pueden elegir: los de hoy que no han pasado (si ya pasaron todos, los de mañana) */
export function horariosRecogida(ahora: number): Date[] {
  const delDia = (dias: number) =>
    HORARIOS.map(([h, m]) => {
      const d = new Date(ahora)
      d.setDate(d.getDate() + dias)
      d.setHours(h, m, 0, 0)
      return d
    })
  const hoy = delDia(0).filter((d) => d.getTime() > ahora)
  if (hoy.length > 0) return hoy
  // El servidor acepta hasta 24 horas adelante
  return delDia(1).filter((d) => d.getTime() - ahora < 24 * 60 * 60000)
}

/** "3:30 p. m." o "mañana 8:00 a. m." */
export function textoHora(fecha: Date | string, ahora: number = Date.now()): string {
  const f = typeof fecha === 'string' ? new Date(fecha) : fecha
  const otroDia = f.toDateString() !== new Date(ahora).toDateString()
  return (otroDia ? 'mañana ' : '') + hora(f.toISOString())
}

/** Hasta cuándo se espera el pedido */
export function limiteRecogida(horaRecogida: string): Date {
  return new Date(new Date(horaRecogida).getTime() + MINUTOS_GRACIA * 60000)
}

export type EstadoRecogida = 'luego' | 'pronto' | 'ahora' | 'vencido'

/**
 * luego: falta más de 15 min · pronto: faltan 15 min o menos ·
 * ahora: ya es la hora (dentro de los 10 min de espera) · vencido: pasaron los 10 min
 */
export function estadoRecogida(horaRecogida: string, ahora: number): EstadoRecogida {
  const h = new Date(horaRecogida).getTime()
  if (ahora > h + MINUTOS_GRACIA * 60000) return 'vencido'
  if (ahora >= h) return 'ahora'
  if (h - ahora <= 15 * 60000) return 'pronto'
  return 'luego'
}
