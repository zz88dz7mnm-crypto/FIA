-- FIA · esquema de la base de datos
-- Pegar completo en Supabase → SQL Editor → Run.
-- Se puede correr más de una vez sin romper nada.

-- ───────────────────────── Perfil ─────────────────────────
create table if not exists public.perfiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nombre text,
  zona_horaria text not null default 'America/Argentina/Buenos_Aires',
  moneda text not null default 'ARS',
  creado_en timestamptz not null default now()
);

-- ─────────────────────── Categorías ───────────────────────
-- usuario_id nulo = categoría base, visible para todos y de solo lectura.
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  clase text not null default 'gasto' check (clase in ('gasto', 'ingreso')),
  padre_id uuid references public.categorias (id) on delete set null,
  palabras_clave text[] not null default '{}',
  creado_en timestamptz not null default now()
);

create unique index if not exists categorias_nombre_unico
  on public.categorias (coalesce(usuario_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));

-- Reglas personales: "cuando aparezca este texto, usá esta categoría".
create table if not exists public.reglas_categoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  patron text not null,
  categoria_id uuid not null references public.categorias (id) on delete cascade,
  creado_en timestamptz not null default now(),
  unique (usuario_id, patron)
);

-- ──────────────────────── Mensajes ────────────────────────
-- El chat con Fia. También es el origen de cada movimiento (texto o captura).
create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  autor text not null check (autor in ('usuario', 'fia')),
  canal text not null default 'chat',
  texto text not null default '',
  datos jsonb not null default '{}'::jsonb,
  archivo_ruta text,
  texto_extraido text,
  creado_en timestamptz not null default now()
);

create index if not exists mensajes_usuario_fecha on public.mensajes (usuario_id, creado_en);

-- ────────────────────── Transacciones ─────────────────────
create table if not exists public.transacciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('gasto', 'ingreso', 'transferencia_enviada', 'transferencia_recibida')),
  importe numeric(14, 2) not null check (importe > 0),
  moneda text not null default 'ARS',
  fecha date not null,
  descripcion text not null default '',
  categoria_id uuid references public.categorias (id) on delete set null,
  estado text not null default 'en_revision'
    check (estado in ('recibida', 'en_revision', 'confirmada', 'rechazada', 'anulada')),
  metodo text not null default 'texto' check (metodo in ('texto', 'imagen', 'manual')),
  contraparte text,
  referencia text,
  es_interna boolean not null default false,
  origen_mensaje_id uuid references public.mensajes (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists transacciones_usuario_fecha on public.transacciones (usuario_id, fecha desc);
create index if not exists transacciones_duplicados on public.transacciones (usuario_id, fecha, importe);

-- ───────────────────────── Frascos ────────────────────────
-- Plata apartada para algo. Lo que queda = lo que se le puso − los gastos anotados en ese frasco.
create table if not exists public.frascos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  creado_en timestamptz not null default now()
);

create unique index if not exists frascos_nombre_unico on public.frascos (usuario_id, lower(nombre));

create table if not exists public.aportes_frasco (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  frasco_id uuid not null references public.frascos (id) on delete cascade,
  importe numeric(14, 2) not null check (importe <> 0),
  creado_en timestamptz not null default now()
);

alter table public.transacciones
  add column if not exists frasco_id uuid references public.frascos (id) on delete set null;

create index if not exists transacciones_frasco on public.transacciones (frasco_id) where frasco_id is not null;

-- ─────────────────── Presupuestos y metas ─────────────────
create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id) on delete cascade,
  periodo text not null default 'mensual' check (periodo in ('semanal', 'mensual')),
  limite numeric(14, 2) not null check (limite > 0),
  creado_en timestamptz not null default now(),
  unique (usuario_id, categoria_id, periodo)
);

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  monto_objetivo numeric(14, 2) not null check (monto_objetivo > 0),
  fecha_objetivo date,
  creado_en timestamptz not null default now()
);

create table if not exists public.aportes_meta (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meta_id uuid not null references public.metas (id) on delete cascade,
  importe numeric(14, 2) not null check (importe <> 0),
  fecha date not null,
  creado_en timestamptz not null default now()
);

-- ──────────────────────── Auditoría ───────────────────────
-- La escribe la base sola; desde la app solo se puede leer.
create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  usuario_id uuid not null,
  entidad text not null,
  entidad_id uuid not null,
  accion text not null,
  cambios jsonb not null default '{}'::jsonb,
  fecha timestamptz not null default now()
);

create index if not exists auditoria_entidad on public.auditoria (entidad, entidad_id);

create or replace function public.fia_tocar_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create or replace function public.fia_auditar_transaccion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  diferencias jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.auditoria (usuario_id, entidad, entidad_id, accion, cambios)
    values (new.usuario_id, 'transaccion', new.id, 'alta', to_jsonb(new));
  else
    select coalesce(
      jsonb_object_agg(d.key, jsonb_build_object('antes', a.value, 'despues', d.value)),
      '{}'::jsonb
    )
    into diferencias
    from jsonb_each(to_jsonb(new)) as d
    join jsonb_each(to_jsonb(old)) as a on a.key = d.key
    where d.value is distinct from a.value
      and d.key <> 'actualizado_en';

    if diferencias <> '{}'::jsonb then
      insert into public.auditoria (usuario_id, entidad, entidad_id, accion, cambios)
      values (
        new.usuario_id, 'transaccion', new.id,
        case when new.estado is distinct from old.estado then new.estado else 'edicion' end,
        diferencias
      );
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists transacciones_tocar_actualizado on public.transacciones;
create trigger transacciones_tocar_actualizado
  before update on public.transacciones
  for each row execute function public.fia_tocar_actualizado();

