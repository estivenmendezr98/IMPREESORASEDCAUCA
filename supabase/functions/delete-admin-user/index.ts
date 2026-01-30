import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface DeleteAdminRequest {
  userId: string;
}

interface DeleteAdminResponse {
  success: boolean;
  message: string;
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

    // Verify the user is authenticated and is an admin
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

    // Check if user is admin
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
    const { userId }: DeleteAdminRequest = await req.json()

    // Validate required fields
    if (!userId) {
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

    // Prevent self-deletion
    if (userId === user.id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No puedes eliminar tu propia cuenta de administrador' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user data before deletion for logging
    const { data: userToDelete, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    
    if (getUserError || !userToDelete.user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Usuario no encontrado: ${getUserError?.message || 'Usuario no existe'}` 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the user to delete is actually an admin
    if (userToDelete.user.user_metadata?.role !== 'admin') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'El usuario especificado no es un administrador' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Delete the user from auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Error deleting admin user:', deleteError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Error eliminando administrador: ${deleteError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Try to clean up any potential entries in users table (non-critical)
    try {
      // Check if there's an entry in users table with the same email
      const { data: localUsers, error: localError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', userToDelete.user.email)
        .limit(1)

      if (!localError && localUsers && localUsers.length > 0) {
        // Delete from local users table if exists
        await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', localUsers[0].id)
      }
    } catch (cleanupError) {
      console.warn('Could not clean up local users table:', cleanupError)
      // Non-critical error, continue
    }

    // Success response
    const response: DeleteAdminResponse = {
      success: true,
      message: `✅ Administrador "${userToDelete.user.user_metadata?.full_name || userToDelete.user.email}" eliminado exitosamente`
    }

    return new Response(
      JSON.stringify(response),
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
        message: `Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}` 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})