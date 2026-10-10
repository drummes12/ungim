-- Competitions ("Cumbres"): private groups per account, joined via invite code.
-- Replaces the singleton household (competition_settings + implicit pair).

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique,
  home_timezone text not null,
  starts_on date,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.competition_members (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused')),
  joined_at timestamptz not null default now(),
  primary key (competition_id, profile_id)
);

create index competition_members_profile_idx on public.competition_members(profile_id);

alter table public.months
  add column competition_id uuid references public.competitions(id) on delete cascade;

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    select string_agg(substr(alphabet, 1 + floor(random() * 31)::int, 1), '')
      into code
      from generate_series(1, 6);
    exit when not exists (
      select 1 from public.competitions where invite_code = code
    );
  end loop;
  return code;
end;
$$;

-- Migrate the existing household into its first Cumbre. Members get
-- joined_at = 1970 so scoring keeps counting their pre-migration data.
do $$
declare
  settings record;
  comp_id uuid;
begin
  if exists (select 1 from public.profiles) then
    select * into settings from public.competition_settings where id;
    insert into public.competitions (
      name, invite_code, home_timezone, starts_on, created_by
    )
    values (
      'Primera Cumbre',
      public.generate_invite_code(),
      coalesce(settings.home_timezone, 'UTC'),
      settings.starts_on,
      (select id from public.profiles order by created_at limit 1)
    )
    returning id into comp_id;

    insert into public.competition_members (
      competition_id, profile_id, status, joined_at
    )
    select comp_id, id, 'active', '1970-01-01'::timestamptz
    from public.profiles;

    update public.months set competition_id = comp_id;
  end if;
end $$;

alter table public.months
  alter column competition_id set not null,
  drop constraint months_pkey,
  add primary key (competition_id, month_key);

drop table public.competition_settings;

alter table public.competitions enable row level security;
alter table public.competition_members enable row level security;

revoke all on public.competitions from anon, authenticated;
revoke all on public.competition_members from anon, authenticated;
grant select on public.competitions to authenticated;
grant select on public.competition_members to authenticated;

drop policy "household members read profiles" on public.profiles;
drop policy "household members read plans" on public.plan_versions;
drop policy "household members read meal slots" on public.meal_slots;
drop policy "household members read meals" on public.meal_entries;
drop policy "household members read workouts" on public.workout_entries;
drop policy "household members read months" on public.months;
drop policy "household members read free meals" on public.free_meal_entries;
drop policy "household members read extra entries" on public.extra_entries;
drop policy "household members read routines" on public.routines;
drop policy "household members read routine exercises" on public.routine_exercises;
drop policy "household members read routine schedule" on public.routine_schedule;
drop policy "household members read routine days" on public.routine_days;

-- True when the caller shares at least one group where BOTH are active
-- with p_other. Entries and plans are only visible to active co-members.
create or replace function public.shares_active_competition(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.competition_members mine
    join public.competition_members theirs
      on theirs.competition_id = mine.competition_id
     and theirs.status = 'active'
    where mine.profile_id = auth.uid()
      and mine.status = 'active'
      and theirs.profile_id = p_other
  );
$$;

create or replace function public.is_competition_member(p_competition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.competition_members
    where competition_id = p_competition_id and profile_id = auth.uid()
  );
$$;

create policy "own and co-members read profiles" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_active_competition(id));
create policy "members read their competitions" on public.competitions
  for select to authenticated using (public.is_competition_member(id));
create policy "members read competition members" on public.competition_members
  for select to authenticated
  using (public.is_competition_member(competition_id));
create policy "own and co-members read plans" on public.plan_versions
  for select to authenticated
  using (profile_id = auth.uid() or public.shares_active_competition(profile_id));
create policy "own and co-members read meal slots" on public.meal_slots
  for select to authenticated
  using (exists (
    select 1 from public.plan_versions pv
    where pv.id = meal_slots.plan_version_id
      and (pv.profile_id = auth.uid()
        or public.shares_active_competition(pv.profile_id))
  ));
