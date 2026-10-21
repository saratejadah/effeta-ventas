# Jornadas de Ventas Effetá — Especificación

App web para gestionar las jornadas de ventas del grupo Effetá: inventario, cajeros, pedidos online por link y ventas presenciales.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Realtime, Edge Functions)
- **Deploy:** Vercel
- **Idioma de la interfaz:** español (Colombia), precios en COP sin decimales (ej. $12.000)
- **Mobile first:** los cajeros usan el celular durante la jornada

## Diseño

Debe verse como parte del mismo producto que la app de servidores de Effetá Mazuren (https://effeta-mazuren-app.vercel.app/servidor). Replicar su estilo exactamente. Si se tiene acceso al repositorio de esa app, copiar de ahí los valores reales (colores, fuentes, componentes); los de abajo son aproximados a partir de capturas, excepto el azul principal.

### Colores
| Uso | Color |
|---|---|
| Principal (header, botones, tab activo, títulos destacados) | `#0F1787` (exacto) |
| Fondo de la página | gris azulado muy claro, aprox. `#F5F6FA` |
| Tarjetas | blanco `#FFFFFF`, borde gris muy suave aprox. `#E8EAF0` |
| Texto principal | casi negro aprox. `#1A1D29` |
| Texto secundario / fechas / ayudas | gris aprox. `#8A8FA3` |
| Botón secundario en el header ("Salir") | azul principal un poco más claro, aprox. `#2A33A0` |
| Acento naranja (barras de progreso, números destacados) | aprox. `#C97A2B` |
| Verde (éxito) | texto aprox. `#3F9A4F` sobre fondo aprox. `#EAF6EC` |
| Ámbar (advertencia) | texto aprox. `#9A5B00` sobre fondo aprox. `#FDF3D7` |

### Tipografía
- **Logo "EFFETÁ"** en el header: serif, mayúsculas, blanco, con mucho espacio entre letras.
- **Títulos de página** (ej. "Mi Retiro"): serif en negrita, color principal.
- **Todo lo demás**: sans-serif limpia (tipo Inter / fuente del sistema). Títulos de tarjeta en semibold.
- **Etiquetas de sección** (ej. "ACCESOS RÁPIDOS", "INFORMACIÓN DEL RETIRO"): mayúsculas, pequeñas, gris, con espacio entre letras.

### Componentes
- **Header:** barra azul principal a todo el ancho; logo a la izquierda; a la derecha el nombre del usuario en gris claro y un botón "Salir" tipo píldora.
- **Hero** (pantalla de inicio): bloque azul principal debajo del header con etiqueta pequeña en mayúsculas, saludo grande en blanco, subtítulo y un círculo decorativo semitransparente. La primera tarjeta se monta encima del borde inferior del hero.
- **Contenido:** columna centrada, ancho máximo aprox. 600px.
- **Tarjetas:** blancas, esquinas redondeadas (aprox. 16px), borde suave, sin sombra fuerte, padding generoso. Variante destacada con borde izquierdo grueso en el azul principal.
- **Tarjetas de estadística:** 3 en fila con número grande de color (verde, oscuro, naranja) y etiqueta pequeña gris debajo.
- **Íconos:** de línea (estilo Lucide), dentro de un cuadrado redondeado con fondo de color pastel (verde, naranja, índigo, morado, amarillo).
- **Etiquetas de estado (pills):** pequeñas, redondeadas, texto semibold. Verde = listo, ámbar = atención, gris = sin acción.
- **Botón principal:** ancho completo, azul principal, texto blanco semibold, esquinas aprox. 8px.
- **Botón secundario:** blanco con borde suave y texto gris, con ícono (como "Cerrar sesión").
- **Campos de texto:** blancos, borde gris suave, esquinas aprox. 8px, etiqueta gris encima.
- **Barra de navegación inferior:** blanca, fija abajo, íconos de línea con texto pequeño; el activo va en azul principal con una rayita debajo.
- **Tono de los textos:** cercano y cálido, en segunda persona ("Hola, Sara", "Sigue adelante", "Cuéntanos tu idea").

### Cómo aplicarlo en esta app
- **`/pedido` (compradores):** hero azul con "EFFETÁ MAZUREN", título "Jornada de ventas" y una frase cálida. Productos como tarjetas con foto, precio y pill de stock ("Quedan 5" en verde, "Últimas 2" en ámbar, "Agotado" en gris). Botón principal fijo abajo con el total.
- **Confirmación del pedido:** tarjeta destacada (borde izquierdo azul) con el número de pedido muy grande.
- **`/caja`:** navegación inferior con "Vender" y "Pedidos".
- **`/admin`:** navegación inferior con "Resumen", "Productos", "Pedidos" y "Cajeros". El resumen usa las tarjetas de estadística (total vendido, pedidos, productos agotados).
- **Estados de pedido como pills:** Pendiente = ámbar, Pagado = verde, Entregado = índigo, Cancelado = gris.

## Roles

| Rol | Acceso |
|---|---|
| Comprador (sin login) | Solo `/pedido` |
| Cajero | `/caja` y lista de pedidos para marcarlos como pagados o entregados |
| Admin | Todo: productos, cajeros, pedidos, resumen |

## Base de datos

Ya definida en `schema.sql` (correrlo en el SQL Editor de Supabase antes de empezar).

Reglas clave que la app debe respetar:
- **Nunca** insertar pedidos directo en las tablas. Siempre usar `supabase.rpc('crear_pedido', { p_nombre, p_telefono, p_items })`. Esa función descuenta el stock de forma atómica y falla si no hay suficiente.
- Cancelar con `supabase.rpc('cancelar_pedido', { p_pedido_id })`, que devuelve el stock.
- El número de pedido es `pedidos.numero`; mostrarlo como `#0001`.

## Pantallas

### 1. `/pedido` — Link público para compradores
- Lista de productos activos con nombre, precio, foto opcional y "Quedan X".
- Selector de cantidad (+/−) por producto, limitado al stock disponible. Los agotados aparecen deshabilitados como "Agotado".
- Resumen con total, campos **Nombre** (obligatorio) y **Teléfono** (opcional), y botón "Hacer pedido".
- Confirmación grande: "¡Listo, [nombre]! Tu pedido es el **#0012**", con el detalle y el total. Instrucción: "Muestra este número al recoger y pagar".
- Si `crear_pedido` falla por stock: mostrar el error, recargar el stock y pedir que ajuste la cantidad.
- Stock en tiempo real (suscripción a `productos`).

### 2. `/login`
- Email + contraseña (Supabase Auth). Redirige a `/admin` o `/caja` según el rol.

### 3. `/caja` — Punto de venta del cajero
- Cuadrícula de productos con botones grandes; tocar un producto suma 1.
- Carrito con +/−, total y campo de nombre del cliente (se llena con "Venta en caja" si se deja vacío).
- Botón "Registrar venta" que llama a `crear_pedido`. Queda como presencial y pagado.
- Pestaña **Pedidos online**: los pendientes en tiempo real, con buscador por número o nombre y botones "Marcar pagado" y "Entregado".

### 4. `/admin`
- **Productos:** crear, editar, activar o desactivar. Ajustar stock (sumar unidades) y subir foto a Supabase Storage.
- **Cajeros:** lista; crear cajero (nombre, email, contraseña temporal); desactivar.
  - Para crear usuarios hace falta la service role key, así que esto va en una **Edge Function** `crear-cajero` que verifica que quien llama es admin y usa `auth.admin.createUser` con `user_metadata: { nombre, rol: 'cajero' }`.
- **Pedidos:** tabla en tiempo real con número, cliente, canal, cajero, estado, total y hora. Filtros por estado y canal. Ver detalle; cancelar (admin).
- **Resumen de la jornada:** total vendido, número de pedidos, ventas por cajero, unidades vendidas y restantes por producto. Exportar a CSV.

## Configuración de Supabase

1. Crear el proyecto en supabase.com.
2. Correr `schema.sql`.
3. Auth > Providers > Email: **desactivar "Allow new users to sign up"**. Así solo el admin crea cuentas.
4. Crear el primer admin manualmente: Auth > Users > Add user. Luego, en el SQL Editor:
   `update perfiles set rol = 'admin' where id = '<uuid del usuario>';`
5. Storage: crear un bucket público `productos` para las fotos.
6. Variables en `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Criterios de aceptación

- [ ] Un pedido online y una venta en caja descuentan el stock al instante, y el cambio se ve en todas las pantallas sin recargar.
- [ ] No se puede vender más unidades de las que hay, aunque dos personas compren al mismo tiempo.
- [ ] Un comprador sin login no puede ver pedidos de otros ni modificar productos.
- [ ] Un cajero no puede editar productos ni crear usuarios.
- [ ] Cancelar un pedido devuelve las unidades al inventario.
- [ ] Todo funciona bien en un celular.
