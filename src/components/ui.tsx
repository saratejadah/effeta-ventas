import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Check, Copy, LogOut, Minus, Plus, type LucideIcon } from 'lucide-react'
import type { Estado, MetodoPago } from '../lib/types'
import { METODOS_PAGO, NUMERO_TRANSFERENCIA } from '../lib/pago'

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

/* ---------- Header ---------- */

export function Header({ nombre, onSalir }: { nombre?: string; onSalir?: () => void }) {
  return (
    <header className="sticky top-0 z-30 bg-primary text-white">
      <div className="mx-auto flex h-14 max-w-[600px] items-center justify-between px-4">
        <span className="font-serif text-lg font-semibold tracking-[0.3em]">EFFETÁ</span>
        {onSalir && (
          <div className="flex items-center gap-3">
            {nombre && <span className="max-w-[140px] truncate text-sm text-white/70">{nombre}</span>}
            <button
              onClick={onSalir}
              className="rounded-full bg-primary-light px-4 py-1.5 text-sm font-medium text-white active:opacity-80"
            >
              Salir
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

/* ---------- Hero ---------- */

export function Hero({ etiqueta, titulo, subtitulo }: { etiqueta: string; titulo: string; subtitulo?: string }) {
  return (
    <section className="relative overflow-hidden bg-primary text-white">
      <div className="pointer-events-none absolute -right-16 -top-10 h-56 w-56 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -right-4 top-24 h-24 w-24 rounded-full bg-white/5" />
      <div className="relative mx-auto max-w-[600px] px-4 pb-16 pt-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{etiqueta}</p>
        <h1 className="mt-2 font-serif text-[32px] font-bold leading-tight">{titulo}</h1>
        {subtitulo && <p className="mt-2 max-w-[420px] text-[15px] text-white/80">{subtitulo}</p>}
      </div>
    </section>
  )
}

/* ---------- Layout ---------- */

export function Contenido({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx('relative mx-auto w-full max-w-[600px] px-4', className)}>{children}</main>
}

export function TituloPagina({ children }: { children: ReactNode }) {
  return <h1 className="font-serif text-[28px] font-bold leading-tight text-primary">{children}</h1>
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('section-label', className)}>{children}</p>
}

/* ---------- Tarjetas ---------- */

export function Card({
  children,
  className,
  destacada,
  sinPadding,
}: {
  children: ReactNode
  className?: string
  destacada?: boolean
  sinPadding?: boolean
}) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-line bg-white',
        !sinPadding && 'p-5',
        destacada && 'border-l-[5px] border-l-primary',
        className,
      )}
    >
      {children}
    </div>
  )
}

const statColor = { verde: 'text-ok', oscuro: 'text-ink', naranja: 'text-accent' }

export function StatCard({ valor, etiqueta, color }: { valor: ReactNode; etiqueta: string; color: keyof typeof statColor }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-2 py-4 text-center">
      <p className={cx('truncate text-xl font-bold leading-tight sm:text-2xl', statColor[color])}>{valor}</p>
      <p className="mt-1 text-[11px] leading-tight text-muted">{etiqueta}</p>
    </div>
  )
}

const iconColor = {
  verde: 'bg-[#EAF6EC] text-[#3F9A4F]',
  naranja: 'bg-[#FBEEDF] text-[#C97A2B]',
  indigo: 'bg-[#E8EAFB] text-[#0F1787]',
  morado: 'bg-[#F1E8FB] text-[#7A3FB0]',
  amarillo: 'bg-[#FDF3D7] text-[#9A5B00]',
}

export function IconBox({ icon: Icon, color = 'indigo' }: { icon: LucideIcon; color?: keyof typeof iconColor }) {
  return (
    <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconColor[color])}>
      <Icon size={20} strokeWidth={1.8} />
    </div>
  )
}

/* ---------- Pills ---------- */

const pillColor = {
  verde: 'bg-ok-bg text-ok',
  ambar: 'bg-warn-bg text-warn',
  gris: 'bg-[#EEF0F4] text-muted',
  indigo: 'bg-[#E8EAFB] text-primary',
}

export function Pill({ children, color }: { children: ReactNode; color: keyof typeof pillColor }) {
  return (
    <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', pillColor[color])}>
      {children}
    </span>
  )
}

const estadoInfo: Record<Estado, { texto: string; color: keyof typeof pillColor }> = {
  pendiente: { texto: 'Pendiente', color: 'ambar' },
  pagado: { texto: 'Pagado', color: 'verde' },
  entregado: { texto: 'Entregado', color: 'indigo' },
  cancelado: { texto: 'Cancelado', color: 'gris' },
}

export function EstadoPill({ estado }: { estado: Estado }) {
  const e = estadoInfo[estado]
  return <Pill color={e.color}>{e.texto}</Pill>
}

export function StockPill({ stock }: { stock: number }) {
  if (stock <= 0) return <Pill color="gris">Agotado</Pill>
  if (stock <= 3) return <Pill color="ambar">{stock === 1 ? 'Última 1' : `Últimas ${stock}`}</Pill>
  return <Pill color="verde">Quedan {stock}</Pill>
}

