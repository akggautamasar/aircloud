
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
    const { fileName, fileSize, fileType, fileData } = body
    
    if (!fileName || !fileData) {
      throw new Error('No file data provided')
    }

    console.log(`Uploading file: ${fileName}, size: ${fileSize}, type: ${fileType}`)

    // Convert base64 to blob
    const binaryString = atob(fileData)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    const blob = new Blob([bytes], { type: fileType })

    // Prepare multipart form data for Telegram
    const formData = new FormData()
    formData.append('chat_id', config.channel_id)
    
    // Determine file type and use appropriate Telegram API endpoint
    const isVideo = fileType?.startsWith('video/') || fileName.toLowerCase().match(/\.(mp4|avi|mov|mkv|webm|m4v)$/i)
    const isImage = fileType?.startsWith('image/') || fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)
    
    let telegramUrl = `https://api.telegram.org/bot${config.bot_token}/sendDocument`
    
    if (isVideo) {
      formData.append('video', blob, fileName)
      telegramUrl = `https://api.telegram.org/bot${config.bot_token}/sendVideo`
      formData.append('supports_streaming', 'true')
    } else if (isImage) {
      formData.append('photo', blob, fileName)
      telegramUrl = `https://api.telegram.org/bot${config.bot_token}/sendPhoto`
    } else {
      formData.append('document', blob, fileName)
    }
    
    const caption = `📎 ${fileName}\n💾 Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB\n⏰ Uploaded: ${new Date().toLocaleString()}`
    formData.append('caption', caption)

    console.log(`Sending ${isVideo ? 'video' : isImage ? 'photo' : 'document'} to Telegram...`)

    // Upload to Telegram
    const response = await fetch(telegramUrl, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Telegram API error:', errorText)
      throw new Error(`Telegram upload failed: ${errorText}`)
    }

    const result = await response.json()
    console.log('Telegram upload successful:', result.result.message_id)
    
    // Get the appropriate file object based on type
    let telegramFile
    if (isVideo) {
      telegramFile = result.result.video
    } else if (isImage) {
      telegramFile = result.result.photo?.[result.result.photo.length - 1] // Get highest resolution
    } else {
      telegramFile = result.result.document
    }

    if (!telegramFile) {
      throw new Error('Failed to get file information from Telegram response')
    }

    // Save file metadata to database
    const { error: dbError } = await supabaseClient
      .from('telegram_files')
      .insert({
        user_id: user.id,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType || 'unknown',
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
        fileName: fileName,
        fileSize: fileSize,
        fileType: isVideo ? 'video' : isImage ? 'image' : 'document'
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
