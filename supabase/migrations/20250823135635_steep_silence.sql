/*
  # Add missing timestamp columns to import_log table

  1. Changes
    - Add `created_at` column to `import_log` table with default value
    - Add `updated_at` column to `import_log` table with default value
    - Add trigger to automatically update `updated_at` on row updates

  2. Security
    - No RLS changes needed as existing policies remain valid
*/

-- Add missing timestamp columns to import_log table
ALTER TABLE public.import_log
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add trigger to update updated_at column
DROP TRIGGER IF EXISTS update_import_log_updated_at ON public.import_log;
CREATE TRIGGER update_import_log_updated_at 
  BEFORE UPDATE ON public.import_log 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();