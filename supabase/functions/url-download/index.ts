
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

    const body = await req.json()
    const { url, filename } = body

    if (!url) {
      throw new Error('No URL provided')
    }

    console.log(`Starting download from URL: ${url}`)

    // Get file info first
    const headResponse = await fetch(url, { method: 'HEAD' })
    const contentLength = headResponse.headers.get('content-length')
    const contentType = headResponse.headers.get('content-type') || 'application/octet-stream'
    
    let fileSize = 0
    if (contentLength) {
      fileSize = parseInt(contentLength)
    }

    // Check file size limits (50MB for Telegram)
    const maxSize = 50 * 1024 * 1024
    if (fileSize > maxSize) {
      throw new Error(`File size ${(fileSize / 1024 / 1024).toFixed(1)}MB exceeds Telegram's 50MB limit`)
    }

    // Download the file
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Convert to base64
    const base64 = btoa(String.fromCharCode(...uint8Array))

    // Upload to Telegram using existing upload function
    const { data: uploadResult, error: uploadError } = await supabaseClient.functions.invoke('telegram-upload', {
      body: {
        fileName: filename || extractFilename(url),
        fileSize: uint8Array.length,
        fileType: contentType,
        fileData: base64,
      },
    })

    if (uploadError) {
      throw new Error(uploadError.message || 'Upload failed')
    }

    if (!uploadResult?.success) {
      throw new Error(uploadResult?.error || 'Upload failed')
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        fileId: uploadResult.fileId,
        fileName: filename || extractFilename(url),
        fileSize: uint8Array.length,
        message: 'File downloaded and uploaded successfully'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('URL download error:', error)
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

function extractFilename(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || 'downloaded_file'
    return decodeURIComponent(filename)
  } catch {
    return 'downloaded_file'
  }
}
