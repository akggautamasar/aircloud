
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

    console.log(`Downloading file: ${fileName} (${fileId})`)

    // For large files, we'll return a streaming URL instead of downloading the file
    // First check if file is too big by trying to get file info
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout for file info

    const fileInfoUrl = `https://api.telegram.org/bot${config.bot_token}/getFile?file_id=${fileId}`
    const fileInfoResponse = await fetch(fileInfoUrl, {
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)

    if (!fileInfoResponse.ok) {
      const errorText = await fileInfoResponse.text()
      console.error('Telegram getFile error:', errorText)
      
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.description?.includes('file is too big')) {
          // For large files, return a streaming URL
          const streamUrl = `https://api.telegram.org/file/bot${config.bot_token}/${fileId}`
          return new Response(
            JSON.stringify({ 
              success: true,
              isStreamUrl: true,
              streamUrl: streamUrl,
              fileName: fileName,
              message: 'File is large, using streaming URL'
            }),
            { 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json' 
              } 
            }
          )
        }
        if (errorData.description?.includes('Bad Request')) {
          throw new Error(`File not found or access denied: ${errorData.description}`)
        }
      } catch (parseError) {
        // If we can't parse the error, use the raw text
      }
      
      throw new Error(`Failed to get file info: ${errorText}`)
    }

    const fileInfo = await fileInfoResponse.json()
    
    if (!fileInfo.ok) {
      if (fileInfo.description?.includes('file is too big')) {
        // For large files, return a streaming URL
        const streamUrl = `https://api.telegram.org/file/bot${config.bot_token}/${fileId}`
        return new Response(
          JSON.stringify({ 
            success: true,
            isStreamUrl: true,
            streamUrl: streamUrl,
            fileName: fileName,
            message: 'File is large, using streaming URL'
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        )
      }
      throw new Error(`Telegram API error: ${fileInfo.description}`)
    }
    
    const filePath = fileInfo.result.file_path
    if (!filePath) {
      throw new Error('File path not available')
    }

    const fileSize = fileInfo.result.file_size || 0
    
    // If file is larger than 20MB, use streaming
    if (fileSize > 20 * 1024 * 1024) {
      const streamUrl = `https://api.telegram.org/file/bot${config.bot_token}/${filePath}`
      return new Response(
        JSON.stringify({ 
          success: true,
          isStreamUrl: true,
          streamUrl: streamUrl,
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
    const downloadController = new AbortController()
    const downloadTimeoutId = setTimeout(() => downloadController.abort(), 30000) // 30 second timeout

    const downloadUrl = `https://api.telegram.org/file/bot${config.bot_token}/${filePath}`
    const downloadResponse = await fetch(downloadUrl, {
      signal: downloadController.signal
    })
    
    clearTimeout(downloadTimeoutId)

    if (!downloadResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${downloadResponse.status} ${downloadResponse.statusText}`)
    }

    const fileData = await downloadResponse.arrayBuffer()
    
    if (fileData.byteLength === 0) {
      throw new Error('Downloaded file is empty')
    }

    // Convert to base64 for transport with better memory handling
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
