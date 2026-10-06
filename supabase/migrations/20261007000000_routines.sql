create table public.routines (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  position integer not null default 0,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index routines_profile_idx on public.routines(profile_id);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  name text not null check (char_length(name) <= 60),
  sets smallint not null check (sets between 1 and 10),
  reps smallint not null check (reps between 1 and 99),
  weight numeric(6,1) not null default 0 check (weight >= 0 and weight <= 999),
  position smallint not null default 0
);

create index routine_exercises_routine_idx on public.routine_exercises(routine_id);

create table public.routine_schedule (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  routine_id uuid not null references public.routines(id) on delete cascade,
  primary key (profile_id, weekday)
);

create table public.routine_days (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null,
  routine_id uuid references public.routines(id) on delete set null,
  exercises jsonb not null default '[]'::jsonb,
  completed boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, entry_date)
);

create index routine_days_profile_date_idx on public.routine_days(profile_id, entry_date);

alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.routine_schedule enable row level security;
alter table public.routine_days enable row level security;

revoke all on public.routines from anon, authenticated;
revoke all on public.routine_exercises from anon, authenticated;
revoke all on public.routine_schedule from anon, authenticated;
revoke all on public.routine_days from anon, authenticated;
grant select on public.routines to authenticated;
grant select on public.routine_exercises to authenticated;
grant select on public.routine_schedule to authenticated;
grant select on public.routine_days to authenticated;

create policy "household members read routines" on public.routines
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid()));
create policy "household members read routine exercises" on public.routine_exercises
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid()));
create policy "household members read routine schedule" on public.routine_schedule
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid()));
create policy "household members read routine days" on public.routine_days
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid()));

alter publication supabase_realtime add table public.routines;
alter publication supabase_realtime add table public.routine_exercises;
alter publication supabase_realtime add table public.routine_schedule;
alter publication supabase_realtime add table public.routine_days;

create or replace function public.get_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid;
  result jsonb;
begin
  uid := public.assert_profile_member();
  select jsonb_build_object(
    'currentProfileId', uid,
    'profiles', coalesce((select jsonb_agg(row_to_json(p) order by p.created_at) from public.profiles p), '[]'::jsonb),
    'settings', (select row_to_json(s) from public.competition_settings s where s.id),
    'planVersions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pv.id,
        'profileId', pv.profile_id,
        'effectiveWeekStart', pv.effective_week_start,
        'workoutTarget', pv.workout_target,
        'freeMealsPerMonth', pv.free_meals_per_month,
        'createdAt', pv.created_at,
        'meals', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', ms.id,
            'name', ms.name,
            'rule', ms.rule,
            'position', ms.position
          ) order by ms.position)
          from public.meal_slots ms where ms.plan_version_id = pv.id
        ), '[]'::jsonb)
      ) order by pv.effective_week_start)
      from public.plan_versions pv
    ), '[]'::jsonb),
    'mealEntries', coalesce((
      select jsonb_agg(row_to_json(e) order by e.entry_date, e.meal_slot_id)
      from public.meal_entries e
    ), '[]'::jsonb),
    'workoutEntries', coalesce((
      select jsonb_agg(row_to_json(e) order by e.entry_date)
      from public.workout_entries e
    ), '[]'::jsonb),
    'freeMealEntries', coalesce((
      select jsonb_agg(row_to_json(e) order by e.entry_date)
      from public.free_meal_entries e
    ), '[]'::jsonb),
    'extraEntries', coalesce((
      select jsonb_agg(row_to_json(e) order by e.entry_date)
      from public.extra_entries e
    ), '[]'::jsonb),
    'routines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'position', r.position,
        'version', r.version,
        'exercises', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', re.name,
            'sets', re.sets,
            'reps', re.reps,
            'weight', re.weight
          ) order by re.position)
          from public.routine_exercises re
          where re.routine_id = r.id
        ), '[]'::jsonb)
      ) order by r.position, r.created_at)
      from public.routines r
      where r.profile_id = uid
    ), '[]'::jsonb),
    'routineSchedule', coalesce((
      select jsonb_object_agg(rs.weekday, rs.routine_id)
      from public.routine_schedule rs
      where rs.profile_id = uid
    ), '{}'::jsonb),
    'routineDays', coalesce((
      select jsonb_agg(row_to_json(d) order by d.entry_date)
      from public.routine_days d
      where d.profile_id = uid
    ), '[]'::jsonb),
    'months', coalesce((
      select jsonb_object_agg(m.month_key, row_to_json(m))
      from public.months m
    ), '{}'::jsonb)
  ) into result;
  return result;
