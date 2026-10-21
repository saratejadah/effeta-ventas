/** Descarga un CSV (con BOM para que Excel respete las tildes) */
export function descargarCSV(nombreArchivo: string, filas: (string | number | null | undefined)[][]) {
  const texto = filas
    .map((fila) =>
      fila
        .map((v) => {
          const s = v == null ? '' : String(v)
          return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(';'),
    )
    .join('\r\n')
  const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}
