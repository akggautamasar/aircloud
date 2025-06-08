
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

    // Parse request body
    const body = await req.json()
    const { fileId, fileName } = body
    
    if (!fileId) {
      throw new Error('No file ID provided')
    }

    console.log(`Processing file: ${fileName} (${fileId})`)

    // For Telegram files, we'll always use the direct streaming URL
    // This bypasses Telegram's getFile API limitations for large files
    const streamUrl = `https://api.telegram.org/file/bot${config.bot_token}/${fileId}`
    
    // Test if the file is accessible by making a HEAD request
    try {
      const testResponse = await fetch(streamUrl, { method: 'HEAD' })
      if (testResponse.ok) {
        console.log(`File accessible via direct stream URL`)
        return new Response(
          JSON.stringify({ 
            success: true,
            isStreamUrl: true,
            streamUrl: streamUrl,
            fileName: fileName,
            message: 'Using direct stream URL'
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        )
      }
    } catch (streamError) {
      console.log('Direct stream failed, trying getFile API')
    }

    // If direct stream fails, try the getFile API for smaller files
    const fileInfoUrl = `https://api.telegram.org/bot${config.bot_token}/getFile?file_id=${fileId}`
    const fileInfoResponse = await fetch(fileInfoUrl)

    if (!fileInfoResponse.ok) {
      const errorText = await fileInfoResponse.text()
      console.error('Telegram getFile error:', errorText)
      
      // If getFile fails, still try to return the direct stream URL
      return new Response(
        JSON.stringify({ 
          success: true,
          isStreamUrl: true,
          streamUrl: streamUrl,
          fileName: fileName,
          message: 'Using fallback stream URL'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    const fileInfo = await fileInfoResponse.json()
    
    if (!fileInfo.ok) {
      // Return stream URL as fallback
      return new Response(
        JSON.stringify({ 
          success: true,
          isStreamUrl: true,
          streamUrl: streamUrl,
          fileName: fileName,
          message: 'Using stream URL due to API limitations'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }
    
    const filePath = fileInfo.result.file_path
    if (!filePath) {
      throw new Error('File path not available')
    }

    const fileSize = fileInfo.result.file_size || 0
    
    // For files larger than 5MB, use streaming
    if (fileSize > 5 * 1024 * 1024) {
      const fullStreamUrl = `https://api.telegram.org/file/bot${config.bot_token}/${filePath}`
      return new Response(
        JSON.stringify({ 
          success: true,
          isStreamUrl: true,
          streamUrl: fullStreamUrl,
          fileName: fileName,
          fileSize: fileSize,
          message: 'Large file, using streaming URL'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    // Download smaller files directly
    const downloadUrl = `https://api.telegram.org/file/bot${config.bot_token}/${filePath}`
    const downloadResponse = await fetch(downloadUrl)

    if (!downloadResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${downloadResponse.status}`)
    }

    const fileData = await downloadResponse.arrayBuffer()
    
    if (fileData.byteLength === 0) {
      throw new Error('Downloaded file is empty')
    }

    // Convert to base64
    const bytes = new Uint8Array(fileData)
    const chunkSize = 8192
    let binary = ''
    
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize)
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    
    const base64Data = btoa(binary)

    console.log(`File downloaded successfully, size: ${fileData.byteLength} bytes`)

    return new Response(
      JSON.stringify({ 
        success: true,
        fileData: base64Data,
        fileName: fileName,
        fileSize: fileData.byteLength
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