create policy "own and co-members read meals" on public.meal_entries
  for select to authenticated
  using (profile_id = auth.uid() or public.shares_active_competition(profile_id));
create policy "own and co-members read workouts" on public.workout_entries
  for select to authenticated
  using (profile_id = auth.uid() or public.shares_active_competition(profile_id));
create policy "own and co-members read free meals" on public.free_meal_entries
  for select to authenticated
  using (profile_id = auth.uid() or public.shares_active_competition(profile_id));
create policy "own and co-members read extra entries" on public.extra_entries
  for select to authenticated
  using (profile_id = auth.uid() or public.shares_active_competition(profile_id));
create policy "own and co-members read routines" on public.routines
  for select to authenticated
  using (profile_id = auth.uid() or public.shares_active_competition(profile_id));
create policy "own and co-members read routine exercises" on public.routine_exercises
  for select to authenticated
  using (exists (
    select 1 from public.routines r
    where r.id = routine_exercises.routine_id
      and (r.profile_id = auth.uid()
        or public.shares_active_competition(r.profile_id))
  ));
create policy "own and co-members read routine schedule" on public.routine_schedule
  for select to authenticated
  using (profile_id = auth.uid() or public.shares_active_competition(profile_id));
create policy "own and co-members read routine days" on public.routine_days
  for select to authenticated
  using (profile_id = auth.uid() or public.shares_active_competition(profile_id));
create policy "members read competition months" on public.months
  for select to authenticated
  using (public.is_competition_member(competition_id));

alter publication supabase_realtime add table public.competitions;
alter publication supabase_realtime add table public.competition_members;

-- New profiles are unlimited now (invite codes gate access to data).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_count integer;
  colors text[] := array[
    '#f05a43', '#2f6fdd', '#3a9d6e', '#d8a02f',
    '#a05ac7', '#d84f8f', '#2fa8b8', '#8a6dd8'
  ];
begin
  select count(*) into profile_count from public.profiles;
  insert into public.profiles (id, display_name, avatar_color)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(coalesce(new.email, 'persona'), '@', 1)),
    colors[(profile_count % 8) + 1]
  );
  return new;
end;
$$;

drop function public.current_home_date();
drop function public.is_profile_member();

create or replace function public.current_competition_date(p_competition_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (now() at time zone c.home_timezone)::date
     from public.competitions c where c.id = p_competition_id),
    (now() at time zone 'UTC')::date
  );
$$;

-- Latest "today" among the caller's active groups; used to reject future dates.
create or replace function public.my_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    max((now() at time zone c.home_timezone)::date),
    (now() at time zone 'UTC')::date
  )
  from public.competition_members m
  join public.competitions c on c.id = m.competition_id
  where m.profile_id = auth.uid() and m.status = 'active';
$$;

