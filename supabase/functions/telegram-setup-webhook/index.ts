
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get user from auth
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const body = await req.json()
    const { botToken } = body
    
    if (!botToken) {
      throw new Error('Bot token is required')
    }

    console.log('Setting up webhook for bot token:', botToken.substring(0, 10) + '...')

    // Set webhook URL to our Supabase edge function
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-webhook`
    
    const telegramUrl = `https://api.telegram.org/bot${botToken}/setWebhook`
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'channel_post'], // Allow both private messages and channel posts
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Telegram webhook setup error:', errorText)
      throw new Error(`Failed to set webhook: ${errorText}`)
    }

    const result = await response.json()
    console.log('Webhook setup result:', result)
    
    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Webhook set up successfully',
        webhookUrl: webhookUrl
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Webhook setup error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
