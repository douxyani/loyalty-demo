import { corsHeaders } from '../_shared/cors.ts';
import { sendNotificationsForPost } from '../_shared/post-noti.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        
        const userClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )
        
        const { data: { user }, error: userError } = await userClient.auth.getUser()
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Authentication failed' }), { status: 401, headers: corsHeaders })
        }
        
        const { data: profile, error: profileError } = await userClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        
        if (profileError) {
            throw new Error('Could not fetch user profile.')
        }
        
        if (profile?.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Permission denied: User is not an admin.' }), { status: 403, headers: corsHeaders })
        }
        
        // ----- USER VERIFIED AS ADMIN -----
        return await sendNotificationsForPost(req)

    } catch (error) {
        console.error('Error processing request:', error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/push-notis' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
