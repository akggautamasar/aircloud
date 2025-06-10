
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
    console.log('Received webhook update:', JSON.stringify(update, null, 2))

    // Check if this is a message with any file type
    if (!update.message) {
      console.log('No message in update, skipping')
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    const message = update.message
    const chatId = message.chat.id.toString()
    console.log('Processing message from chat:', chatId)

    // Check if this chat is configured for any user
    const { data: config, error: configError } = await supabaseClient
      .from('user_telegram_config')
      .select('*')
      .eq('channel_id', chatId)
      .eq('is_active', true)
      .single()

    if (configError || !config) {
      console.log('No active config found for chat:', chatId, 'Error:', configError)
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    console.log('Found config for user:', config.user_id)

    let telegramFile = null
    let fileName = ''
    let fileSize = 0
    let fileType = ''

    // Handle ALL file types including documents, photos, videos, audio, voice, animations, stickers, video notes
    if (message.document) {
      telegramFile = message.document
      fileName = message.document.file_name || `document_${message.document.file_id}`
      fileSize = message.document.file_size || 0
      fileType = message.document.mime_type || 'application/octet-stream'
      console.log('Processing document:', fileName, 'Size:', fileSize)
    } else if (message.photo && message.photo.length > 0) {
      // Get the largest photo
      telegramFile = message.photo[message.photo.length - 1]
      fileName = `photo_${telegramFile.file_id}.jpg`
      fileSize = telegramFile.file_size || 0
      fileType = 'image/jpeg'
      console.log('Processing photo:', fileName, 'Size:', fileSize)
    } else if (message.video) {
      telegramFile = message.video
      fileName = message.video.file_name || `video_${message.video.file_id}.mp4`
      fileSize = message.video.file_size || 0
      fileType = message.video.mime_type || 'video/mp4'
      console.log('Processing video:', fileName, 'Size:', fileSize)
    } else if (message.audio) {
      telegramFile = message.audio
      fileName = message.audio.file_name || message.audio.title || `audio_${message.audio.file_id}.mp3`
      fileSize = message.audio.file_size || 0
      fileType = message.audio.mime_type || 'audio/mpeg'
      console.log('Processing audio:', fileName, 'Size:', fileSize)
    } else if (message.voice) {
      telegramFile = message.voice
      fileName = `voice_${message.voice.file_id}.ogg`
      fileSize = message.voice.file_size || 0
      fileType = 'audio/ogg'
      console.log('Processing voice message:', fileName, 'Size:', fileSize)
    } else if (message.animation) {
      telegramFile = message.animation
      fileName = message.animation.file_name || `animation_${message.animation.file_id}.mp4`
      fileSize = message.animation.file_size || 0
      fileType = message.animation.mime_type || 'video/mp4'
      console.log('Processing animation/GIF:', fileName, 'Size:', fileSize)
    } else if (message.sticker) {
      telegramFile = message.sticker
      fileName = `sticker_${message.sticker.file_id}.webp`
      fileSize = message.sticker.file_size || 0
      fileType = 'image/webp'
      console.log('Processing sticker:', fileName, 'Size:', fileSize)
    } else if (message.video_note) {
      telegramFile = message.video_note
      fileName = `video_note_${message.video_note.file_id}.mp4`
      fileSize = message.video_note.file_size || 0
      fileType = 'video/mp4'
      console.log('Processing video note:', fileName, 'Size:', fileSize)
    } else {
      console.log('No supported file type found in message')
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    if (!telegramFile || !telegramFile.file_id) {
      console.log('No valid file object found')
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    // Check if file already exists to avoid duplicates
    const { data: existingFile } = await supabaseClient
      .from('telegram_files')
      .select('id')
      .eq('telegram_file_id', telegramFile.file_id)
      .eq('user_id', config.user_id)
      .single()

    if (existingFile) {
      console.log('File already exists in database, skipping:', telegramFile.file_id)
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    // Save file metadata to database
    const fileData = {
      user_id: config.user_id,
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType,
      telegram_file_id: telegramFile.file_id,
      telegram_message_id: message.message_id,
      channel_id: chatId,
    }

    console.log('Inserting file data:', fileData)

    const { data: insertedFile, error: dbError } = await supabaseClient
      .from('telegram_files')
      .insert(fileData)
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(JSON.stringify({ error: 'Database error', details: dbError }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`Successfully saved file: ${fileName} for user ${config.user_id}`)

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'File processed successfully',
      file: insertedFile
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ 
      error: 'Processing error', 
      details: error.message 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
