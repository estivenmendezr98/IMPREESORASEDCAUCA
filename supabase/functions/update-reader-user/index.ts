import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface UpdateReaderRequest {
  userId: string;
  email?: string;
  full_name?: string;
  newPassword?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the user is authenticated and is an admin using admin client
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user is admin (only admins can update readers)
    const isAdmin = user.user_metadata?.role === 'admin'
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, message: 'Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const updateData: UpdateReaderRequest = await req.json()

    // Validate required fields
    if (!updateData.userId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'User ID is required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate password if provided
    if (updateData.newPassword && updateData.newPassword.length < 6) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Password must be at least 6 characters long' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get current user data
    const { data: currentUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(updateData.userId)
    
    if (getUserError || !currentUser.user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `User not found: ${getUserError?.message || 'Unknown error'}` 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the user is actually a reader
    if (currentUser.user.user_metadata?.role !== 'reader') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'El usuario especificado no es un lector' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Prepare update data
    const updatePayload: any = {}

    // Update email if provided and different
    if (updateData.email && updateData.email !== currentUser.user.email) {
      updatePayload.email = updateData.email
    }

    // Update password if provided
    if (updateData.newPassword) {
      updatePayload.password = updateData.newPassword
    }

    // Update user metadata
    const currentMetadata = currentUser.user.user_metadata || {}
    const newMetadata = {
      ...currentMetadata,
      role: 'reader', // Ensure role remains reader
      full_name: updateData.full_name || currentMetadata.full_name || ''
    }

    updatePayload.user_metadata = newMetadata

    // Update user in auth
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      updateData.userId,
      updatePayload
    )

    if (updateError) {
      console.error('Error updating reader user:', updateError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Error updating user: ${updateError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Success response
    let successMessage = '✅ Usuario lector actualizado exitosamente'
    
    if (updateData.newPassword) {
      successMessage += ' (incluyendo contraseña)'
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: successMessage,
        user: {
          id: updatedUser.user.id,
          email: updatedUser.user.email,
          full_name: newMetadata.full_name
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})