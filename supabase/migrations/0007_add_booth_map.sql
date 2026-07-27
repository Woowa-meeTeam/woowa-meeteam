-- 0007: 오프라인 부스 지도 배치·게시 저장소
create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;

create table public.floor_maps (
  floor_number smallint primary key,
  map_asset_path text not null,
  map_viewbox_width integer not null check (map_viewbox_width > 0),
  map_viewbox_height integer not null check (map_viewbox_height > 0),
  rooms jsonb not null default '[]'::jsonb check (jsonb_typeof(rooms) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint floor_maps_supported_floor check (floor_number in (11, 12, 13))
);

create table public.floor_layout_drafts (
  floor_number smallint primary key references public.floor_maps(floor_number) on delete cascade,
  layout jsonb not null default '[]'::jsonb check (jsonb_typeof(layout) = 'array'),
  room_size_modes jsonb not null default '{}'::jsonb check (jsonb_typeof(room_size_modes) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.floor_layout_publications (
  floor_number smallint primary key references public.floor_maps(floor_number) on delete cascade,
  layout jsonb not null default '[]'::jsonb check (jsonb_typeof(layout) = 'array'),
  published_at timestamptz
);

alter table public.floor_maps enable row level security;
alter table public.floor_layout_drafts enable row level security;
alter table public.floor_layout_publications enable row level security;

create policy "floor maps are publicly readable"
on public.floor_maps
for select
to anon, authenticated
using (true);

create policy "booth admins can read drafts"
on public.floor_layout_drafts
for select
to authenticated
using ((select public.is_admin()));

create policy "published layouts are publicly readable"
on public.floor_layout_publications
for select
to anon, authenticated
using (true);

create or replace function private.touch_booth_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger floor_maps_touch_updated_at
before update on public.floor_maps
for each row execute function private.touch_booth_updated_at();

create trigger floor_layout_drafts_touch_updated_at
before update on public.floor_layout_drafts
for each row execute function private.touch_booth_updated_at();

create or replace function private.validate_booth_layouts(layouts jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(layouts) <> 'object' then
    raise check_violation using message = 'booth layouts must be a JSON object';
  end if;

  if (select count(*) from jsonb_object_keys(layouts)) <> 3
    or not (layouts ? '11' and layouts ? '12' and layouts ? '13')
    or exists (
      select 1
      from jsonb_each(layouts) as floor(floor_number, booths)
      where floor.floor_number not in ('11', '12', '13')
        or jsonb_typeof(floor.booths) <> 'array'
    )
  then
    raise check_violation using message = 'booth layouts must contain arrays for floors 11, 12, and 13';
  end if;

  if exists (
    select 1
    from jsonb_each(layouts) as floor(floor_number, booths)
    cross join lateral jsonb_array_elements(floor.booths) as entry(booth)
    where jsonb_typeof(entry.booth) <> 'object'
      or jsonb_typeof(entry.booth -> 'id') <> 'string'
      or jsonb_typeof(entry.booth -> 'floorId') <> 'number'
      or entry.booth ->> 'floorId' <> floor.floor_number
      or jsonb_typeof(entry.booth -> 'boothNumber') <> 'string'
      or jsonb_typeof(entry.booth -> 'projectId') <> 'string'
      or jsonb_typeof(entry.booth -> 'roomName') <> 'string'
      or jsonb_typeof(entry.booth -> 'x') <> 'number'
      or jsonb_typeof(entry.booth -> 'y') <> 'number'
      or jsonb_typeof(entry.booth -> 'width') <> 'number'
      or jsonb_typeof(entry.booth -> 'height') <> 'number'
  )
  then
    raise check_violation using message = 'booth layout entries have an invalid shape';
  end if;

  if exists (
    select 1
    from jsonb_each(layouts) as floor(floor_number, booths)
    cross join lateral jsonb_array_elements(floor.booths) as entry(booth)
    where not exists (
      select 1
      from public.projects
      where projects.id::text = entry.booth ->> 'projectId'
        and projects.status in ('RECRUITING', 'CLOSED', 'CONFIRMED')
    )
  )
  then
    raise foreign_key_violation using
      message = 'every booth must reference a public, booth-eligible project';
  end if;

  if (
    select count(*)
    from jsonb_each(layouts) as floor(floor_number, booths)
    cross join lateral jsonb_array_elements(floor.booths) as entry(booth)
  ) <> (
    select count(distinct entry.booth ->> 'projectId')
    from jsonb_each(layouts) as floor(floor_number, booths)
    cross join lateral jsonb_array_elements(floor.booths) as entry(booth)
  )
  then
    raise unique_violation using message = 'a project can only have one booth';
  end if;
end;
$$;

create or replace function private.save_booth_layout_draft(
  p_layouts jsonb,
  p_room_size_modes jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_at timestamptz := now();
begin
  if not (select public.is_admin()) then
    raise insufficient_privilege using message = 'meeTeam admin role is required';
  end if;

  perform private.validate_booth_layouts(p_layouts);

  if jsonb_typeof(p_room_size_modes) <> 'object' then
    raise check_violation using message = 'room size modes must be a JSON object';
  end if;

  if (select count(*) from jsonb_object_keys(p_room_size_modes)) <> 3
    or not (p_room_size_modes ? '11' and p_room_size_modes ? '12' and p_room_size_modes ? '13')
    or exists (
      select 1
      from jsonb_each(p_room_size_modes) as floor(floor_number, modes)
      where floor.floor_number not in ('11', '12', '13')
        or jsonb_typeof(floor.modes) <> 'object'
    )
    or exists (
      select 1
      from jsonb_each(p_room_size_modes) as floor(floor_number, modes)
      cross join lateral jsonb_each(floor.modes) as mode(room_key, enabled)
      where jsonb_typeof(mode.enabled) <> 'boolean'
    )
  then
    raise check_violation using message = 'room size modes must contain boolean maps for floors 11, 12, and 13';
  end if;

  update public.floor_layout_drafts
  set
    layout = p_layouts -> floor_number::text,
    room_size_modes = p_room_size_modes -> floor_number::text,
    updated_at = saved_at;

  return saved_at;
end;
$$;

create or replace function private.publish_booth_layouts()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  publication_time timestamptz := now();
begin
  if not (select public.is_admin()) then
    raise insufficient_privilege using message = 'meeTeam admin role is required';
  end if;

  perform private.validate_booth_layouts(
    (
      select jsonb_object_agg(floor_number::text, layout)
      from public.floor_layout_drafts
    )
  );

  insert into public.floor_layout_publications (floor_number, layout, published_at)
  select floor_number, layout, publication_time
  from public.floor_layout_drafts
  on conflict (floor_number) do update
  set
    layout = excluded.layout,
    published_at = excluded.published_at;

  return publication_time;
end;
$$;

create or replace function public.save_booth_layout_draft(
  p_layouts jsonb,
  p_room_size_modes jsonb
)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  select private.save_booth_layout_draft(p_layouts, p_room_size_modes);
$$;

create or replace function public.publish_booth_layouts()
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  select private.publish_booth_layouts();
$$;

revoke all on table public.floor_maps from anon, authenticated;
revoke all on table public.floor_layout_drafts from anon, authenticated;
revoke all on table public.floor_layout_publications from anon, authenticated;

grant select on table public.floor_maps to anon, authenticated;
grant select on table public.floor_layout_publications to anon, authenticated;
grant select on table public.floor_layout_drafts to authenticated;

revoke execute on function private.touch_booth_updated_at() from public, anon, authenticated;
revoke execute on function private.validate_booth_layouts(jsonb) from public, anon, authenticated;
revoke execute on function private.save_booth_layout_draft(jsonb, jsonb) from public, anon;
revoke execute on function private.publish_booth_layouts() from public, anon;
revoke execute on function public.save_booth_layout_draft(jsonb, jsonb) from public, anon;
revoke execute on function public.publish_booth_layouts() from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.save_booth_layout_draft(jsonb, jsonb) to authenticated;
grant execute on function private.publish_booth_layouts() to authenticated;
grant execute on function public.save_booth_layout_draft(jsonb, jsonb) to authenticated;
grant execute on function public.publish_booth_layouts() to authenticated;

insert into public.floor_maps (
  floor_number,
  map_asset_path,
  map_viewbox_width,
  map_viewbox_height,
  rooms
)
values
  (
    11,
    'src/features/booths/maps/floor-11.svg',
    1488,
    954,
    $json$[
      {"name":"큰 강의실","anchorX":72,"anchorY":184},
      {"name":"코워킹 존","anchorX":518,"anchorY":220},
      {"name":"옆 강의실","anchorX":72,"anchorY":730},
      {"name":"캔틴","anchorX":430,"anchorY":730},
      {"name":"코치룸","anchorX":850,"anchorY":730}
    ]$json$::jsonb
  ),
  (
    12,
    'src/features/booths/maps/floor-12.svg',
    1490,
    952,
    $json$[
      {"name":"라이브러리","anchorX":254,"anchorY":194},
      {"name":"코워킹 존","anchorX":230,"anchorY":390},
      {"name":"작은 강의실","anchorX":54,"anchorY":754},
      {"name":"캔틴","anchorX":500,"anchorY":730},
      {"name":"코치룸","anchorX":960,"anchorY":730}
    ]$json$::jsonb
  ),
  (
    13,
    'src/features/booths/maps/floor-13.svg',
    1486,
    940,
    $json$[
      {"name":"스타트랙","anchorX":72,"anchorY":402},
      {"name":"코워킹 존","anchorX":494,"anchorY":670},
      {"name":"포커스 존","anchorX":990,"anchorY":650},
      {"name":"안드로메다같은 방","anchorX":930,"anchorY":110}
    ]$json$::jsonb
  );

insert into public.floor_layout_drafts (floor_number, layout, room_size_modes)
values
  (11, '[]'::jsonb, '{}'::jsonb),
  (12, '[]'::jsonb, '{}'::jsonb),
  (13, '[]'::jsonb, '{}'::jsonb);

insert into public.floor_layout_publications (floor_number, layout, published_at)
select floor_number, layout, null
from public.floor_layout_drafts;