end;
$$;

-- Validates and normalizes one exercise element of a routine-day jsonb array.
create or replace function public.normalize_day_exercise(p_exercise jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_sets smallint;
  v_reps smallint;
  v_weight numeric;
  v_done jsonb;
  v_reps_done jsonb;
begin
  if jsonb_typeof(p_exercise) <> 'object'
    or jsonb_typeof(p_exercise->'name') <> 'string'
    or char_length(trim(p_exercise->>'name')) > 60 then
    raise exception 'invalid_day_exercise_name';
  end if;
  v_sets := (p_exercise->>'sets')::smallint;
  v_reps := (p_exercise->>'reps')::smallint;
  v_weight := (p_exercise->>'weight')::numeric;
  if v_sets not between 1 and 10 or v_reps not between 1 and 99
    or v_weight < 0 or v_weight > 999 then
    raise exception 'invalid_day_exercise_values';
  end if;
  v_done := coalesce(p_exercise->'done', '[]'::jsonb);
  v_reps_done := coalesce(p_exercise->'repsDone', '[]'::jsonb);
  if jsonb_typeof(v_done) <> 'array' or jsonb_array_length(v_done) <> v_sets
    or jsonb_typeof(v_reps_done) <> 'array' or jsonb_array_length(v_reps_done) <> v_sets
    or exists (
      select 1 from jsonb_array_elements(v_done) flag
      where jsonb_typeof(flag.value) <> 'boolean'
    ) then
    raise exception 'invalid_day_exercise_progress';
  end if;
  return jsonb_build_object(
    'id', coalesce((p_exercise->>'id')::int, 0),
    'name', trim(p_exercise->>'name'),
    'sets', v_sets,
    'reps', v_reps,
    'weight', v_weight,
    'skipped', coalesce((p_exercise->>'skipped')::boolean, false),
    'done', v_done,
    'repsDone', v_reps_done
  );
end;
$$;

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
  routine_id uuid;
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
      routine_id := existing.id;
    else
      insert into public.routines (id, profile_id, name, position)
      select p_routine_id, uid, trim(p_name), coalesce(max(r.position), -1) + 1
      from public.routines r where r.profile_id = uid;
      routine_id := p_routine_id;
    end if;
  else
    insert into public.routines (profile_id, name, position)
    select uid, trim(p_name), coalesce(max(r.position), -1) + 1
    from public.routines r where r.profile_id = uid
    returning id into routine_id;
  end if;

  delete from public.routine_exercises re where re.routine_id = upsert_routine.routine_id;
  for exercise in select value from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) loop
    insert into public.routine_exercises (routine_id, name, sets, reps, weight, position)
    select routine_id,
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

create or replace function public.delete_routine(
  p_mutation_id uuid,
  p_routine_id uuid,
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
begin
  uid := public.assert_profile_member();
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'delete_routine') then
    return public.get_dashboard();
  end if;
  perform pg_advisory_xact_lock(hashtext('routine:' || uid::text));

  select * into existing from public.routines where id = p_routine_id;
  if existing.id is null or existing.profile_id <> uid then
    raise exception 'routine_not_found';
  end if;
  if p_expected_version is not null and existing.version <> p_expected_version then
    raise exception 'revision_conflict';
  end if;

  delete from public.routines where id = existing.id;
  return public.get_dashboard();
end;
$$;

