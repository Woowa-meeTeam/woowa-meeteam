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

  update public.floor_layout_drafts as draft
  set
    layout = p_layouts -> draft.floor_number::text,
    room_size_modes = p_room_size_modes -> draft.floor_number::text,
    updated_at = saved_at
  where draft.floor_number in (11, 12, 13);

  return saved_at;
end;
$$;
