create table public.free_meal_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null,
  count smallint not null check (count between 1 and 9),
  note text check (note is null or char_length(note) between 1 and 240),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, entry_date)
);

alter table public.plan_versions
  add column free_meals_per_month smallint not null default 0
  check (free_meals_per_month between 0 and 31);

create index free_meal_entries_profile_date_idx on public.free_meal_entries(profile_id, entry_date);

alter table public.free_meal_entries enable row level security;

revoke all on public.free_meal_entries from anon, authenticated;
grant select on public.free_meal_entries to authenticated;

create policy "household members read free meals" on public.free_meal_entries
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid()));

alter publication supabase_realtime add table public.free_meal_entries;

drop function public.save_plan(uuid, text, text, integer, jsonb);
create or replace function public.save_plan(
  p_mutation_id uuid,
  p_display_name text,
  p_timezone text,
  p_workout_target integer,
  p_free_meals_per_month integer,
  p_meals jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid;
  settings record;
  today date;
  effective date;
  version_id uuid;
  meal record;
  meal_count integer;
begin
  uid := public.assert_profile_member();
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'save_plan') then
    return public.get_dashboard();
  end if;

  if p_display_name is null or char_length(trim(p_display_name)) not between 1 and 40 then
    raise exception 'invalid_display_name';
  end if;
  if p_workout_target not between 1 and 7 then
    raise exception 'invalid_workout_target';
  end if;
  if p_free_meals_per_month is null or p_free_meals_per_month not between 0 and 31 then
    raise exception 'invalid_free_meals_per_month';
  end if;
  if jsonb_typeof(p_meals) <> 'array' or jsonb_array_length(p_meals) not between 1 and 5 then
    raise exception 'invalid_meal_count';
  end if;

  select * into settings from public.competition_settings where id for update;
  if settings.id is null then
    if p_timezone is null or not exists (select 1 from pg_timezone_names where name = p_timezone) then
      raise exception 'invalid_timezone';
    end if;
    insert into public.competition_settings (id, home_timezone)
    values (true, p_timezone)
    returning * into settings;
  end if;

  today := (now() at time zone settings.home_timezone)::date;
  effective := today - (extract(isodow from today)::int - 1);
  if exists (select 1 from public.plan_versions where profile_id = uid)
    and settings.starts_on is not null
    and today >= settings.starts_on then
    effective := effective + 7;
  end if;

  insert into public.plan_versions (profile_id, effective_week_start, workout_target, free_meals_per_month)
  values (uid, effective, p_workout_target, p_free_meals_per_month)
  on conflict (profile_id, effective_week_start)
  do update set workout_target = excluded.workout_target,
    free_meals_per_month = excluded.free_meals_per_month
  returning id into version_id;

  delete from public.meal_slots where plan_version_id = version_id;
  meal_count := 0;
  for meal in select value from jsonb_array_elements(p_meals) loop
    meal_count := meal_count + 1;
    if char_length(trim(coalesce(meal.value->>'name', ''))) not between 1 and 40
      or char_length(trim(coalesce(meal.value->>'rule', ''))) not between 1 and 180 then
      raise exception 'invalid_meal_slot';
    end if;
    insert into public.meal_slots (plan_version_id, name, rule, position)
    values (version_id, trim(meal.value->>'name'), trim(meal.value->>'rule'), meal_count);
  end loop;

  update public.profiles
  set display_name = trim(p_display_name), configured_at = coalesce(configured_at, now())
  where id = uid;

  if settings.starts_on is null and (select count(*) from public.profiles where configured_at is not null) = 2 then
    update public.competition_settings set starts_on = today where id;
  end if;

  return public.get_dashboard();
end;
$$;

create or replace function public.is_perfect_week(p_profile_id uuid, p_week_start date)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  plan public.plan_versions;
  slot_count integer;
  met_count integer;
  workout_count integer;
begin
  select * into plan from public.active_plan(p_profile_id, p_week_start);
  if plan.id is null then
    return false;
  end if;

  select count(*) into slot_count from public.meal_slots where plan_version_id = plan.id;
  select count(*) into met_count
  from public.meal_entries e
  join public.meal_slots ms on ms.id = e.meal_slot_id
  where e.profile_id = p_profile_id
    and ms.plan_version_id = plan.id
    and e.entry_date between p_week_start and p_week_start + 6
    and e.status = 'met';

  select count(*) into workout_count
  from public.workout_entries
  where profile_id = p_profile_id
    and entry_date between p_week_start and p_week_start + 6;

  return met_count = slot_count * 7
    and workout_count >= plan.workout_target
    and not exists (
      select 1 from public.free_meal_entries fe
      where fe.profile_id = p_profile_id
        and fe.entry_date between p_week_start and p_week_start + 6
    );
