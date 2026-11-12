-- =========================================================
-- Entregar un pedido aunque todavía no se haya pagado
-- Pegar completo en: Supabase > SQL Editor > New query > Run
-- (Se puede correr más de una vez sin problema)
--
-- pago_pendiente = true  ->  el pedido ya se entregó pero todavía debe el pago.
-- Solo tiene sentido con estado 'entregado'.
-- =========================================================

alter table public.pedidos add column if not exists pago_pendiente boolean not null default false;

alter table public.pedidos drop constraint if exists pedidos_pago_pendiente_check;
alter table public.pedidos
  add constraint pedidos_pago_pendiente_check check (not pago_pendiente or estado = 'entregado');
