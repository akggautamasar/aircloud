
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Expose-Headers': 'content-range, content-length, accept-ranges',
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

    // Parse request body
    const body = await req.json()
    const { fileId, fileName } = body
    
    if (!fileId) {
      throw new Error('No file ID provided')
    }

    console.log(`Processing file: ${fileName} (${fileId})`)

    // Get file info from Telegram
    const fileInfoUrl = `https://api.telegram.org/bot${config.bot_token}/getFile?file_id=${fileId}`
    const fileInfoResponse = await fetch(fileInfoUrl)

    if (!fileInfoResponse.ok) {
      console.error('Telegram getFile error:', await fileInfoResponse.text())
      throw new Error('Failed to get file info from Telegram')
    }

    const fileInfo = await fileInfoResponse.json()
    
    if (!fileInfo.ok) {
      throw new Error(fileInfo.description || 'Failed to get file info')
    }
    
    const filePath = fileInfo.result.file_path
    const fileSize = fileInfo.result.file_size || 0
    
    if (!filePath) {
      throw new Error('File path not available')
    }

    const downloadUrl = `https://api.telegram.org/file/bot${config.bot_token}/${filePath}`
    
    console.log(`File size: ${fileSize}, Download URL: ${downloadUrl}`)

    // Return streaming response for all files
    return new Response(
      JSON.stringify({ 
        success: true,
        isStreamUrl: true,
        streamUrl: downloadUrl,
        fileName: fileName,
        fileSize: fileSize,
        message: 'Streaming URL provided'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Download error:', error)
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