create or replace function public.assert_competition_member(p_competition_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (
    select 1 from public.competition_members
    where competition_id = p_competition_id and profile_id = uid
  ) then
    raise exception 'not_a_competition_member';
  end if;
  return uid;
end;
$$;

-- Profiles whose entries the caller may see: self plus anyone sharing an
-- active group. Excludes paused members.
create or replace function public.visible_profile_ids(p_uid uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p_uid
  union
  select theirs.profile_id
  from public.competition_members mine
  join public.competition_members theirs
    on theirs.competition_id = mine.competition_id
   and theirs.status = 'active'
  where mine.profile_id = p_uid and mine.status = 'active';
$$;

create or replace function public.invalidate_month_confirmations(p_date date)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.months mo
  set confirmed_by = '{}', updated_at = now()
  from public.competition_members m
  where m.competition_id = mo.competition_id
    and m.profile_id = auth.uid()
    and m.status = 'active'
    and mo.month_key = public.month_key_for_date(p_date)
    and mo.closed_at is null;
$$;

create or replace function public.assert_entry_date_allowed(p_date date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  month_row record;
  floor date;
  key text := public.month_key_for_date(p_date);
begin
  -- Lock this month's rows in every active group the writer belongs to so a
  -- concurrent confirm_month cannot close a month mid-write.
  for month_row in
    select mo.competition_id
    from public.months mo
    join public.competition_members m on m.competition_id = mo.competition_id
    where m.profile_id = auth.uid() and m.status = 'active'
      and mo.month_key = key
    order by mo.competition_id
  loop
    perform pg_advisory_xact_lock(
      hashtext('month:' || month_row.competition_id::text || ':' || key)
    );
  end loop;

  if p_date > public.my_today() then
    raise exception 'future_date_not_allowed';
  end if;

  -- Earliest date any of the writer's active memberships can score:
  -- min over groups of max(group start, join date).
  select min(greatest(c.starts_on, m.joined_at::date))
    into floor
    from public.competition_members m
    join public.competitions c on c.id = m.competition_id
    where m.profile_id = auth.uid()
      and m.status = 'active'
      and c.starts_on is not null;
  if floor is not null and p_date < floor then
    raise exception 'date_before_competition_start';
  end if;

  if exists (
    select 1 from public.months mo
    join public.competition_members m on m.competition_id = mo.competition_id
    where m.profile_id = auth.uid() and m.status = 'active'
      and mo.month_key = key
      and mo.closed_at is not null
  ) then
    raise exception 'month_already_closed';
  end if;
end;
$$;

create or replace function public.compute_month_results(
  p_competition_id uuid,
  p_month_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  comp record;
  member record;
  month_start date;
  month_end date;
  cutoff date;
  member_start date;
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
  extra_points numeric;
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
  perform public.assert_competition_member(p_competition_id);
  if p_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'invalid_month_key';
  end if;
  select * into comp from public.competitions where id = p_competition_id;
  if comp.id is null then
    raise exception 'competition_not_found';
  end if;

  month_start := (p_month_key || '-01')::date;
  month_end := (month_start + interval '1 month - 1 day')::date;
  cutoff := least(month_end, public.current_competition_date(p_competition_id));

  for member in
    select p.*, m.joined_at as member_joined_at
    from public.competition_members m
    join public.profiles p on p.id = m.profile_id
    where m.competition_id = p_competition_id and m.status = 'active'
    order by p.created_at, p.display_name
  loop
    workout_earned := 0;
    workout_target := 0;
    meal_planned := 0;
    free_used := 0;
    free_quota := 0;
    extra_points := 0;
    bonus := 0;
    streak := 0;

    member_start := greatest(coalesce(comp.starts_on, '9999-12-31'::date), member.member_joined_at::date);

    if comp.starts_on is null or cutoff < member_start then
      participants := participants || jsonb_build_object(
        'profileId', member.id,
        'name', member.display_name,
        'color', member.avatar_color,
        'noData', true,
        'base', 0,
        'bonus', 0,
        'extraPoints', 0,
        'total', 0,
        'streak', 0
      );
      continue;
    end if;

    eligible_start := greatest(month_start, member_start);
    eligible_end := least(month_end, cutoff);

    week_start := eligible_start - (extract(isodow from eligible_start)::int - 1);
    while week_start <= eligible_end loop
      segment_start := greatest(week_start, eligible_start);
      segment_end := least(week_start + 6, eligible_end);
      segment_days := segment_end - segment_start + 1;
      select * into plan from public.active_plan(member.id, week_start);

      if plan.id is not null then
        workout_target := workout_target + ceil(plan.workout_target * segment_days / 7.0)::int;
        select count(*) into workout_done
        from public.workout_entries
        where profile_id = member.id
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
    where e.profile_id = member.id
      and e.entry_date between eligible_start and eligible_end
      and e.status = 'met'
      and pv.id = (select ap.id from public.active_plan(member.id, e.entry_date) ap);

    select coalesce(sum(fe.count), 0) into free_used
    from public.free_meal_entries fe
    where fe.profile_id = member.id
      and fe.entry_date between eligible_start and eligible_end;
    select coalesce(ap.free_meals_per_month, 0) into free_quota
    from public.active_plan(member.id, eligible_end) ap;
    free_quota := coalesce(free_quota, 0);
    meal_planned := meal_planned + greatest(0, free_used - free_quota);

    select coalesce(sum(case ee.level when 1 then 0.5 when 2 then 1 else 2 end), 0) into extra_points
    from public.extra_entries ee
    where ee.profile_id = member.id
      and ee.entry_date between eligible_start and eligible_end;
    extra_points := least(6, extra_points);

    week_start := eligible_start - (extract(isodow from eligible_start)::int - 1);
    while week_start <= eligible_end loop
      if week_start >= member_start
        and week_start + 6 <= eligible_end
        and week_start + 6 between month_start and month_end
        and public.is_perfect_week(member.id, week_start) then
        bonus := least(10, bonus + 2);
      end if;
      week_start := week_start + 7;
    end loop;

    week_start := eligible_end - (extract(isodow from eligible_end)::int - 1);
    if extract(isodow from eligible_end) <> 7 then
      week_start := week_start - 7;
    end if;
    while week_start >= member_start and public.is_perfect_week(member.id, week_start) loop
      streak := streak + 1;
      week_start := week_start - 7;
    end loop;

    workout_ratio := case when workout_target = 0 then 0 else workout_earned::numeric / workout_target end;
    meal_ratio := case when meal_planned = 0 then 0 else meal_met::numeric / meal_planned end;
    base := round((workout_ratio * 50 + meal_ratio * 50)::numeric, 3);

    participants := participants || jsonb_build_object(
      'profileId', member.id,
      'name', member.display_name,
      'color', member.avatar_color,
      'noData', workout_target = 0 and meal_planned = 0,
      'base', base,
      'bonus', bonus,
      'extraPoints', extra_points,
      'total', base + bonus + extra_points,
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
    'timezone', comp.home_timezone,
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
    'profiles', coalesce((
      select jsonb_agg(row_to_json(p) order by p.created_at)
      from public.profiles p
      where p.id = uid or exists (
        select 1
        from public.competition_members mine
        join public.competition_members theirs
          on theirs.competition_id = mine.competition_id
        where mine.profile_id = uid and theirs.profile_id = p.id
      )
    ), '[]'::jsonb),
    'competitions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'inviteCode', c.invite_code,
        'homeTimezone', c.home_timezone,
        'startsOn', c.starts_on,
        'createdBy', c.created_by,
        'createdAt', c.created_at,
        'members', coalesce((
          select jsonb_agg(jsonb_build_object(
            'profileId', m.profile_id,
            'status', m.status,
            'joinedAt', m.joined_at
          ) order by m.joined_at)
          from public.competition_members m
          where m.competition_id = c.id
        ), '[]'::jsonb)
      ) order by c.created_at)
      from public.competitions c
      where exists (
        select 1 from public.competition_members me
        where me.competition_id = c.id and me.profile_id = uid
      )
    ), '[]'::jsonb),
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
      where pv.profile_id in (select public.visible_profile_ids(uid))
    ), '[]'::jsonb),
    'mealEntries', coalesce((
      select jsonb_agg(row_to_json(e) order by e.entry_date, e.meal_slot_id)
      from public.meal_entries e
      where e.profile_id in (select public.visible_profile_ids(uid))
    ), '[]'::jsonb),
    'workoutEntries', coalesce((
      select jsonb_agg(row_to_json(e) order by e.entry_date)
      from public.workout_entries e
      where e.profile_id in (select public.visible_profile_ids(uid))
    ), '[]'::jsonb),
    'freeMealEntries', coalesce((
      select jsonb_agg(row_to_json(e) order by e.entry_date)
      from public.free_meal_entries e
      where e.profile_id in (select public.visible_profile_ids(uid))
    ), '[]'::jsonb),
    'extraEntries', coalesce((
      select jsonb_agg(row_to_json(e) order by e.entry_date)
      from public.extra_entries e
      where e.profile_id in (select public.visible_profile_ids(uid))
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
      select jsonb_object_agg(t.competition_id, t.comp_months)
      from (
        select m.competition_id, jsonb_object_agg(m.month_key, row_to_json(m)) as comp_months
        from public.months m
        where exists (
          select 1 from public.competition_members me
          where me.competition_id = m.competition_id and me.profile_id = uid
        )
        group by m.competition_id
      ) t
    ), '{}'::jsonb)
  ) into result;
  return result;
