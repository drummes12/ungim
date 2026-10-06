-- fix: upsert_routine referenced `upsert_routine.routine_id` inside a DELETE,
-- which Postgres parses as a table reference (42P01 missing FROM-clause entry).
-- The local variable is renamed to v_routine_id to match the v_position style.
create or replace function public.upsert_routine(
  p_mutation_id uuid,
  p_routine_id uuid,
  p_name text,
  p_exercises jsonb,
  p_expected_version integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid;
  existing record;
  v_routine_id uuid;
  exercise jsonb;
  v_position integer := 0;
begin
  uid := public.assert_profile_member();
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'upsert_routine') then
    return public.get_dashboard();
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 40 then
    raise exception 'invalid_routine_name';
  end if;
  if jsonb_typeof(coalesce(p_exercises, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_exercises, '[]'::jsonb)) > 30 then
    raise exception 'invalid_routine_exercises';
  end if;
  perform pg_advisory_xact_lock(hashtext('routine:' || uid::text));

  if p_routine_id is not null then
    select * into existing from public.routines where id = p_routine_id;
    if existing.id is not null then
      if existing.profile_id <> uid then
        raise exception 'routine_not_found';
      end if;
      if p_expected_version is not null and existing.version <> p_expected_version then
        raise exception 'revision_conflict';
      end if;
      update public.routines
      set name = trim(p_name), version = version + 1, updated_at = now()
      where id = existing.id;
      v_routine_id := existing.id;
    else
      insert into public.routines (id, profile_id, name, position)
      select p_routine_id, uid, trim(p_name), coalesce(max(r.position), -1) + 1
      from public.routines r where r.profile_id = uid;
      v_routine_id := p_routine_id;
    end if;
  else
    insert into public.routines (profile_id, name, position)
    select uid, trim(p_name), coalesce(max(r.position), -1) + 1
    from public.routines r where r.profile_id = uid
    returning id into v_routine_id;
  end if;

  delete from public.routine_exercises re where re.routine_id = v_routine_id;
  for exercise in select value from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) loop
    insert into public.routine_exercises (routine_id, name, sets, reps, weight, position)
    select v_routine_id,
      trim(exercise->>'name'),
      (exercise->>'sets')::smallint,
      (exercise->>'reps')::smallint,
      coalesce((exercise->>'weight')::numeric, 0),
      v_position
    where jsonb_typeof(exercise) = 'object'
      and jsonb_typeof(exercise->'name') = 'string'
      and char_length(trim(exercise->>'name')) <= 60
      and (exercise->>'sets')::smallint between 1 and 10
      and (exercise->>'reps')::smallint between 1 and 99
      and coalesce((exercise->>'weight')::numeric, 0) between 0 and 999;
    v_position := v_position + 1;
  end loop;

  return public.get_dashboard();
end;
$$;

grant execute on function public.upsert_routine(uuid, uuid, text, jsonb, integer) to authenticated;
