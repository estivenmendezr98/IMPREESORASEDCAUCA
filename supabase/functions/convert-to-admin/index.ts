import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ConvertToAdminRequest {
  userIds: string[];
  defaultPassword?: string;
}

interface ConvertToAdminResponse {
  success: boolean;
  message: string;
  converted: string[];
  errors: string[];
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
    const { userIds, defaultPassword }: ConvertToAdminRequest = await req.json()

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'User IDs array is required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const converted: string[] = []
    const errors: string[] = []
    const password = defaultPassword || 'admin123' // Contraseña por defecto

    // Process each user ID
    for (const userId of userIds) {
      try {
        console.log(`Converting user ${userId} to admin...`)

        // Get user data from users table
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', userId)
          .limit(1)

        if (userError) {
          errors.push(`Error fetching user ${userId}: ${userError.message}`)
          continue
        }

        if (!userData || userData.length === 0) {
          errors.push(`User ${userId} not found in users table`)
          continue
        }

        const userInfo = userData[0]
        console.log(`Found user data for ${userId}:`, userInfo)

        // Create admin user in auth.users
        const adminEmail = userInfo.email || `${userId}@sedcauca.gov.co`
        const adminName = userInfo.full_name || `Admin ${userId}`

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: adminEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: adminName,
            role: 'admin'
          }
        })

        if (authError) {
          console.error(`Auth creation error for ${userId}:`, authError)
          errors.push(`Error creating admin auth for ${userId}: ${authError.message}`)
          continue
        }

        if (!authData.user) {
          errors.push(`Failed to create admin auth for ${userId}`)
          continue
        }

        console.log(`Created admin auth for ${userId}: ${authData.user.id}`)

        // Remove user from users table (since they're now an admin)
        const { error: deleteError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', userId)

        if (deleteError) {
          console.warn(`Warning: Could not delete user ${userId} from users table: ${deleteError.message}`)
          // Don't add to errors since the main goal (creating admin) succeeded
        } else {
          console.log(`Removed ${userId} from users table`)
        }

        converted.push(userId)
        console.log(`Successfully converted ${userId} to admin`)

      } catch (error) {
        console.error(`Unexpected error converting ${userId}:`, error)
        errors.push(`Unexpected error for ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Success response
    const response: ConvertToAdminResponse = {
      success: converted.length > 0,
      message: converted.length > 0 
        ? `✅ Convertidos ${converted.length} usuarios a administradores: ${converted.join(', ')}`
        : '❌ No se pudieron convertir usuarios a administradores',
      converted,
      errors
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
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        converted: [],
        errors: [`Global error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})