drop trigger if exists transacciones_auditar on public.transacciones;
create trigger transacciones_auditar
  after insert or update on public.transacciones
  for each row execute function public.fia_auditar_transaccion();

-- ─────────────── Seguridad: cada uno ve lo suyo ───────────────
alter table public.perfiles enable row level security;
alter table public.categorias enable row level security;
alter table public.reglas_categoria enable row level security;
alter table public.mensajes enable row level security;
alter table public.transacciones enable row level security;
alter table public.presupuestos enable row level security;
alter table public.metas enable row level security;
alter table public.aportes_meta enable row level security;
alter table public.auditoria enable row level security;
alter table public.frascos enable row level security;
alter table public.aportes_frasco enable row level security;

drop policy if exists perfiles_propio on public.perfiles;
create policy perfiles_propio on public.perfiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists categorias_ver on public.categorias;
create policy categorias_ver on public.categorias for select to authenticated
  using (usuario_id is null or usuario_id = (select auth.uid()));

drop policy if exists categorias_crear on public.categorias;
create policy categorias_crear on public.categorias for insert to authenticated
  with check (usuario_id = (select auth.uid()));

drop policy if exists categorias_editar on public.categorias;
create policy categorias_editar on public.categorias for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists categorias_borrar on public.categorias;
create policy categorias_borrar on public.categorias for delete to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists reglas_propio on public.reglas_categoria;
create policy reglas_propio on public.reglas_categoria for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists mensajes_propio on public.mensajes;
create policy mensajes_propio on public.mensajes for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists transacciones_propio on public.transacciones;
create policy transacciones_propio on public.transacciones for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists presupuestos_propio on public.presupuestos;
create policy presupuestos_propio on public.presupuestos for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists metas_propio on public.metas;
create policy metas_propio on public.metas for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists aportes_propio on public.aportes_meta;
create policy aportes_propio on public.aportes_meta for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists frascos_propio on public.frascos;
create policy frascos_propio on public.frascos for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists aportes_frasco_propio on public.aportes_frasco;
create policy aportes_frasco_propio on public.aportes_frasco for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists auditoria_ver on public.auditoria;
create policy auditoria_ver on public.auditoria for select to authenticated
  using (usuario_id = (select auth.uid()));

-- Permisos: sin sesión no se accede a nada. Los movimientos no se borran, se anulan.
revoke all on public.perfiles, public.categorias, public.reglas_categoria, public.mensajes,
  public.transacciones, public.presupuestos, public.metas, public.aportes_meta, public.auditoria,
  public.frascos, public.aportes_frasco
  from anon, authenticated;

grant select, insert, update on public.perfiles to authenticated;
grant select, insert, update, delete on public.categorias, public.reglas_categoria,
  public.presupuestos, public.metas, public.aportes_meta, public.frascos, public.aportes_frasco to authenticated;
grant select, insert on public.mensajes to authenticated;
grant select, insert, update on public.transacciones to authenticated;
grant select on public.auditoria to authenticated;

-- ─────────────────── Categorías de arranque ───────────────────
-- Palabras en minúsculas y sin acentos: así las compara Fia.
insert into public.categorias (usuario_id, nombre, clase, palabras_clave) values
  (null, 'Comida', 'gasto', array[
    'almuerzo', 'cena', 'desayuno', 'merienda', 'restaurante', 'resto', 'bar', 'cafe', 'cafeteria',
    'supermercado', 'super', 'mercado', 'chino', 'verduleria', 'carniceria', 'panaderia', 'almacen',
    'kiosco', 'delivery', 'pedidosya', 'pedidos ya', 'rappi', 'pizza', 'hamburguesa', 'helado',
    'empanada', 'asado', 'cerveza', 'birra', 'vino', 'facturas', 'medialunas', 'sushi', 'milanesa']),
  (null, 'Transporte', 'gasto', array[
    'taxi', 'uber', 'cabify', 'didi', 'remis', 'colectivo', 'bondi', 'subte', 'tren', 'sube',
    'nafta', 'combustible', 'estacionamiento', 'peaje', 'pasaje', 'transporte publico', 'gomeria',
    'lavadero', 'patente', 'seguro del auto']),
  (null, 'Vivienda', 'gasto', array[
    'alquiler', 'expensas', 'servicios', 'luz', 'gas', 'agua', 'internet', 'wifi', 'telefono',
    'celular', 'edesur', 'edenor', 'metrogas', 'aysa', 'abl', 'plomero', 'electricista', 'ferreteria']),
  (null, 'Entretenimiento', 'gasto', array[
    'cine', 'recital', 'streaming', 'netflix', 'spotify', 'disney', 'hbo', 'youtube', 'teatro',
    'boliche', 'entrada', 'juego', 'steam', 'playstation', 'cancha', 'futbol']),
  (null, 'Salud', 'gasto', array[
    'farmacia', 'consulta', 'estudios', 'medico', 'doctor', 'dentista', 'odontologo', 'psicologo',
    'terapia', 'prepaga', 'obra social', 'remedio', 'medicamento', 'gimnasio', 'gym', 'optica']),
  (null, 'Compras', 'gasto', array[
    'ropa', 'zapatillas', 'zapatos', 'remera', 'pantalon', 'campera', 'regalo', 'mercadolibre',
    'mercado libre', 'shopping', 'perfume', 'peluqueria', 'barberia']),
  (null, 'Educación', 'gasto', array[
    'curso', 'facultad', 'universidad', 'colegio', 'cuota', 'libro', 'apuntes', 'fotocopias', 'clase']),
  (null, 'Ingresos', 'ingreso', array[
    'sueldo', 'salario', 'trabajo', 'aguinaldo', 'honorarios', 'freelance', 'devolucion',
    'reintegro', 'venta', 'cobro', 'bono', 'comision'])
on conflict do nothing;
