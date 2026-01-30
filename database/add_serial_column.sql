-- Migration script to add serial column to printers table

-- 1. Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printers' AND column_name = 'serial') THEN
        ALTER TABLE printers ADD COLUMN serial TEXT;
    END IF;
END $$;

-- 2. Update functions that return printer data

-- Update printers_by_office function
DROP FUNCTION IF EXISTS printers_by_office(TEXT);

CREATE OR REPLACE FUNCTION printers_by_office(target_office TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  ip_address TEXT,
  model TEXT,
  office TEXT,
  status TEXT,
  location_details TEXT,
  serial TEXT,
  user_count BIGINT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.ip_address,
    p.model,
    p.office,
    p.status,
    p.location_details,
    p.serial,
    COUNT(upa.user_id) as user_count,
    p.created_at
  FROM printers p
  LEFT JOIN user_printer_assignments upa ON p.id = upa.printer_id
  WHERE (target_office IS NULL OR p.office = target_office)
  GROUP BY p.id, p.name, p.ip_address, p.model, p.office, p.status, p.location_details, p.serial, p.created_at
  ORDER BY p.office, p.name;
END;
$$ LANGUAGE plpgsql;

-- Update printers_by_user function
DROP FUNCTION IF EXISTS printers_by_user(TEXT);

CREATE OR REPLACE FUNCTION printers_by_user(target_user_id TEXT)
RETURNS TABLE (
  printer_id UUID,
  printer_name TEXT,
  ip_address TEXT,
  model TEXT,
  office TEXT,
  status TEXT,
  is_primary BOOLEAN,
  assigned_at TIMESTAMPTZ,
  serial TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.ip_address,
    p.model,
    p.office,
    p.status,
    upa.is_primary,
    upa.assigned_at,
    p.serial
  FROM printers p
  INNER JOIN user_printer_assignments upa ON p.id = upa.printer_id
  WHERE upa.user_id = target_user_id
  ORDER BY upa.is_primary DESC, p.name;
END;
$$ LANGUAGE plpgsql;
