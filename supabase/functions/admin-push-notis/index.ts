import { corsHeaders } from 'shared/cors.ts';
import { sendNotificationsForPost } from 'shared/post-noti.ts';
import { createClient } from 'supabase-js';
import { PostPayload } from "shared/types.ts";

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
        
        const { data: userRow, error: userRowError } = await userClient
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

        if (userRowError) {
            throw new Error('Could not fetch user userRow.')
        }
        
        if (userRow?.role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Permission denied: User is not an admin.' }), { status: 403, headers: corsHeaders })
        }
        
        // ----- USER VERIFIED AS ADMIN -----
        const { record }: { record: PostPayload } = await req.json();
        return await sendNotificationsForPost(record)

    } catch (error) {
        console.error('Error processing request:', error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});