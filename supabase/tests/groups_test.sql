begin;

select plan(12);

-- Seed state: ana+leo in 'aaaaaaaa' (POWER1), leo+max in 'bbbbbbbb' (DUFF21).

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.profiles),
  2,
  'max only sees profiles from his group (leo + self)'
);

select is(
  (select count(*)::int from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  0,
  'max cannot see ana even though she exists in another group'
);

select is(
  (select jsonb_array_length(get_dashboard()->'competitions')),
  1,
  'dashboard returns only the caller groups'
);

select throws_ok(
  $$select public.join_competition('d0000000-0000-0000-0000-000000000001', 'XXXXXX')$$,
  'invite_code_invalid',
  'joining with a bad barrita is rejected'
);

-- ana joins max group via code
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.join_competition('d0000000-0000-0000-0000-000000000002', 'DUFF21') is not null as ana_joins;

select is(
  (select count(*)::int from public.competition_members
    where competition_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  3,
  'joining adds the member to the group'
);

select is(
  (select jsonb_array_length(get_dashboard()->'competitions')),
  2,
  'joined group appears in the dashboard'
);

-- group of 5: create a comp and fill it with fake users
reset role;
do $$
declare
  new_comp uuid;
  i int;
begin
  insert into public.competitions (id, name, invite_code, home_timezone, created_by)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Llena', 'LLENA1', 'UTC', '11111111-1111-1111-1111-111111111111')
  returning id into new_comp;

  for i in 1..4 loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000',
      ('44444444-4444-4444-4444-44444444444' || i)::uuid,
      'authenticated', 'authenticated', 'extra' || i || '@ungim.test',
      crypt('donuts123', gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}'
    );
    insert into public.competition_members (competition_id, profile_id)
    values (new_comp, ('44444444-4444-4444-4444-44444444444' || i)::uuid);
  end loop;
  insert into public.competition_members (competition_id, profile_id)
  values (new_comp, '22222222-2222-2222-2222-222222222222');
end $$;

select is(
  (select count(*)::int from public.competition_members
    where competition_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  5,
  'the group holds five members'
);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select throws_ok(
  $$select public.join_competition(
    'd0000000-0000-0000-0000-000000000003',
    'LLENA1'
  )$$,
  'competition_full',
  'a sixth member is rejected'
);

-- leave
select public.leave_competition(
  'd0000000-0000-0000-0000-000000000004',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
) is not null as max_leaves;

select is(
  (select count(*)::int from public.competition_members
    where competition_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      and profile_id = '33333333-3333-3333-3333-333333333333'),
  0,
  'leaving removes the membership'
);

-- regenerate invite code
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.regenerate_invite_code(
  'd0000000-0000-0000-0000-000000000005',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
) is not null as code_regenerated;

select isnt(
  (select invite_code from public.competitions
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'POWER1',
  'regenerating replaces the barrita'
);

-- max 3 competitions per person: ana is in aaaa + bbbb, one more fills her quota
select public.create_competition(
  'd0000000-0000-0000-0000-000000000006',
  'Tercera',
  'UTC'
) is not null as ana_creates_third;

select throws_ok(
  $$select public.create_competition(
    'd0000000-0000-0000-0000-000000000007',
    'Cuarta',
    'UTC'
  )$$,
  'competition_limit',
  'a fourth competition is rejected'
);

reset role;
insert into public.competitions (id, name, invite_code, home_timezone, created_by)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Otra', 'OTRA01', 'UTC', '22222222-2222-2222-2222-222222222222');
insert into public.competition_members (competition_id, profile_id)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_ok(
  $$select public.join_competition('d0000000-0000-0000-0000-000000000008', 'OTRA01')$$,
  'competition_limit',
  'joining a fourth competition is rejected'
);

select finish();
rollback;
