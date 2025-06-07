
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
    // Initialize Supabase client with service role key for webhook access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse webhook update from Telegram
    const update = await req.json()
    console.log('Received webhook update:', JSON.stringify(update))

    // Check if this is a message with a document, photo, or video
    if (!update.message) {
      return new Response('OK', { status: 200 })
    }

    const message = update.message
    const chatId = message.chat.id.toString()

    // Check if this chat is configured for any user
    const { data: config, error: configError } = await supabaseClient
      .from('user_telegram_config')
      .select('*')
      .eq('channel_id', chatId)
      .eq('is_active', true)
      .single()

    if (configError || !config) {
      console.log('No active config found for chat:', chatId)
      return new Response('OK', { status: 200 })
    }

    let telegramFile = null
    let fileName = ''
    let fileSize = 0
    let fileType = ''

    // Handle different file types
    if (message.document) {
      telegramFile = message.document
      fileName = message.document.file_name || `document_${message.document.file_id}`
      fileSize = message.document.file_size || 0
      fileType = message.document.mime_type || 'application/octet-stream'
    } else if (message.photo) {
      // Get the largest photo
      telegramFile = message.photo[message.photo.length - 1]
      fileName = `photo_${telegramFile.file_id}.jpg`
      fileSize = telegramFile.file_size || 0
      fileType = 'image/jpeg'
    } else if (message.video) {
      telegramFile = message.video
      fileName = message.video.file_name || `video_${message.video.file_id}.mp4`
      fileSize = message.video.file_size || 0
      fileType = message.video.mime_type || 'video/mp4'
    } else {
      // No file to process
      return new Response('OK', { status: 200 })
    }

    // Save file metadata to database
    const { error: dbError } = await supabaseClient
      .from('telegram_files')
      .insert({
        user_id: config.user_id,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
        telegram_file_id: telegramFile.file_id,
        telegram_message_id: message.message_id,
        channel_id: chatId,
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response('Database error', { status: 500 })
    }

    console.log(`Saved file: ${fileName} for user ${config.user_id}`)

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Error', { status: 500 })
  }
})
