-- =========================================================
-- Jornadas de Ventas Effetá — Esquema Supabase
-- Pegar completo en: Supabase > SQL Editor > New query > Run
-- =========================================================

-- ---------- TABLAS ----------

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null default 'cajero' check (rol in ('admin', 'cajero')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  precio numeric(12,2) not null check (precio >= 0),
  stock integer not null default 0 check (stock >= 0),
  imagen_url text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity (start with 1) unique,
  nombre_cliente text not null,
  telefono text,
  canal text not null check (canal in ('online', 'presencial')),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'pagado', 'entregado', 'cancelado')),
  cajero_id uuid references public.perfiles(id),
  metodo_pago text check (metodo_pago in ('efectivo', 'nequi', 'daviplata', 'transferencia')),
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null
);

create index on public.pedido_items (pedido_id);
create index on public.pedidos (created_at desc);

-- ---------- FUNCIONES DE ROL ----------

create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and activo and rol in ('admin', 'cajero')
  );
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and activo and rol = 'admin'
  );
$$;

-- Crea el perfil automáticamente cuando se crea un usuario en Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.email),
    coalesce(new.raw_user_meta_data->>'rol', 'cajero')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- CREAR PEDIDO (atómico: descuenta stock o falla todo) ----------
-- p_items: [{"producto_id": "uuid", "cantidad": 2}, ...]
-- p_metodo_pago: 'efectivo' | 'nequi' | 'daviplata' | 'transferencia'
-- Si lo llama un comprador sin sesión -> canal 'online', estado 'pendiente'
-- Si lo llama un cajero logueado      -> canal 'presencial', estado 'pagado' solo si p_pagado

create or replace function public.crear_pedido(
  p_nombre text,
  p_telefono text,
  p_items jsonb,
  p_metodo_pago text default null,
  p_pagado boolean default false
)
returns table (out_pedido_id uuid, out_numero bigint, out_total numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_pedido_id uuid;
  v_numero bigint;
  v_total numeric := 0;
  v_item jsonb;
  v_cant integer;
  v_prod record;
  v_canal text;
  v_cajero uuid;
  v_estado text;
begin
  if p_nombre is null or length(trim(p_nombre)) = 0 then
    raise exception 'El nombre es obligatorio';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;
  if p_metodo_pago is not null
     and p_metodo_pago not in ('efectivo', 'nequi', 'daviplata', 'transferencia') then
    raise exception 'Método de pago inválido';
  end if;

  if auth.uid() is not null and es_staff() then
    v_canal := 'presencial';
    v_cajero := auth.uid();
    v_estado := case when coalesce(p_pagado, false) then 'pagado' else 'pendiente' end;
  else
    v_canal := 'online';
    v_cajero := null;
    v_estado := 'pendiente';
  end if;

  if v_estado = 'pagado' and p_metodo_pago is null then
    raise exception 'Indica con qué se pagó';
  end if;

  insert into pedidos (nombre_cliente, telefono, canal, cajero_id, estado, metodo_pago)
  values (trim(p_nombre), p_telefono, v_canal, v_cajero, v_estado, p_metodo_pago)
  returning id, numero into v_pedido_id, v_numero;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_item->>'cantidad')::int;
    if v_cant is null or v_cant <= 0 or v_cant > 50 then
      raise exception 'Cantidad inválida';
    end if;

    -- Descuento atómico: solo si hay stock suficiente
    update productos
       set stock = stock - v_cant
     where id = (v_item->>'producto_id')::uuid
       and activo
       and stock >= v_cant
    returning id, nombre, precio into v_prod;

    if not found then
      raise exception 'No hay stock suficiente de uno de los productos';
    end if;

    insert into pedido_items (pedido_id, producto_id, cantidad, precio_unitario)
    values (v_pedido_id, v_prod.id, v_cant, v_prod.precio);

    v_total := v_total + v_prod.precio * v_cant;
  end loop;

  update pedidos set total = v_total where id = v_pedido_id;

  return query select v_pedido_id, v_numero, v_total;
end;
$$;

grant execute on function public.crear_pedido(text, text, jsonb, text, boolean) to anon, authenticated;

-- ---------- CANCELAR PEDIDO (devuelve el stock) ----------

create or replace function public.cancelar_pedido(p_pedido_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'Solo un admin puede cancelar pedidos';
  end if;

  if exists (select 1 from pedidos where id = p_pedido_id and estado = 'cancelado') then
    return;
  end if;

  update productos p
     set stock = p.stock + i.cantidad
    from pedido_items i
   where i.pedido_id = p_pedido_id and i.producto_id = p.id;

  update pedidos set estado = 'cancelado' where id = p_pedido_id;
end;
$$;

revoke execute on function public.cancelar_pedido(uuid) from anon;

-- ---------- SEGURIDAD (RLS) ----------

alter table public.perfiles     enable row level security;
alter table public.productos    enable row level security;
alter table public.pedidos      enable row level security;
alter table public.pedido_items enable row level security;

-- Perfiles: cada uno ve el suyo; el admin ve y edita todos
create policy "perfil propio o admin" on public.perfiles
  for select using (id = auth.uid() or es_admin());
create policy "admin edita perfiles" on public.perfiles
  for update using (es_admin());

-- Productos: el público ve los activos; solo admin crea/edita/borra
create policy "ver productos" on public.productos
  for select using (activo or es_staff());
create policy "admin gestiona productos" on public.productos
  for all using (es_admin()) with check (es_admin());

-- Pedidos: solo el equipo los ve; se crean SOLO vía crear_pedido()
create policy "staff ve pedidos" on public.pedidos
  for select using (es_staff());
create policy "staff cambia estado" on public.pedidos
  for update using (es_staff()) with check (es_staff());

create policy "staff ve items" on public.pedido_items
  for select using (es_staff());

-- ---------- TIEMPO REAL (pedidos nuevos aparecen sin recargar) ----------

alter publication supabase_realtime add table public.pedidos;
alter publication supabase_realtime add table public.productos;
