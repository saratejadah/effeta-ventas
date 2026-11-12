-- =========================================================
-- Hora de recogida para los pedidos del link
-- Pegar completo en: Supabase > SQL Editor > New query > Run
-- (Se puede correr más de una vez sin problema)
--
-- · pedidos.hora_recogida: a qué hora dijo la persona que recoge su pedido.
-- · Si no lo recoge en los 10 minutos siguientes, el pedido "vence": la caja
--   puede cancelarlo (si no se ha pagado) y las unidades vuelven al stock.
-- =========================================================

-- 1. Nueva columna
alter table public.pedidos add column if not exists hora_recogida timestamptz;

-- 2. crear_pedido recibe la hora de recogida (opcional, para no romper versiones viejas de la app)
--    Se borra la versión anterior para que no haya dos funciones con el mismo nombre.
drop function if exists public.crear_pedido(text, text, jsonb, text, boolean);

create or replace function public.crear_pedido(
  p_nombre text,
  p_telefono text,
  p_items jsonb,
  p_metodo_pago text default null,
  p_pagado boolean default false,
  p_hora_recogida timestamptz default null
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

  -- Hora de recogida (solo pedidos del link): no en el pasado ni más de un día adelante
  if v_canal = 'presencial' then
    p_hora_recogida := null;
  elsif p_hora_recogida is not null
     and (p_hora_recogida < now() - interval '5 minutes' or p_hora_recogida > now() + interval '24 hours') then
    raise exception 'La hora de recogida no es válida. Elige otra.';
  end if;

  -- La jornada abierta (bloqueada para que dos pedidos no tomen el mismo número)
  select id into v_jornada from jornadas where abierta for update;
  if v_jornada is null then
    raise exception 'No hay una jornada abierta en este momento';
  end if;
  select coalesce(max(numero), 0) + 1 into v_numero from pedidos where jornada_id = v_jornada;

  insert into pedidos (jornada_id, numero, nombre_cliente, telefono, canal, cajero_id, estado, metodo_pago, hora_recogida)
  values (v_jornada, v_numero, trim(p_nombre), p_telefono, v_canal, v_cajero, v_estado, p_metodo_pago, p_hora_recogida)
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

grant execute on function public.crear_pedido(text, text, jsonb, text, boolean, timestamptz) to anon, authenticated;

-- 3. cancelar_pedido: además del admin, la caja puede cancelar un pedido del link
--    que venció (pasaron más de 10 minutos de la hora de recogida) y no se pagó.
create or replace function public.cancelar_pedido(p_pedido_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then
    if not (
      es_staff() and exists (
        select 1 from pedidos
         where id = p_pedido_id
           and canal = 'online'
           and estado = 'pendiente'
           and hora_recogida is not null
           and hora_recogida + interval '10 minutes' < now()
      )
    ) then
      raise exception 'Solo un admin puede cancelar este pedido';
    end if;
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