end;
$$;

create or replace function public.compute_month_results(p_month_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  settings record;
  profile record;
  month_start date;
  month_end date;
  cutoff date;
  eligible_start date;
  eligible_end date;
  week_start date;
  segment_start date;
  segment_end date;
  segment_days integer;
  plan public.plan_versions;
  workout_target integer;
  workout_done integer;
  workout_earned integer;
  meal_planned integer;
  meal_met integer;
  slot_count integer;
  free_used integer;
  free_quota integer;
  workout_ratio numeric;
  meal_ratio numeric;
  base numeric;
  bonus integer;
  streak integer;
  participants jsonb := '[]'::jsonb;
  result jsonb;
  max_total numeric;
  max_base numeric;
begin
  if p_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'invalid_month_key';
  end if;

  month_start := (p_month_key || '-01')::date;
  month_end := (month_start + interval '1 month - 1 day')::date;
  cutoff := least(month_end, public.current_home_date());
  select * into settings from public.competition_settings where id;

  for profile in select * from public.profiles order by created_at, display_name loop
    workout_earned := 0;
    workout_target := 0;
    meal_planned := 0;
    free_used := 0;
    free_quota := 0;
    bonus := 0;
    streak := 0;

    if settings.id is null or settings.starts_on is null or cutoff < settings.starts_on then
      participants := participants || jsonb_build_object(
        'profileId', profile.id,
        'name', profile.display_name,
        'color', profile.avatar_color,
        'noData', true,
        'base', 0,
        'bonus', 0,
        'total', 0,
        'streak', 0
      );
      continue;
    end if;

    eligible_start := greatest(month_start, settings.starts_on);
    eligible_end := least(month_end, cutoff);

    week_start := eligible_start - (extract(isodow from eligible_start)::int - 1);
    while week_start <= eligible_end loop
      segment_start := greatest(week_start, eligible_start);
      segment_end := least(week_start + 6, eligible_end);
      segment_days := segment_end - segment_start + 1;
      select * into plan from public.active_plan(profile.id, week_start);

      if plan.id is not null then
        workout_target := workout_target + ceil(plan.workout_target * segment_days / 7.0)::int;
        select count(*) into workout_done
        from public.workout_entries
        where profile_id = profile.id
          and entry_date between segment_start and segment_end;
        workout_earned := workout_earned + least(workout_done, ceil(plan.workout_target * segment_days / 7.0)::int);

        select count(*) into slot_count from public.meal_slots where plan_version_id = plan.id;
        meal_planned := meal_planned + slot_count * segment_days;
      end if;

      week_start := week_start + 7;
    end loop;

    select count(*) into meal_met
    from public.meal_entries e
    join public.meal_slots ms on ms.id = e.meal_slot_id
    join public.plan_versions pv on pv.id = ms.plan_version_id
    where e.profile_id = profile.id
      and e.entry_date between eligible_start and eligible_end
      and e.status = 'met'
      and pv.id = (select ap.id from public.active_plan(profile.id, e.entry_date) ap);

    select coalesce(sum(fe.count), 0) into free_used
    from public.free_meal_entries fe
    where fe.profile_id = profile.id
      and fe.entry_date between eligible_start and eligible_end;
    select coalesce(ap.free_meals_per_month, 0) into free_quota
    from public.active_plan(profile.id, eligible_end) ap;
    free_quota := coalesce(free_quota, 0);
    meal_planned := meal_planned + greatest(0, free_used - free_quota);

    week_start := eligible_start - (extract(isodow from eligible_start)::int - 1);
    while week_start <= eligible_end loop
      if week_start >= settings.starts_on
        and week_start + 6 <= eligible_end
        and week_start + 6 between month_start and month_end
        and public.is_perfect_week(profile.id, week_start) then
        bonus := least(10, bonus + 2);
      end if;
      week_start := week_start + 7;
    end loop;

    week_start := eligible_end - (extract(isodow from eligible_end)::int - 1);
    if extract(isodow from eligible_end) <> 7 then
      week_start := week_start - 7;
    end if;
    while week_start >= settings.starts_on and public.is_perfect_week(profile.id, week_start) loop
      streak := streak + 1;
      week_start := week_start - 7;
    end loop;

    workout_ratio := case when workout_target = 0 then 0 else workout_earned::numeric / workout_target end;
    meal_ratio := case when meal_planned = 0 then 0 else meal_met::numeric / meal_planned end;
    base := round((workout_ratio * 50 + meal_ratio * 50)::numeric, 3);

    participants := participants || jsonb_build_object(
      'profileId', profile.id,
      'name', profile.display_name,
      'color', profile.avatar_color,
      'noData', workout_target = 0 and meal_planned = 0,
      'base', base,
      'bonus', bonus,
      'total', base + bonus,
      'streak', streak,
      'workout', jsonb_build_object('earned', workout_earned, 'target', workout_target),
      'meals', jsonb_build_object('met', meal_met, 'planned', meal_planned),
      'freeMeals', jsonb_build_object('used', free_used, 'quota', free_quota)
    );
  end loop;

  select max((p->>'total')::numeric) into max_total from jsonb_array_elements(participants) p;
  select max((p->>'base')::numeric) into max_base
  from jsonb_array_elements(participants) p
  where coalesce((p->>'noData')::boolean, false) = false and (p->>'total')::numeric = max_total;

  result := jsonb_build_object(
    'monthKey', p_month_key,
    'timezone', coalesce(settings.home_timezone, 'UTC'),
    'participants', participants,
    'winnerIds', coalesce((
      select jsonb_agg(p->'profileId')
      from jsonb_array_elements(participants) p
      where coalesce((p->>'noData')::boolean, false) = false
        and (p->>'total')::numeric = max_total
        and (p->>'base')::numeric = max_base
    ), '[]'::jsonb),
    'computedAt', now()
  );
  return result;
end;
$$;

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
    'months', coalesce((
      select jsonb_object_agg(m.month_key, row_to_json(m))
      from public.months m
    ), '{}'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.upsert_free_meal_entry(
  p_mutation_id uuid,
  p_entry_date date,
  p_count integer,
  p_note text,
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
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'upsert_free_meal_entry') then
    return public.get_dashboard();
  end if;
  if p_count is null or p_count not between 1 and 9 then
    raise exception 'invalid_free_count';
  end if;
  perform public.assert_entry_date_allowed(p_entry_date);
  perform pg_advisory_xact_lock(
    hashtext('free:' || uid::text || ':' || p_entry_date::text)
  );

  select * into existing from public.free_meal_entries
  where profile_id = uid and entry_date = p_entry_date;
  if existing.id is not null and p_expected_version is not null and existing.version <> p_expected_version then
    raise exception 'revision_conflict';
  end if;

  insert into public.free_meal_entries (profile_id, entry_date, count, note)
  values (uid, p_entry_date, p_count, nullif(trim(coalesce(p_note, '')), ''))
  on conflict (profile_id, entry_date)
  do update set count = excluded.count, note = excluded.note,
    version = public.free_meal_entries.version + 1, updated_at = now();

  perform public.invalidate_month_confirmations(p_entry_date);
  return public.get_dashboard();
end;
$$;

create or replace function public.clear_free_meal_entry(
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
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'clear_free_meal_entry') then
    return public.get_dashboard();
  end if;
  perform public.assert_entry_date_allowed(p_entry_date);
  perform pg_advisory_xact_lock(
    hashtext('free:' || uid::text || ':' || p_entry_date::text)
  );

  select * into existing from public.free_meal_entries
  where profile_id = uid and entry_date = p_entry_date;
  if existing.id is not null and p_expected_version is not null and existing.version <> p_expected_version then
    raise exception 'revision_conflict';
  end if;

  if existing.id is not null then
    delete from public.free_meal_entries where id = existing.id;
    perform public.invalidate_month_confirmations(p_entry_date);
  end if;
  return public.get_dashboard();
end;
$$;

grant execute on function public.save_plan(uuid, text, text, integer, integer, jsonb) to authenticated;
grant execute on function public.upsert_free_meal_entry(uuid, date, integer, text, integer) to authenticated;
grant execute on function public.clear_free_meal_entry(uuid, date, integer) to authenticated;