end;
$$;

-- Starts a group once every active member finished their plan setup.
create or replace function public.maybe_start_competition(p_competition_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.competitions c
  set starts_on = (now() at time zone c.home_timezone)::date
  where c.id = p_competition_id
    and c.starts_on is null
    and exists (
      select 1 from public.competition_members m
      where m.competition_id = c.id and m.status = 'active'
    )
    and not exists (
      select 1
      from public.competition_members m
      join public.profiles p on p.id = m.profile_id
      where m.competition_id = c.id
        and m.status = 'active'
        and p.configured_at is null
    );
$$;

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
  if p_timezone is not null and not exists (
    select 1 from pg_timezone_names where name = p_timezone
  ) then
    raise exception 'invalid_timezone';
  end if;

  -- "Today" for plan effectiveness: the caller's first active group timezone,
  -- or their chosen timezone when they are not in any group yet.
  today := coalesce(
    (select (now() at time zone c.home_timezone)::date
     from public.competition_members m
     join public.competitions c on c.id = m.competition_id
     where m.profile_id = uid and m.status = 'active'
     order by c.created_at
     limit 1),
    (now() at time zone coalesce(p_timezone, 'UTC'))::date
  );
  effective := today - (extract(isodow from today)::int - 1);
  if exists (select 1 from public.plan_versions where profile_id = uid)
    and exists (
      select 1
      from public.competition_members m
      join public.competitions c on c.id = m.competition_id
      where m.profile_id = uid and m.status = 'active'
        and c.starts_on is not null
        and (now() at time zone c.home_timezone)::date >= c.starts_on
    ) then
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

  perform public.maybe_start_competition(m.competition_id)
  from public.competition_members m
  where m.profile_id = uid and m.status = 'active';

  return public.get_dashboard();
end;
$$;

drop function public.confirm_month(text);

create or replace function public.confirm_month(
  p_competition_id uuid,
  p_month_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid;
  comp record;
  month_row public.months;
  month_start date;
  active_count integer;
begin
  uid := public.assert_competition_member(p_competition_id);
  select * into comp from public.competitions where id = p_competition_id;
  if comp.id is null then
    raise exception 'competition_not_found';
  end if;
  if p_month_key !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'invalid_month_key';
  end if;
  month_start := (p_month_key || '-01')::date;
  if month_start + interval '1 month' > public.current_competition_date(p_competition_id) then
    raise exception 'month_not_finished';
  end if;
  if comp.starts_on is not null and month_start + interval '1 month - 1 day' < comp.starts_on then
    raise exception 'month_before_competition_start';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('month:' || p_competition_id::text || ':' || p_month_key)
  );

  insert into public.months (competition_id, month_key)
  values (p_competition_id, p_month_key)
  on conflict (competition_id, month_key) do nothing;

  select * into month_row from public.months
  where competition_id = p_competition_id and month_key = p_month_key
  for update;
  if month_row.closed_at is not null then
    return to_jsonb(month_row);
  end if;

  if not uid = any(month_row.confirmed_by) then
    month_row.confirmed_by := array_append(month_row.confirmed_by, uid);
  end if;

  select count(*) into active_count
  from public.competition_members
  where competition_id = p_competition_id and status = 'active';
  if array_length(month_row.confirmed_by, 1) >= active_count then
    month_row.result := public.compute_month_results(p_competition_id, p_month_key);
    month_row.closed_at := now();
  end if;
  month_row.updated_at := now();

  update public.months
  set confirmed_by = month_row.confirmed_by,
      closed_at = month_row.closed_at,
      result = month_row.result,
      updated_at = month_row.updated_at
  where competition_id = p_competition_id and month_key = p_month_key
  returning * into month_row;

  return to_jsonb(month_row);
end;
$$;

create or replace function public.create_competition(
  p_mutation_id uuid,
  p_name text,
  p_timezone text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid;
  comp_id uuid;
begin
  uid := public.assert_profile_member();
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'create_competition') then
    return public.get_dashboard();
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 40 then
    raise exception 'invalid_competition_name';
  end if;
  if p_timezone is null or not exists (
    select 1 from pg_timezone_names where name = p_timezone
  ) then
    raise exception 'invalid_timezone';
  end if;
  if (
    select count(*) from public.competition_members
    where profile_id = uid
  ) >= 3 then
    raise exception 'competition_limit';
  end if;

  insert into public.competitions (name, invite_code, home_timezone, created_by)
  values (trim(p_name), public.generate_invite_code(), p_timezone, uid)
  returning id into comp_id;

  insert into public.competition_members (competition_id, profile_id, status)
  values (comp_id, uid, 'active');

  perform public.maybe_start_competition(comp_id);
  return public.get_dashboard();
end;
$$;

create or replace function public.join_competition(
  p_mutation_id uuid,
  p_code text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid;
  comp record;
  member_count integer;
begin
  uid := public.assert_profile_member();
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'join_competition') then
    return public.get_dashboard();
  end if;

  select * into comp
  from public.competitions
  where invite_code = upper(trim(coalesce(p_code, '')));
  if comp.id is null then
    raise exception 'invite_code_invalid';
  end if;
  if exists (
    select 1 from public.competition_members
    where competition_id = comp.id and profile_id = uid
  ) then
    return public.get_dashboard();
  end if;

  perform pg_advisory_xact_lock(hashtext('comp:' || comp.id::text));
  select count(*) into member_count
  from public.competition_members
  where competition_id = comp.id;
  if member_count >= 5 then
    raise exception 'competition_full';
  end if;
  if (
    select count(*) from public.competition_members
    where profile_id = uid
  ) >= 3 then
    raise exception 'competition_limit';
  end if;

  insert into public.competition_members (competition_id, profile_id, status)
  values (comp.id, uid, 'active');

  perform public.maybe_start_competition(comp.id);
  return public.get_dashboard();
end;
$$;

create or replace function public.leave_competition(
  p_mutation_id uuid,
  p_competition_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := public.assert_competition_member(p_competition_id);
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'leave_competition') then
    return public.get_dashboard();
  end if;

  delete from public.competition_members
  where competition_id = p_competition_id and profile_id = uid;

  delete from public.competitions c
  where c.id = p_competition_id
    and not exists (
      select 1 from public.competition_members m
      where m.competition_id = c.id
    );
  return public.get_dashboard();
end;
$$;

create or replace function public.regenerate_invite_code(
  p_mutation_id uuid,
  p_competition_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := public.assert_competition_member(p_competition_id);
  if not public.assert_mutation_fresh(p_mutation_id, uid, 'regenerate_invite_code') then
    return public.get_dashboard();
  end if;

  update public.competitions
  set invite_code = public.generate_invite_code()
  where id = p_competition_id;
  return public.get_dashboard();
end;
$$;

drop function public.compute_month_results(text);

grant execute on function public.generate_invite_code() to authenticated;
grant execute on function public.shares_active_competition(uuid) to authenticated;
grant execute on function public.is_competition_member(uuid) to authenticated;
grant execute on function public.current_competition_date(uuid) to authenticated;
grant execute on function public.my_today() to authenticated;
grant execute on function public.assert_competition_member(uuid) to authenticated;
grant execute on function public.visible_profile_ids(uuid) to authenticated;
grant execute on function public.compute_month_results(uuid, text) to authenticated;
grant execute on function public.get_dashboard() to authenticated;
grant execute on function public.save_plan(uuid, text, text, integer, integer, jsonb) to authenticated;
grant execute on function public.confirm_month(uuid, text) to authenticated;
grant execute on function public.create_competition(uuid, text, text) to authenticated;
grant execute on function public.join_competition(uuid, text) to authenticated;
grant execute on function public.leave_competition(uuid, uuid) to authenticated;
grant execute on function public.regenerate_invite_code(uuid, uuid) to authenticated;
