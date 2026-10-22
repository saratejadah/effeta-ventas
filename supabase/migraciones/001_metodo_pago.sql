-- =========================================================
-- Método de pago + el pago ya no se asume
-- Pegar completo en: Supabase > SQL Editor > New query > Run
-- (Se puede correr más de una vez sin problema)
-- =========================================================

-- 1. Nueva columna: con qué se pagó (o con qué piensa pagar el cliente)
alter table public.pedidos
  add column if not exists metodo_pago text
  check (metodo_pago in ('efectivo', 'nequi', 'daviplata', 'transferencia'));

-- 2. crear_pedido ahora recibe el método de pago y si ya se pagó.
--    Comprador sin sesión -> siempre queda 'pendiente' (el pago lo confirma el equipo)
--    Cajero/admin         -> 'pagado' solo si p_pagado = true; si no, 'pendiente'
drop function if exists public.crear_pedido(text, text, jsonb);
drop function if exists public.crear_pedido(text, text, jsonb, text, boolean);

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
