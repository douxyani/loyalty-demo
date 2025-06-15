import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Expo, ExpoPushMessage } from 'npm:expo-server-sdk@3.7.0'
import { corsHeaders } from './cors.ts';

interface PostPayload {
    id: string;
    title: string;
    details: string;
}

interface TicketData {
    ticket_id: string; // ExpoPushReceiptId is essentially a string
    post_id: string;      // To associate with the content
    status: 'pending_receipt' | 'error' | 'ok'; // Initial status
    original_expo_push_token: string; // Optional, to link back to the original token
    error_details?: string; // Optional, for error details if any
}

// Initialize Expo SDK
const expo = new Expo({ accessToken: Deno.env.get('EXPO_ACCESS_TOKEN') });
const supabaseAdminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Function to save push tickets to the database for later receipt checking
async function savePushTickets(tickets: TicketData[], postId: string) {
    const recordsToInsert = tickets
        .filter(ticket => ticket.ticket_id) // Only save tickets with IDs
        .map(ticket => ({
            ticket_id: ticket.ticket_id, // ExpoPushReceiptId is essentially a string
            post_id: postId,      // To associate with the content
            status: 'pending_receipt', // Initial status
            original_expo_push_token: ticket.original_expo_push_token, // Link back to the original token
        }));

    if (recordsToInsert.length > 0) {
        // Assume you have a 'push_tickets_log' table
        const { error } = await supabaseAdminClient
            .from('push_tickets_log')
            .insert(recordsToInsert);
        if (error) console.error('Error saving push tickets:', error);
        else console.log(`${recordsToInsert.length} push tickets saved for post ${postId}`);
    }
}

export async function sendNotificationsForPost(
    req: Request,
) {
    const { record: { id, title, details } }: { record: PostPayload } = await req.json();

    const { data: tokensData, error: tokensError } = await supabaseAdminClient
        .from('user_push_tokens')
        .select('push_token');

    if (tokensError) throw tokensError;
    if (!tokensData || tokensData.length === 0) {
        console.log('No push tokens found.');
        return new Response(JSON.stringify({ message: 'No push tokens to send to.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const messages: ExpoPushMessage[] = [];
    for (const userToken of tokensData) {
        if (!Expo.isExpoPushToken(userToken.push_token)) {
            console.warn(`Push token ${userToken.push_token} is not a valid Expo push token`);
            continue;
        }
        messages.push({
            to: userToken.push_token,
            sound: 'default',
            title: `${title}`,
            body: details || 'A new post has been published!',
            data: { postId: id, type: 'new_post' },
        });
    }

    if (messages.length === 0) {
        console.log('No valid push tokens to send to.');
        return new Response(JSON.stringify({ message: 'No valid push tokens.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const chunks = expo.chunkPushNotifications(messages);
    const tickets: TicketData[] = [];
    const tokensToDeleteImmediately: string[] = [];
    const sendPromises = chunks.map(async (chunk) => {
        try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

            ticketChunk.forEach((ticket, index) => {
                const originalMessage = chunk[index];
                if (!originalMessage || !originalMessage.to) {
                    return;
                }

                const tokens = Array.isArray(originalMessage.to)
                    ? originalMessage.to
                    : [originalMessage.to];

                for (const token of tokens) {
                    if (ticket.status === 'ok') {
                        tickets.push({
                            ticket_id: ticket.id,
                            post_id: id,
                            status: 'pending_receipt',
                            original_expo_push_token: token,
                        })
                    } else if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                        tokensToDeleteImmediately.push(token);
                    }
                }
            })
        } catch (error) {
            console.error('Error sending push notification chunk:', error);
            // Collect or log errors for chunks that failed to send
        }
    });

    await Promise.all(sendPromises);

    console.log('Push notification tickets:', tickets);
    await savePushTickets(tickets, id);

    if (tokensToDeleteImmediately.length > 0) {
        console.log(`Deleting ${tokensToDeleteImmediately.length} invalid tokens.`);
        const { error: deleteError } = await supabaseAdminClient
            .from('user_push_tokens')
            .delete()
            .in('push_token', tokensToDeleteImmediately);

        if (deleteError) {
            console.error('Error deleting invalid tokens:', deleteError);
        }
    }

    return new Response(JSON.stringify({ success: true, tickets: tickets }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}