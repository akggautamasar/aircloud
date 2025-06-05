
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { botToken, channelId, userId } = await req.json()

    if (!botToken || !channelId || !userId) {
      throw new Error('Missing required parameters')
    }

    // Test if bot can send messages to the channel
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
    
    const testMessage = {
      chat_id: channelId,
      text: '✅ TeleCloud integration test successful! Your channel is ready to store files.',
      parse_mode: 'HTML'
    }

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Telegram API error: ${error.description || 'Unknown error'}`)
    }

    const result = await response.json()

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Configuration test successful',
        messageId: result.result.message_id 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error testing Telegram config:', error)
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
