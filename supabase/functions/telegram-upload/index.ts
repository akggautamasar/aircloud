
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

    // Convert base64 back to file for Telegram upload
    const fileBuffer = Uint8Array.from(atob(fileData), c => c.charCodeAt(0))
    const file = new File([fileBuffer], fileName, { type: fileType })

    // Prepare file for Telegram upload
    const telegramFormData = new FormData()
    telegramFormData.append('chat_id', config.channel_id)
    
    // Use appropriate Telegram API endpoint based on file type
    const isVideo = fileType?.startsWith('video/') || fileName.toLowerCase().match(/\.(mp4|avi|mov|mkv|webm|m4v)$/i)
    const isImage = fileType?.startsWith('image/') || fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)
    
    let telegramUrl = `https://api.telegram.org/bot${config.bot_token}/sendDocument`
    
    if (isVideo) {
      telegramFormData.append('video', file)
      telegramUrl = `https://api.telegram.org/bot${config.bot_token}/sendVideo`
      telegramFormData.append('supports_streaming', 'true')
    } else if (isImage) {
      telegramFormData.append('photo', file)
      telegramUrl = `https://api.telegram.org/bot${config.bot_token}/sendPhoto`
    } else {
      telegramFormData.append('document', file)
    }
    
    const caption = `📎 ${fileName}\n💾 Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB\n⏰ Uploaded: ${new Date().toLocaleString()}`
    telegramFormData.append('caption', caption)

    console.log(`Uploading ${isVideo ? 'video' : isImage ? 'image' : 'document'}: ${fileName}`)

    // Upload to Telegram
    const response = await fetch(telegramUrl, {
      method: 'POST',
      body: telegramFormData,
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Telegram API error:', error)
      throw new Error(`Telegram upload failed: ${error.description}`)
    }

    const result = await response.json()
    console.log('Telegram upload successful:', result.result.message_id)
    
    // Get the appropriate file object based on type
    let telegramFile
    if (isVideo) {
      telegramFile = result.result.video
    } else if (isImage) {
      telegramFile = result.result.photo[result.result.photo.length - 1] // Get highest resolution
    } else {
      telegramFile = result.result.document
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
