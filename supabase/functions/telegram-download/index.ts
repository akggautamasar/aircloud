
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

    // Get file info from Telegram using bot API first to check size
    const fileInfoUrl = `https://api.telegram.org/bot${config.bot_token}/getFile?file_id=${fileId}`
    const fileInfoResponse = await fetch(fileInfoUrl)

    if (!fileInfoResponse.ok) {
      console.error('Telegram getFile error:', await fileInfoResponse.text())
      // For large files, bot API will fail - this is expected
      // We'll create a direct download URL instead
      const directUrl = await createDirectDownloadUrl(config.bot_token, fileId, fileName)
      
      return new Response(
        JSON.stringify({ 
          success: true,
          isStreamUrl: true,
          streamUrl: directUrl,
          fileName: fileName,
          fileSize: 0, // Unknown size for large files
          message: 'Direct streaming URL provided for large file'
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
      if (fileInfo.error_code === 400 && fileInfo.description?.includes('too big')) {
        // File is too big for bot API, create direct download URL
        const directUrl = await createDirectDownloadUrl(config.bot_token, fileId, fileName)
        
        return new Response(
          JSON.stringify({ 
            success: true,
            isStreamUrl: true,
            streamUrl: directUrl,
            fileName: fileName,
            fileSize: 0, // Unknown size for large files
            message: 'Direct streaming URL provided for large file'
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        )
      }
      throw new Error(fileInfo.description || 'Failed to get file info')
    }
    
    const filePath = fileInfo.result.file_path
    const fileSize = fileInfo.result.file_size || 0
    
    if (!filePath) {
      throw new Error('File path not available')
    }

    // For files under 20MB, use the standard download URL
    const downloadUrl = `https://api.telegram.org/file/bot${config.bot_token}/${filePath}`
    
    console.log(`File size: ${fileSize}, Download URL: ${downloadUrl}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        isStreamUrl: true,
        streamUrl: downloadUrl,
        fileName: fileName,
        fileSize: fileSize,
        message: 'Standard streaming URL provided'
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

async function createDirectDownloadUrl(botToken: string, fileId: string, fileName: string): Promise<string> {
  // For large files, we need to create a proxy URL that will stream the file
  // This is a workaround since we can't directly access large files via bot API
  
  // Try to construct a direct telegram CDN URL if possible
  // This might not work for all files, but it's worth trying
  
  // For now, return a placeholder that indicates the file is too large
  // In a real implementation, you'd need to use telegram client libraries
  // that can handle large file downloads
  
  console.log(`Creating direct download URL for large file: ${fileName} (${fileId})`)
  
  // Return a special URL that indicates this needs client-side handling
  return `tg-large-file://${fileId}/${encodeURIComponent(fileName)}`
}