create or replace function public.set_routine_weekday(
  p_mutation_id uuid,
  p_weekday integer,
  p_routine_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid;
  owner uuid;
begin
  uid := public.assert_profile_member();
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'set_routine_weekday') then
    return public.get_dashboard();
  end if;
  if p_weekday is null or p_weekday not between 0 and 6 then
    raise exception 'invalid_weekday';
  end if;
  perform pg_advisory_xact_lock(
    hashtext('routine:' || uid::text || ':' || p_weekday::text)
  );

  if p_routine_id is not null then
    select profile_id into owner from public.routines where id = p_routine_id;
    if owner is null or owner <> uid then
      raise exception 'routine_not_found';
    end if;
    insert into public.routine_schedule (profile_id, weekday, routine_id)
    values (uid, p_weekday, p_routine_id)
    on conflict (profile_id, weekday)
    do update set routine_id = excluded.routine_id;
  else
    delete from public.routine_schedule
    where profile_id = uid and weekday = p_weekday;
  end if;

  return public.get_dashboard();
end;
$$;

create or replace function public.upsert_routine_day(
  p_mutation_id uuid,
  p_entry_date date,
  p_routine_id uuid,
  p_exercises jsonb,
  p_completed boolean,
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
  owner uuid;
  normalized jsonb := '[]'::jsonb;
  exercise jsonb;
begin
  uid := public.assert_profile_member();
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'upsert_routine_day') then
    return public.get_dashboard();
  end if;
  if jsonb_typeof(coalesce(p_exercises, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_exercises, '[]'::jsonb)) > 30 then
    raise exception 'invalid_day_exercises';
  end if;
  perform public.assert_entry_date_allowed(p_entry_date);
  perform pg_advisory_xact_lock(
    hashtext('routine-day:' || uid::text || ':' || p_entry_date::text)
  );

  if p_routine_id is not null then
    select profile_id into owner from public.routines where id = p_routine_id;
    if owner is null or owner <> uid then
      raise exception 'routine_not_found';
    end if;
  end if;

  select * into existing from public.routine_days
  where profile_id = uid and entry_date = p_entry_date;
  if existing.id is not null and p_expected_version is not null and existing.version <> p_expected_version then
    raise exception 'revision_conflict';
  end if;

  for exercise in select value from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) loop
    normalized := normalized || jsonb_build_array(public.normalize_day_exercise(exercise));
  end loop;

  insert into public.routine_days (profile_id, entry_date, routine_id, exercises, completed)
  values (uid, p_entry_date, p_routine_id, normalized, coalesce(p_completed, false))
  on conflict (profile_id, entry_date)
  do update set routine_id = excluded.routine_id,
    exercises = excluded.exercises,
    completed = excluded.completed,
    version = public.routine_days.version + 1,
    updated_at = now();

  return public.get_dashboard();
end;
$$;

create or replace function public.clear_routine_day(
  p_mutation_id uuid,
  p_entry_date date,
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
begin
  uid := public.assert_profile_member();
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'clear_routine_day') then
    return public.get_dashboard();
  end if;
  perform public.assert_entry_date_allowed(p_entry_date);
  perform pg_advisory_xact_lock(
    hashtext('routine-day:' || uid::text || ':' || p_entry_date::text)
  );

  select * into existing from public.routine_days
  where profile_id = uid and entry_date = p_entry_date;
  if existing.id is not null and p_expected_version is not null and existing.version <> p_expected_version then
    raise exception 'revision_conflict';
  end if;

  if existing.id is not null then
    delete from public.routine_days where id = existing.id;
  end if;
  return public.get_dashboard();
end;
$$;

grant execute on function public.upsert_routine(uuid, uuid, text, jsonb, integer) to authenticated;
grant execute on function public.delete_routine(uuid, uuid, integer) to authenticated;
grant execute on function public.set_routine_weekday(uuid, integer, uuid) to authenticated;
grant execute on function public.upsert_routine_day(uuid, date, uuid, jsonb, boolean, integer) to authenticated;
grant execute on function public.clear_routine_day(uuid, date, integer) to authenticated;
