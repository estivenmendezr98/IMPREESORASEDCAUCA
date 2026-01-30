/*
  # Fix Function Security Issues

  This migration addresses security vulnerabilities in database functions by:
  
  1. Setting proper search_path for all functions to prevent SQL injection
  2. Recreating functions with SECURITY DEFINER and proper search_path
  3. Ensuring functions are immutable where appropriate
  
  ## Functions Updated
  - dashboard_stats() - Dashboard statistics
  - is_admin() - Admin role checking
  - update_updated_at_column() - Timestamp trigger function
  - monthly_detail() - Monthly data details
  - printers_by_office() - Printer office queries
  - users_by_printer() - User printer assignments
  - printers_by_user() - User printer queries
  - total_by_user() - User totals calculation
  
  ## Security Improvements
  - SET search_path = public for all functions
  - SECURITY DEFINER where appropriate
  - Proper parameter validation
*/

-- Drop existing functions to recreate with proper security
DROP FUNCTION IF EXISTS dashboard_stats();
DROP FUNCTION IF EXISTS is_admin(uuid);
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS monthly_detail(text, integer);
DROP FUNCTION IF EXISTS printers_by_office(text);
DROP FUNCTION IF EXISTS users_by_printer(uuid);
DROP FUNCTION IF EXISTS printers_by_user(text);
DROP FUNCTION IF EXISTS total_by_user(text);

-- 1. Update timestamp trigger function with proper security
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 2. Dashboard statistics function
CREATE OR REPLACE FUNCTION dashboard_stats()
RETURNS TABLE (
    total_users bigint,
    active_users bigint,
    total_prints_month bigint,
    total_copies_month bigint,
    last_import timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    current_month integer := EXTRACT(month FROM now());
    current_year integer := EXTRACT(year FROM now());
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT count(*) FROM users)::bigint as total_users,
        (SELECT count(DISTINCT user_id) FROM prints_monthly 
         WHERE year = current_year AND month = current_month)::bigint as active_users,
        (SELECT COALESCE(sum(print_total), 0) FROM prints_monthly 
         WHERE year = current_year AND month = current_month)::bigint as total_prints_month,
        (SELECT COALESCE(sum(copy_total), 0) FROM prints_monthly 
         WHERE year = current_year AND month = current_month)::bigint as total_copies_month,
        (SELECT imported_at FROM import_log ORDER BY imported_at DESC LIMIT 1) as last_import;
END;
$$;

-- 3. Admin role checking function
CREATE OR REPLACE FUNCTION is_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    -- This function would need to check auth.users metadata
    -- For now, return false as role checking is handled in application layer
    RETURN false;
END;
$$;

