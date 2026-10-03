begin;

select plan(8);

do $$
declare
  plan_id uuid;
  slot_id uuid;
begin
  insert into public.plan_versions (id, profile_id, effective_week_start, workout_target)
  values (
    '66666666-6666-6666-6666-666666666666',
    '22222222-2222-2222-2222-222222222222',
    current_date - (extract(isodow from current_date)::int - 1),
    2
  )
  on conflict (profile_id, effective_week_start)
  do update set workout_target = excluded.workout_target
  returning id into plan_id;

  insert into public.meal_slots (plan_version_id, name, rule, position)
  values (plan_id, 'Desayuno', 'Plan', 1)
  on conflict (plan_version_id, position)
  do update set name = excluded.name
  returning id into slot_id;

  perform set_config('ungim.test_slot_id', slot_id::text, true);
end $$;

select has_table('public', 'profiles', 'profiles exist');
select has_function('public', 'compute_month_results', array['text'], 'month results function exists');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.profiles),
  2,
  'authenticated member can read exactly two profiles'
);

select throws_ok(
  $$insert into public.meal_entries (profile_id, meal_slot_id, entry_date, status)
    values ('11111111-1111-1111-1111-111111111111', gen_random_uuid(), current_date, 'met')$$,
  'permission denied for table meal_entries',
  'direct meal entry writes stay blocked'
);

select throws_ok(
  $$select public.clear_meal_entry(
    '55555555-5555-5555-5555-555555555555',
    current_date,
    current_setting('ungim.test_slot_id')::uuid,
    0
  )$$,
  'meal_slot_not_found',
  'one member cannot clear another member meal slot'
);

select set_config('request.jwt.claims', '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.profiles),
  0,
  'an authenticated non-member cannot read household profiles'
);

reset role;

select is(
  (select public.compute_month_results(to_char(now(), 'YYYY-MM'))->>'monthKey'),
  to_char(now(), 'YYYY-MM'),
  'month score snapshot is reproducible'
);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_ok(
  $$select public.confirm_month(to_char(now(), 'YYYY-MM'))$$,
  'month_not_finished',
  'current month cannot be closed early'
);

select finish();
rollback;
