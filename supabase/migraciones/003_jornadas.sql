-- =========================================================
-- Jornadas de venta
-- Pegar completo en: Supabase > SQL Editor > New query > Run
-- (Se puede correr más de una vez sin problema)
--
-- · Cada pedido pertenece a una jornada. Todo lo que ya existe queda en "Jornada 1".
-- · Solo puede haber una jornada abierta. La caja y el link de pedidos venden en ella;
--   si no hay ninguna abierta, quedan en pausa.
-- · Los números de pedido empiezan en #1 en cada jornada.
-- · Al cerrar una jornada, el stock de todos los productos vuelve a 0.
-- =========================================================

-- 1. Tabla de jornadas
create table if not exists public.jornadas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  abierta boolean not null default true,
  created_at timestamptz not null default now(),
  cerrada_at timestamptz
);

-- Nunca dos jornadas abiertas al mismo tiempo
create unique index if not exists jornadas_una_abierta on public.jornadas (abierta) where abierta;

alter table public.jornadas enable row level security;
drop policy if exists "ver jornadas" on public.jornadas;
create policy "ver jornadas" on public.jornadas for select using (true);
drop policy if exists "admin renombra jornadas" on public.jornadas;
create policy "admin renombra jornadas" on public.jornadas
  for update using (es_admin()) with check (es_admin());
-- Abrir y cerrar: solo con abrir_jornada() / cerrar_jornada()

-- 2. Cada pedido pertenece a una jornada; lo existente va a "Jornada 1"
alter table public.pedidos add column if not exists jornada_id uuid references public.jornadas(id) on delete restrict;

do $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.jornadas) then
    insert into public.jornadas (nombre, abierta, created_at)
    values ('Jornada 1', true, coalesce((select min(created_at) from public.pedidos), now()))
    returning id into v_id;
  else
    select id into v_id from public.jornadas order by created_at limit 1;
  end if;
  update public.pedidos set jornada_id = v_id where jornada_id is null;
end $$;

alter table public.pedidos alter column jornada_id set not null;
create index if not exists pedidos_jornada_idx on public.pedidos (jornada_id);

-- 3. El número de pedido ahora es por jornada (los de la Jornada 1 conservan el suyo)
alter table public.pedidos alter column numero drop identity if exists;
alter table public.pedidos drop constraint if exists pedidos_numero_key;
create unique index if not exists pedidos_jornada_numero on public.pedidos (jornada_id, numero);

-- 4. crear_pedido vende en la jornada abierta y numera desde #1
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
  v_jornada uuid;
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
     and p_metodo_pago not in ('efectivo', 'transferencia') then
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

  -- La jornada abierta (bloqueada para que dos pedidos no tomen el mismo número)
  select id into v_jornada from jornadas where abierta for update;
  if v_jornada is null then
    raise exception 'No hay una jornada abierta en este momento';
  end if;
  select coalesce(max(numero), 0) + 1 into v_numero from pedidos where jornada_id = v_jornada;

  insert into pedidos (jornada_id, numero, nombre_cliente, telefono, canal, cajero_id, estado, metodo_pago)
  values (v_jornada, v_numero, trim(p_nombre), p_telefono, v_canal, v_cajero, v_estado, p_metodo_pago)
  returning id into v_pedido_id;

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

    insert into pedido_items (pedido_id, producto_id, nombre_producto, cantidad, precio_unitario)
    values (v_pedido_id, v_prod.id, v_prod.nombre, v_cant, v_prod.precio);

    v_total := v_total + v_prod.precio * v_cant;
  end loop;

  update pedidos set total = v_total where id = v_pedido_id;

  return query select v_pedido_id, v_numero, v_total;
end;
$$;

grant execute on function public.crear_pedido(text, text, jsonb, text, boolean) to anon, authenticated;

-- 5. Cancelar / eliminar: solo devuelven unidades si el pedido es de la jornada abierta
--    (al cerrar una jornada el stock vuelve a 0, así que no tiene sentido devolverlas)
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
    join pedidos pe on pe.id = i.pedido_id
    join jornadas j on j.id = pe.jornada_id
   where i.pedido_id = p_pedido_id and i.producto_id = p.id and j.abierta;

  update pedidos set estado = 'cancelado' where id = p_pedido_id;
end;
$$;

revoke execute on function public.cancelar_pedido(uuid) from anon;

create or replace function public.eliminar_pedido(p_pedido_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'Solo un admin puede eliminar pedidos';
  end if;

  if exists (select 1 from pedidos where id = p_pedido_id and estado <> 'cancelado') then
    update productos p
       set stock = p.stock + i.cantidad
      from pedido_items i
      join pedidos pe on pe.id = i.pedido_id
      join jornadas j on j.id = pe.jornada_id
     where i.pedido_id = p_pedido_id and i.producto_id = p.id and j.abierta;
  end if;

  delete from pedidos where id = p_pedido_id;  -- sus líneas se borran solas
end;
$$;

revoke execute on function public.eliminar_pedido(uuid) from anon, public;
grant execute on function public.eliminar_pedido(uuid) to authenticated;

-- 6. Cerrar la jornada abierta: el stock de todos los productos vuelve a 0
create or replace function public.cerrar_jornada()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'Solo un admin puede cerrar la jornada';
  end if;

  update jornadas set abierta = false, cerrada_at = now() where abierta;
  if not found then
    raise exception 'No hay una jornada abierta';
  end if;

  update productos set stock = 0 where stock <> 0;
end;
$$;

revoke execute on function public.cerrar_jornada() from anon, public;
grant execute on function public.cerrar_jornada() to authenticated;

-- 7. Abrir una jornada nueva
create or replace function public.abrir_jornada(p_nombre text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not es_admin() then
    raise exception 'Solo un admin puede abrir una jornada';
  end if;
  if p_nombre is null or length(trim(p_nombre)) = 0 then
    raise exception 'La jornada necesita un nombre';
  end if;
  if exists (select 1 from jornadas where abierta) then
    raise exception 'Ya hay una jornada abierta. Ciérrala antes de abrir otra.';
  end if;

  insert into jornadas (nombre) values (trim(p_nombre)) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.abrir_jornada(text) from anon, public;
grant execute on function public.abrir_jornada(text) to authenticated;

-- 8. Tiempo real: la caja y el link se enteran al instante si se abre o cierra una jornada
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jornadas'
  ) then
    alter publication supabase_realtime add table public.jornadas;
  end if;
end $$;
