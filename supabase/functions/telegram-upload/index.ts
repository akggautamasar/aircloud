
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

    // Get user's Telegram config
    const { data: config, error: configError } = await supabaseClient
      .from('user_telegram_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (configError || !config) {
      throw new Error('Telegram not configured')
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      throw new Error('No file provided')
    }

    // Prepare file for Telegram upload
    const telegramFormData = new FormData()
    telegramFormData.append('chat_id', config.channel_id)
    telegramFormData.append('document', file)
    telegramFormData.append('caption', `📎 ${file.name}\n💾 Size: ${(file.size / 1024 / 1024).toFixed(2)} MB\n⏰ Uploaded: ${new Date().toLocaleString()}`)

    // Upload to Telegram
    const telegramUrl = `https://api.telegram.org/bot${config.bot_token}/sendDocument`
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      body: telegramFormData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Telegram upload failed: ${error.description}`)
    }

    const result = await response.json()
    const telegramFile = result.result.document

    // Save file metadata to database
    const { error: dbError } = await supabaseClient
      .from('telegram_files')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || 'unknown',
        telegram_file_id: telegramFile.file_id,
        telegram_message_id: result.result.message_id,
        channel_id: config.channel_id,
      })

    if (dbError) {
      console.error('Database error:', dbError)
      // Don't fail the request if DB save fails, file is already uploaded
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        fileId: telegramFile.file_id,
        messageId: result.result.message_id,
        fileName: file.name,
        fileSize: file.size
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Upload error:', error)
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
