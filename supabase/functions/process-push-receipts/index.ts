import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Expo, ExpoPushReceipt } from 'npm:expo-server-sdk@3.7.0'

const expo = new Expo({ accessToken: Deno.env.get('EXPO_ACCESS_TOKEN') })
const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (_req: Request) => {
    try {
        // 1. Fetch pending tickets from the log table
        const { data: pendingTickets, error: fetchError } = await supabaseAdmin
            .from('push_tickets_log')
            .select('ticket_id, original_expo_push_token')
            .eq('status', 'pending_receipt')
        // Optional: Process in batches to avoid overwhelming the function
        // .limit(100)

        if (fetchError) throw fetchError
        if (!pendingTickets || pendingTickets.length === 0) {
            return new Response('No pending tickets to process.', { status: 200 })
        }

        // 2. Get receipts from Expo
        const receiptIds = pendingTickets.map((t) => t.ticket_id)
        const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds)
        let allReceipts: { [id: string]: ExpoPushReceipt } = {}

        for (const chunk of receiptIdChunks) {
            try {
                const receipts = await expo.getPushNotificationReceiptsAsync(chunk)
                allReceipts = { ...allReceipts, ...receipts }
            } catch (error) {
                console.error('Error fetching push receipts chunk:', error)
            }
        }

        // 3. Process the receipts and update your database
        const tokensToDeactivate: string[] = []

        for (const ticket of pendingTickets) {
            const receipt = allReceipts[ticket.ticket_id]

            if (receipt) {
                if (receipt.status === 'ok') {
                    // The notification was successfully delivered to the push service
                    await supabaseAdmin
                        .from('push_tickets_log')
                        .update({ status: 'ok', updated_at: 'now()' })
                        .eq('ticket_id', ticket.ticket_id)
                } else if (receipt.status === 'error') {
                    console.error(`Receipt error for ticket ${ticket.ticket_id}:`, receipt.message)

                    // CRITICAL PART: Check for 'DeviceNotRegistered'
                    if (receipt.details?.error === 'DeviceNotRegistered') {
                        // This token is invalid and should be removed
                        tokensToDeactivate.push(ticket.original_expo_push_token)
                    }

                    // Update the log with the error status and details
                    await supabaseAdmin
                        .from('push_tickets_log')
                        .update({ status: 'error', error_details: receipt.details, updated_at: 'now()' })
                        .eq('ticket_id', ticket.ticket_id)
                }
            }
        }

        // 4. Batch-delete the invalid tokens from your main user_push_tokens table
        if (tokensToDeactivate.length > 0) {
            console.log('Deactivating invalid tokens:', tokensToDeactivate)
            // We use `delete` here, but you could also set the token field to NULL
            const { error: deleteError } = await supabaseAdmin
                .from('user_push_tokens')
                .delete()
                .in('push_token', tokensToDeactivate)

            if (deleteError) {
                console.error('Failed to deactivate tokens:', deleteError)
            }
        }

        return new Response(`Processed ${pendingTickets.length} tickets. Deactivated ${tokensToDeactivate.length} tokens.`, { status: 200 })

    } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 })
    }
})