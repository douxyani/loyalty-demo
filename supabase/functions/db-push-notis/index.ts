import { corsHeaders } from 'shared/cors.ts';
import { sendNotificationsForPost } from 'shared/post-noti.ts';
import { PostPayload } from "shared/types.ts";

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // ----- USER VERIFIED AS ADMIN -----
         const { record }: { record: PostPayload } = await req.json()
        return await sendNotificationsForPost(record)

    } catch (error) {
        console.error('Error processing request:', error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});