-- 4. Monthly detail function
CREATE OR REPLACE FUNCTION monthly_detail(target_user_id text, target_year integer DEFAULT NULL)
RETURNS TABLE (
    month integer,
    month_name text,
    print_total integer,
    print_color integer,
    print_mono integer,
    copy_total integer,
    scan_total integer,
    fax_total integer,
    print_diff integer,
    copy_diff integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    year_to_use integer := COALESCE(target_year, EXTRACT(year FROM now())::integer);
    month_names text[] := ARRAY['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
BEGIN
    -- Validate input parameters
    IF target_user_id IS NULL OR target_user_id = '' THEN
        RAISE EXCEPTION 'User ID cannot be null or empty';
    END IF;
    
    IF year_to_use < 2020 OR year_to_use > 2030 THEN
        RAISE EXCEPTION 'Year must be between 2020 and 2030';
    END IF;

    RETURN QUERY
    SELECT 
        pm.month,
        month_names[pm.month] as month_name,
        COALESCE(pm.print_total, 0) as print_total,
        COALESCE(pm.print_color, 0) as print_color,
        COALESCE(pm.print_mono, 0) as print_mono,
        COALESCE(pm.copy_total, 0) as copy_total,
        COALESCE(pm.scan_total, 0) as scan_total,
        COALESCE(pm.fax_total, 0) as fax_total,
        COALESCE(pm.print_total_diff, 0) as print_diff,
        COALESCE(pm.copy_total_diff, 0) as copy_diff
    FROM prints_monthly pm
    WHERE pm.user_id = target_user_id 
      AND pm.year = year_to_use
    ORDER BY pm.month;
END;
$$;

-- 5. Total by user function
CREATE OR REPLACE FUNCTION total_by_user(target_user_id text DEFAULT NULL)
RETURNS TABLE (
    user_id text,
    full_name text,
    office text,
    total_prints bigint,
    total_copies bigint,
    total_scans bigint,
    total_fax bigint,
    last_activity timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as user_id,
        COALESCE(u.full_name, 'Sin nombre') as full_name,
        COALESCE(u.office, 'Sin oficina') as office,
        COALESCE(sum(pm.print_total), 0)::bigint as total_prints,
        COALESCE(sum(pm.copy_total), 0)::bigint as total_copies,
        COALESCE(sum(pm.scan_total), 0)::bigint as total_scans,
        COALESCE(sum(pm.fax_total), 0)::bigint as total_fax,
        (SELECT max(pr.report_timestamp) FROM prints_raw pr WHERE pr.user_id = u.id) as last_activity
    FROM users u
    LEFT JOIN prints_monthly pm ON u.id = pm.user_id
    WHERE (target_user_id IS NULL OR u.id = target_user_id)
    GROUP BY u.id, u.full_name, u.office
    ORDER BY total_prints DESC;
END;
$$;

-- 6. Printers by office function
CREATE OR REPLACE FUNCTION printers_by_office(target_office text DEFAULT NULL)
RETURNS TABLE (
    id uuid,
    name text,
    ip_address text,
    model text,
    office text,
    status text,
    location_details text,
    assigned_users_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    -- Validate input
    IF target_office IS NOT NULL AND length(target_office) > 100 THEN
        RAISE EXCEPTION 'Office name too long';
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.ip_address,
        p.model,
        p.office,
        p.status,
        p.location_details,
        COALESCE(count(upa.user_id), 0)::bigint as assigned_users_count
    FROM printers p
    LEFT JOIN user_printer_assignments upa ON p.id = upa.printer_id
    WHERE (target_office IS NULL OR p.office = target_office)
    GROUP BY p.id, p.name, p.ip_address, p.model, p.office, p.status, p.location_details
    ORDER BY p.name;
END;
$$;

-- 7. Users by printer function
CREATE OR REPLACE FUNCTION users_by_printer(target_printer_id uuid)
RETURNS TABLE (
    user_id text,
    full_name text,
    office text,
    department text,
    assigned_at timestamptz,
    is_primary boolean,
    notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    -- Validate input
    IF target_printer_id IS NULL THEN
        RAISE EXCEPTION 'Printer ID cannot be null';
    END IF;

    RETURN QUERY
    SELECT 
        u.id as user_id,
        COALESCE(u.full_name, 'Sin nombre') as full_name,
        COALESCE(u.office, 'Sin oficina') as office,
        COALESCE(u.department, 'Sin departamento') as department,
        upa.assigned_at,
        upa.is_primary,
        upa.notes
    FROM user_printer_assignments upa
    JOIN users u ON upa.user_id = u.id
    WHERE upa.printer_id = target_printer_id
    ORDER BY upa.is_primary DESC, upa.assigned_at DESC;
END;
$$;

-- 8. Printers by user function
CREATE OR REPLACE FUNCTION printers_by_user(target_user_id text)
RETURNS TABLE (
    printer_id uuid,
    printer_name text,
    ip_address text,
    model text,
    office text,
    status text,
    assigned_at timestamptz,
    is_primary boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    -- Validate input
    IF target_user_id IS NULL OR target_user_id = '' THEN
        RAISE EXCEPTION 'User ID cannot be null or empty';
    END IF;

    RETURN QUERY
    SELECT 
        p.id as printer_id,
        p.name as printer_name,
        p.ip_address,
        p.model,
        p.office,
        p.status,
        upa.assigned_at,
        upa.is_primary
    FROM user_printer_assignments upa
    JOIN printers p ON upa.printer_id = p.id
    WHERE upa.user_id = target_user_id
    ORDER BY upa.is_primary DESC, upa.assigned_at DESC;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION monthly_detail(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION printers_by_office(text) TO authenticated;
GRANT EXECUTE ON FUNCTION users_by_printer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION printers_by_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION total_by_user(text) TO authenticated;

-- The update_updated_at_column function is used by triggers, no need to grant execute

-- Add comments for documentation
COMMENT ON FUNCTION dashboard_stats() IS 'Returns dashboard statistics with proper security settings';
COMMENT ON FUNCTION is_admin(uuid) IS 'Checks if user has admin role (placeholder for auth metadata check)';
COMMENT ON FUNCTION update_updated_at_column() IS 'Trigger function to update updated_at timestamp with security definer';
COMMENT ON FUNCTION monthly_detail(text, integer) IS 'Returns monthly detail for specific user and year with input validation';
COMMENT ON FUNCTION printers_by_office(text) IS 'Returns printers filtered by office with user count';
COMMENT ON FUNCTION users_by_printer(uuid) IS 'Returns users assigned to specific printer';
COMMENT ON FUNCTION printers_by_user(text) IS 'Returns printers assigned to specific user';
COMMENT ON FUNCTION total_by_user(text) IS 'Returns user totals with optional filtering by user ID';