/* ---------- Botones ---------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: LucideIcon }

export function BotonPrincipal({ className, children, icon: Icon, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cx(
        'flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-[15px] font-semibold text-white transition active:opacity-85 disabled:opacity-40',
        className,
      )}
    >
      {Icon && <Icon size={18} strokeWidth={2} />}
      {children}
    </button>
  )
}

export function BotonSecundario({ className, children, icon: Icon, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={cx(
        'flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium transition active:bg-page disabled:opacity-40',
        // Gris por defecto, salvo que se pida otro color
        !/(^|\s)text-(warn|danger|ok|primary|ink)/.test(className ?? '') && 'text-muted',
        className,
      )}
    >
      {Icon && <Icon size={17} strokeWidth={1.8} />}
      {children}
    </button>
  )
}

export function BotonCerrarSesion({ onClick }: { onClick: () => void }) {
  return (
    <BotonSecundario icon={LogOut} onClick={onClick} className="w-full">
      Cerrar sesión
    </BotonSecundario>
  )
}

/* ---------- Campos ---------- */

export function Campo({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-line bg-white px-3.5 py-3 text-[15px] text-ink outline-none placeholder:text-muted/70 focus:border-primary"
      />
    </label>
  )
}

/* ---------- Selector de cantidad ---------- */

export function Stepper({
  valor,
  max,
  onChange,
  disabled,
}: {
  valor: number
  max: number
  onChange: (n: number) => void
  disabled?: boolean
}) {
  const btn =
    'flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink transition active:bg-page disabled:opacity-30'
  return (
    <div className="flex items-center gap-2">
      <button className={btn} aria-label="Quitar uno" disabled={disabled || valor <= 0} onClick={() => onChange(valor - 1)}>
        <Minus size={16} />
      </button>
      <span className="w-6 text-center text-[15px] font-semibold tabular-nums">{valor}</span>
      <button className={btn} aria-label="Agregar uno" disabled={disabled || valor >= max} onClick={() => onChange(valor + 1)}>
        <Plus size={16} />
      </button>
    </div>
  )
}

/* ---------- Avisos ---------- */

export function Aviso({ tipo, children }: { tipo: 'error' | 'ok'; children: ReactNode }) {
  return (
    <div
      className={cx(
        'rounded-xl px-4 py-3 text-sm font-medium',
        tipo === 'error' ? 'bg-warn-bg text-warn' : 'bg-ok-bg text-ok',
      )}
    >
      {children}
    </div>
  )
}

export function Cargando() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-primary" />
    </div>
  )
}

/* ---------- Navegación inferior ---------- */

export interface Tab<T extends string> {
  id: T
  texto: string
  icon: LucideIcon
}

export function BottomNav<T extends string>({
  tabs,
  activo,
  onChange,
}: {
  tabs: Tab<T>[]
  activo: T
  onChange: (t: T) => void
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-[600px]">
        {tabs.map((t) => {
          const on = t.id === activo
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={cx('relative flex flex-1 flex-col items-center gap-1 py-2.5', on ? 'text-primary' : 'text-muted')}
            >
              <t.icon size={22} strokeWidth={on ? 2 : 1.7} />
              <span className={cx('text-[11px]', on ? 'font-semibold' : 'font-medium')}>{t.texto}</span>
              {on && <span className="absolute bottom-1 h-[3px] w-6 rounded-full bg-primary" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ---------- Método de pago ---------- */

export function SelectorMetodoPago({
  valor,
  onChange,
}: {
  valor: MetodoPago | null
  onChange: (m: MetodoPago) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {METODOS_PAGO.map((m) => {
        const on = valor === m.id
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={cx(
              'flex items-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold transition',
              on ? 'border-primary bg-[#E8EAFB] text-primary ring-1 ring-primary' : 'border-line bg-white text-ink',
            )}
          >
            <m.icon size={18} strokeWidth={1.8} className={on ? 'text-primary' : 'text-muted'} />
            {m.texto}
          </button>
        )
      })}
    </div>
  )
}

/** Número para transferir, con botón para copiarlo */
export function DatosTransferencia() {
  const [copiado, setCopiado] = useState(false)
  const n = NUMERO_TRANSFERENCIA
  async function copiar() {
    try {
      await navigator.clipboard.writeText(n)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* el navegador no dejó copiar; el número sigue visible */
    }
  }
  return (
    <div className="rounded-xl bg-[#E8EAFB] px-4 py-3">
      <p className="text-xs font-medium text-primary/80">Transfiere por Nequi, Daviplata o llave al número</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-xl font-bold tracking-wide text-primary tabular-nums">
          {n.slice(0, 3)} {n.slice(3, 6)} {n.slice(6)}
        </p>
        <button
          type="button"
          onClick={copiar}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary active:opacity-80"
        >
          {copiado ? <Check size={14} /> : <Copy size={14} />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
