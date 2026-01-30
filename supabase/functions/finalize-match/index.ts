import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.0';

serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { teamMatchId } = await req.json();
    if (!teamMatchId) throw new Error('Missing teamMatchId');

    // Get the team match
    const { data: teamMatch, error: matchError } = await supabaseAdmin
      .from('team_matches')
      .select('*')
      .eq('id', teamMatchId)
      .single();

    if (matchError || !teamMatch) throw new Error('Team match not found');
    if (teamMatch.is_finalized) throw new Error('Match is already finalized');

    // Get all individual matches
    const { data: individualMatches, error: indError } = await supabaseAdmin
      .from('individual_matches')
      .select('*')
      .eq('team_match_id', teamMatchId)
      .order('match_order');

    if (indError) throw indError;

    // Verify all 5 individual matches are completed
    if (!individualMatches || individualMatches.length < 5) {
      throw new Error(`Only ${individualMatches?.length ?? 0} of 5 individual matches found`);
    }

    const incomplete = individualMatches.filter(m => !m.is_completed);
    if (incomplete.length > 0) {
      throw new Error(`${incomplete.length} individual match(es) not yet completed`);
    }

    // Calculate total points
    let homePoints = 0;
    let awayPoints = 0;

    for (const match of individualMatches) {
      homePoints += match.home_points_earned;
      awayPoints += match.away_points_earned;
    }

    // Finalize the match using the DB function
    const { error: finalizeError } = await supabaseAdmin.rpc('finalize_team_match', {
      p_team_match_id: teamMatchId,
      p_home_points: homePoints,
      p_away_points: awayPoints,
    });

    if (finalizeError) throw finalizeError;

    // Release scorecard lock if exists
    await supabaseAdmin
      .from('scorecard_sessions')
      .update({ is_active: false })
      .eq('team_match_id', teamMatchId);

    // Create audit log entry
    await supabaseAdmin.from('audit_log').insert({
      actor_id: user.id,
      action: 'finalize',
      table_name: 'team_matches',
      record_id: teamMatchId,
      new_values: { home_points: homePoints, away_points: awayPoints },
      metadata: {
        individual_matches: individualMatches.map(m => ({
          match_order: m.match_order,
          home_points: m.home_points_earned,
          away_points: m.away_points_earned,
        })),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        homePoints,
        awayPoints,
        winner: homePoints > awayPoints ? 'home' : homePoints < awayPoints ? 'away' : 'tie',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
