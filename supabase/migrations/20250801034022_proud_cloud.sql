/*
  # Fix Foreign Key Constraints for Admin Deletion

  1. Problem
    - Admin users cannot be deleted due to foreign key constraints
    - Tables referencing auth.users don't have ON DELETE CASCADE
    - This prevents proper cleanup when deleting administrators

  2. Solution
    - Update foreign key constraints to include ON DELETE CASCADE
    - This allows automatic cleanup of related records when admin is deleted

  3. Tables Affected
    - import_log.imported_by → auth.users(id)
    - user_printer_assignments.assigned_by → auth.users(id)
*/

-- Fix import_log.imported_by foreign key constraint
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'import_log_imported_by_fkey' 
    AND table_name = 'import_log'
  ) THEN
    ALTER TABLE public.import_log DROP CONSTRAINT import_log_imported_by_fkey;
  END IF;

  -- Add new constraint with CASCADE delete
  ALTER TABLE public.import_log
  ADD CONSTRAINT import_log_imported_by_fkey
  FOREIGN KEY (imported_by)
  REFERENCES auth.users (id)
  ON DELETE CASCADE;
END $$;

-- Fix user_printer_assignments.assigned_by foreign key constraint
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_printer_assignments_assigned_by_fkey' 
    AND table_name = 'user_printer_assignments'
  ) THEN
    ALTER TABLE public.user_printer_assignments DROP CONSTRAINT user_printer_assignments_assigned_by_fkey;
  END IF;

  -- Add new constraint with CASCADE delete
  ALTER TABLE public.user_printer_assignments
  ADD CONSTRAINT user_printer_assignments_assigned_by_fkey
  FOREIGN KEY (assigned_by)
  REFERENCES auth.users (id)
  ON DELETE CASCADE;
END $$;