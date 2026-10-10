// Invite someone without an account to a Cumbre by email.
// Validates the caller is an active member and the group has room,
// then sends a Supabase invite whose link carries the barrita code.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { competition_id, email, redirect_to } = await req.json()
    if (
      typeof competition_id !== 'string' ||
      typeof email !== 'string' ||
      !emailPattern.test(email.trim())
    ) {
      return json({ error: 'invite_invalid' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const jwt = req.headers.get('Authorization') ?? ''

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: jwt } }
    })
    const {
      data: { user },
      error: userError
    } = await caller.auth.getUser()
    if (userError || !user) return json({ error: 'invite_invalid' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: competition } = await admin
      .from('competitions')
      .select('id, name, invite_code')
      .eq('id', competition_id)
      .maybeSingle()
    if (!competition) return json({ error: 'competition_not_found' }, 404)

    const { data: membership } = await admin
      .from('competition_members')
      .select('profile_id')
      .eq('competition_id', competition_id)
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!membership) return json({ error: 'not_a_competition_member' }, 403)

    const { count } = await admin
      .from('competition_members')
      .select('profile_id', { count: 'exact', head: true })
      .eq('competition_id', competition_id)
    if ((count ?? 0) >= 5) return json({ error: 'competition_full' }, 400)

    const target = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const joinCode = competition.invite_code as string
    const origin =
      typeof redirect_to === 'string' && redirect_to.startsWith('http')
        ? redirect_to.replace(/\/$/, '')
        : Deno.env.get('SITE_URL') ?? ''
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      target,
      {
        redirectTo: `${origin}/app?join=${joinCode}`,
        data: {
          join_code: joinCode,
          cumbre: competition.name
        }
      }
    )

    if (inviteError) {
      const already = /already been registered|already registered/i.test(
        inviteError.message
      )
      if (already) return json({ status: 'existing_user' })
      return json({ error: 'invite_failed' }, 500)
    }

    return json({ status: 'sent' })
  } catch {
    return json({ error: 'invite_failed' }, 500)
  }
})
