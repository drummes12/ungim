create extension if not exists pgcrypto;

create type public.meal_status as enum ('met', 'missed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_color text not null check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  configured_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.competition_settings (
  id boolean primary key default true check (id),
  home_timezone text not null,
  starts_on date,
  created_at timestamptz not null default now()
);

create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  effective_week_start date not null check (extract(isodow from effective_week_start) = 1),
  workout_target smallint not null check (workout_target between 1 and 7),
  created_at timestamptz not null default now(),
  unique (profile_id, effective_week_start)
);

create table public.meal_slots (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  rule text not null check (char_length(rule) between 1 and 180),
  position smallint not null check (position between 1 and 5),
  unique (plan_version_id, position)
);

create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  meal_slot_id uuid not null references public.meal_slots(id) on delete cascade,
  entry_date date not null,
  status public.meal_status not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, meal_slot_id, entry_date)
);

create table public.workout_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null,
  workout_type text check (workout_type is null or char_length(workout_type) between 1 and 40),
  note text check (note is null or char_length(note) between 1 and 240),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, entry_date)
);

create table public.months (
  month_key text primary key check (month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  confirmed_by uuid[] not null default '{}',
  closed_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applied_mutations (
  mutation_id uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  applied_at timestamptz not null default now()
);

create index plan_versions_profile_week_idx on public.plan_versions(profile_id, effective_week_start desc);
create index meal_slots_plan_idx on public.meal_slots(plan_version_id, position);
create index meal_entries_profile_date_idx on public.meal_entries(profile_id, entry_date);
create index workout_entries_profile_date_idx on public.workout_entries(profile_id, entry_date);

alter table public.profiles enable row level security;
alter table public.competition_settings enable row level security;
alter table public.plan_versions enable row level security;
alter table public.meal_slots enable row level security;
alter table public.meal_entries enable row level security;
alter table public.workout_entries enable row level security;
alter table public.months enable row level security;
alter table public.applied_mutations enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.competition_settings from anon, authenticated;
revoke all on public.plan_versions from anon, authenticated;
revoke all on public.meal_slots from anon, authenticated;
revoke all on public.meal_entries from anon, authenticated;
revoke all on public.workout_entries from anon, authenticated;
revoke all on public.months from anon, authenticated;
revoke all on public.applied_mutations from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.competition_settings to authenticated;
grant select on public.plan_versions to authenticated;
grant select on public.meal_slots to authenticated;
grant select on public.meal_entries to authenticated;
grant select on public.workout_entries to authenticated;
grant select on public.months to authenticated;

create or replace function public.is_profile_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create policy "household members read profiles" on public.profiles
  for select to authenticated using (public.is_profile_member());
create policy "household members read settings" on public.competition_settings
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid()));
create policy "household members read plans" on public.plan_versions
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid()));
create policy "household members read meal slots" on public.meal_slots
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid()));
create policy "household members read meals" on public.meal_entries
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid()));
create policy "household members read workouts" on public.workout_entries
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid()));
create policy "household members read months" on public.months
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid()));

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.competition_settings;
alter publication supabase_realtime add table public.plan_versions;
alter publication supabase_realtime add table public.meal_slots;
alter publication supabase_realtime add table public.meal_entries;
alter publication supabase_realtime add table public.workout_entries;
alter publication supabase_realtime add table public.months;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_count integer;
  colors text[] := array['#f05a43', '#2f6fdd'];
begin
  select count(*) into profile_count from public.profiles;
  if profile_count >= 2 then
    raise exception 'Ahhh Un Gim accepts exactly two provisioned profiles';
  end if;

  insert into public.profiles (id, display_name, avatar_color)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(coalesce(new.email, 'persona'), '@', 1)),
    colors[profile_count + 1]
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_home_date()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (now() at time zone s.home_timezone)::date from public.competition_settings s where s.id),
    (now() at time zone 'UTC')::date
  );
$$;

create or replace function public.month_key_for_date(p_date date)
returns text
language sql
immutable
as $$
  select to_char(p_date, 'YYYY-MM');
$$;

create or replace function public.assert_profile_member()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception 'not_a_household_member';
  end if;
  return uid;
end;
$$;

