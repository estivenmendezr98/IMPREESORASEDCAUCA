
INSERT INTO users (id, email, full_name, role) VALUES ('demo-verify-delete', 'delete@test.com', 'Delete Me Please', 'user') ON CONFLICT (id) DO NOTHING;
INSERT INTO prints_raw (user_id, report_timestamp, print_total) VALUES ('demo-verify-delete', NOW(), 100);
INSERT INTO prints_monthly (user_id, year, month, print_total) VALUES ('demo-verify-delete', 2024, 12, 100) ON CONFLICT (user_id, year, month) DO NOTHING;
-- Assign a printer if available
DO $$
DECLARE
    pid UUID;
BEGIN
    SELECT id INTO pid FROM printers LIMIT 1;
    IF pid IS NOT NULL THEN
        INSERT INTO user_printer_assignments (user_id, printer_id) VALUES ('demo-verify-delete', pid) ON CONFLICT DO NOTHING;
    END IF;
END $$;