create or replace function public.assert_mutation_fresh(p_mutation_id uuid, p_profile_id uuid, p_kind text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  insert into public.applied_mutations (mutation_id, profile_id, kind)
  values (p_mutation_id, p_profile_id, p_kind)
  on conflict (mutation_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

create or replace function public.invalidate_month_confirmations(p_date date)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.months
  set confirmed_by = '{}', updated_at = now()
  where month_key = public.month_key_for_date(p_date)
    and closed_at is null;
$$;

create or replace function public.assert_entry_date_allowed(p_date date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  settings record;
begin
  perform pg_advisory_xact_lock(hashtext('month:' || public.month_key_for_date(p_date)));
  select * into settings from public.competition_settings where id;
  if p_date > public.current_home_date() then
    raise exception 'future_date_not_allowed';
  end if;
  if settings.starts_on is not null and p_date < settings.starts_on then
    raise exception 'date_before_competition_start';
  end if;
  if exists (
    select 1 from public.months
    where month_key = public.month_key_for_date(p_date) and closed_at is not null
  ) then
    raise exception 'month_already_closed';
  end if;
end;
$$;

create or replace function public.active_plan(p_profile_id uuid, p_date date)
returns public.plan_versions
language sql
stable
security definer
set search_path = ''
as $$
  select pv.*
  from public.plan_versions pv
  where pv.profile_id = p_profile_id
    and pv.effective_week_start <= p_date - (extract(isodow from p_date)::int - 1)
  order by pv.effective_week_start desc
  limit 1;
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

  return met_count = slot_count * 7 and workout_count >= plan.workout_target;
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
      'meals', jsonb_build_object('met', meal_met, 'planned', meal_planned)
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
    'months', coalesce((
      select jsonb_object_agg(m.month_key, row_to_json(m))
      from public.months m
    ), '{}'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.save_plan(
  p_mutation_id uuid,
  p_display_name text,
  p_timezone text,
  p_workout_target integer,
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

  insert into public.plan_versions (profile_id, effective_week_start, workout_target)
  values (uid, effective, p_workout_target)
  on conflict (profile_id, effective_week_start)
  do update set workout_target = excluded.workout_target
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

create or replace function public.upsert_meal_entry(
  p_mutation_id uuid,
  p_entry_date date,
  p_meal_slot_id uuid,
  p_status public.meal_status,
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
  slot record;
  existing record;
begin
  uid := public.assert_profile_member();
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'upsert_meal_entry') then
    return public.get_dashboard();
  end if;

  select ms.*, pv.profile_id, pv.effective_week_start into slot
  from public.meal_slots ms
  join public.plan_versions pv on pv.id = ms.plan_version_id
  where ms.id = p_meal_slot_id;
  if slot.id is null or slot.profile_id <> uid then
    raise exception 'meal_slot_not_found';
  end if;
  if p_entry_date < slot.effective_week_start then
    raise exception 'date_before_plan_version';
  end if;
  perform public.assert_entry_date_allowed(p_entry_date);
  perform pg_advisory_xact_lock(
    hashtext('meal:' || uid::text || ':' || p_meal_slot_id::text || ':' || p_entry_date::text)
  );

  select * into existing from public.meal_entries
  where profile_id = uid and meal_slot_id = p_meal_slot_id and entry_date = p_entry_date;
  if existing.id is not null and p_expected_version is not null and existing.version <> p_expected_version then
    raise exception 'revision_conflict';
  end if;

  insert into public.meal_entries (profile_id, meal_slot_id, entry_date, status)
  values (uid, p_meal_slot_id, p_entry_date, p_status)
  on conflict (profile_id, meal_slot_id, entry_date)
  do update set status = excluded.status, version = public.meal_entries.version + 1, updated_at = now();

  perform public.invalidate_month_confirmations(p_entry_date);
  return public.get_dashboard();
end;
$$;

create or replace function public.clear_meal_entry(
  p_mutation_id uuid,
  p_entry_date date,
  p_meal_slot_id uuid,
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
  slot record;
  existing record;
begin
  uid := public.assert_profile_member();
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'clear_meal_entry') then
    return public.get_dashboard();
  end if;
  select ms.*, pv.profile_id, pv.effective_week_start into slot
  from public.meal_slots ms
  join public.plan_versions pv on pv.id = ms.plan_version_id
  where ms.id = p_meal_slot_id;
  if slot.id is null or slot.profile_id <> uid then
    raise exception 'meal_slot_not_found';
  end if;
  if p_entry_date < slot.effective_week_start then
    raise exception 'date_before_plan_version';
  end if;
  perform public.assert_entry_date_allowed(p_entry_date);
  perform pg_advisory_xact_lock(
    hashtext('meal:' || uid::text || ':' || p_meal_slot_id::text || ':' || p_entry_date::text)
  );

  select * into existing from public.meal_entries
  where profile_id = uid and meal_slot_id = p_meal_slot_id and entry_date = p_entry_date;
  if existing.id is not null and p_expected_version is not null and existing.version <> p_expected_version then
    raise exception 'revision_conflict';
  end if;

  if existing.id is not null then
    delete from public.meal_entries where id = existing.id;
    perform public.invalidate_month_confirmations(p_entry_date);
  end if;
  return public.get_dashboard();
end;
$$;

create or replace function public.upsert_workout_entry(
  p_mutation_id uuid,
  p_entry_date date,
  p_workout_type text,
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
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'upsert_workout_entry') then
    return public.get_dashboard();
  end if;
  perform public.assert_entry_date_allowed(p_entry_date);
  perform pg_advisory_xact_lock(
    hashtext('workout:' || uid::text || ':' || p_entry_date::text)
  );

  select * into existing from public.workout_entries
  where profile_id = uid and entry_date = p_entry_date;
  if existing.id is not null and p_expected_version is not null and existing.version <> p_expected_version then
    raise exception 'revision_conflict';
  end if;

  insert into public.workout_entries (profile_id, entry_date, workout_type, note)
  values (uid, p_entry_date, nullif(trim(coalesce(p_workout_type, '')), ''), nullif(trim(coalesce(p_note, '')), ''))
  on conflict (profile_id, entry_date)
  do update set workout_type = excluded.workout_type, note = excluded.note,
    version = public.workout_entries.version + 1, updated_at = now();

  perform public.invalidate_month_confirmations(p_entry_date);
  return public.get_dashboard();
end;
$$;

create or replace function public.clear_workout_entry(
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
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'clear_workout_entry') then
    return public.get_dashboard();
  end if;
  perform public.assert_entry_date_allowed(p_entry_date);
  perform pg_advisory_xact_lock(
    hashtext('workout:' || uid::text || ':' || p_entry_date::text)
  );

  select * into existing from public.workout_entries
  where profile_id = uid and entry_date = p_entry_date;
  if existing.id is not null and p_expected_version is not null and existing.version <> p_expected_version then
    raise exception 'revision_conflict';
  end if;

  if existing.id is not null then
    delete from public.workout_entries where id = existing.id;
    perform public.invalidate_month_confirmations(p_entry_date);
  end if;
  return public.get_dashboard();
end;
$$;

create or replace function public.confirm_month(p_month_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid;
  settings record;
  month_row public.months;
  month_start date;
  member_count integer;
begin
  uid := public.assert_profile_member();
  select * into settings from public.competition_settings where id;
  if p_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'invalid_month_key';
  end if;
  month_start := (p_month_key || '-01')::date;
  if month_start + interval '1 month' > public.current_home_date() then
    raise exception 'month_not_finished';
  end if;
  if settings.starts_on is not null and month_start + interval '1 month - 1 day' < settings.starts_on then
    raise exception 'month_before_competition_start';
  end if;

  perform pg_advisory_xact_lock(hashtext('month:' || p_month_key));

  insert into public.months (month_key)
  values (p_month_key)
  on conflict (month_key) do nothing;

  select * into month_row from public.months where month_key = p_month_key for update;
  if month_row.closed_at is not null then
    return to_jsonb(month_row);
  end if;

  if not uid = any(month_row.confirmed_by) then
    month_row.confirmed_by := array_append(month_row.confirmed_by, uid);
  end if;

  select count(*) into member_count from public.profiles;
  if array_length(month_row.confirmed_by, 1) >= member_count then
    month_row.result := public.compute_month_results(p_month_key);
    month_row.closed_at := now();
  end if;
  month_row.updated_at := now();

  update public.months
  set confirmed_by = month_row.confirmed_by,
      closed_at = month_row.closed_at,
      result = month_row.result,
      updated_at = month_row.updated_at
  where month_key = p_month_key
  returning * into month_row;

  return to_jsonb(month_row);
end;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_profile_member() to authenticated;
grant execute on function public.get_dashboard() to authenticated;
grant execute on function public.save_plan(uuid, text, text, integer, jsonb) to authenticated;
grant execute on function public.upsert_meal_entry(uuid, date, uuid, public.meal_status, integer) to authenticated;
grant execute on function public.clear_meal_entry(uuid, date, uuid, integer) to authenticated;
grant execute on function public.upsert_workout_entry(uuid, date, text, text, integer) to authenticated;
grant execute on function public.clear_workout_entry(uuid, date, integer) to authenticated;
grant execute on function public.confirm_month(text) to authenticated;
