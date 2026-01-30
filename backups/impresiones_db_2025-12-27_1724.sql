--
-- PostgreSQL database dump
--

\restrict fxNFMNyqMBVbRLtR3krIlVtcsuc7NeapEaiF5yeOkUJ4eNaBx941ZatuKJAcF7Z

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: dashboard_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.dashboard_stats() RETURNS TABLE(total_users bigint, active_users bigint, total_prints_month bigint, total_copies_month bigint, last_import timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM users)::BIGINT,
    (SELECT COUNT(DISTINCT user_id) FROM prints_monthly 
     WHERE year = current_year AND month = current_month)::BIGINT,
    (SELECT COALESCE(SUM(print_total), 0) FROM prints_monthly 
     WHERE year = current_year AND month = current_month)::BIGINT,
    (SELECT COALESCE(SUM(copy_total), 0) FROM prints_monthly 
     WHERE year = current_year AND month = current_month)::BIGINT,
    (SELECT MAX(imported_at) FROM import_log)::TIMESTAMPTZ;
END;
$$;


ALTER FUNCTION public.dashboard_stats() OWNER TO postgres;

--
-- Name: monthly_detail(text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.monthly_detail(target_user_id text, target_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer) RETURNS TABLE(month integer, month_name text, print_total integer, print_color integer, print_mono integer, copy_total integer, scan_total integer, fax_total integer, print_diff integer, copy_diff integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.month,
    CASE pm.month
      WHEN 1 THEN 'Enero'
      WHEN 2 THEN 'Febrero'
      WHEN 3 THEN 'Marzo'
      WHEN 4 THEN 'Abril'
      WHEN 5 THEN 'Mayo'
      WHEN 6 THEN 'Junio'
      WHEN 7 THEN 'Julio'
      WHEN 8 THEN 'Agosto'
      WHEN 9 THEN 'Septiembre'
      WHEN 10 THEN 'Octubre'
      WHEN 11 THEN 'Noviembre'
      WHEN 12 THEN 'Diciembre'
    END as month_name,
    pm.print_total,
    pm.print_color,
    pm.print_mono,
    pm.copy_total,
    pm.scan_total,
    pm.fax_total,
    pm.print_total_diff,
    pm.copy_total_diff
  FROM prints_monthly pm
  WHERE pm.user_id = target_user_id 
    AND pm.year = target_year
  ORDER BY pm.month;
END;
$$;


ALTER FUNCTION public.monthly_detail(target_user_id text, target_year integer) OWNER TO postgres;

--
-- Name: printers_by_office(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.printers_by_office(target_office text DEFAULT NULL::text) RETURNS TABLE(id uuid, name text, ip_address text, model text, office text, status text, location_details text, user_count bigint, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
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
    COUNT(upa.user_id) as user_count,
    p.created_at
  FROM printers p
  LEFT JOIN user_printer_assignments upa ON p.id = upa.printer_id
  WHERE (target_office IS NULL OR p.office = target_office)
  GROUP BY p.id, p.name, p.ip_address, p.model, p.office, p.status, p.location_details, p.created_at
  ORDER BY p.office, p.name;
END;
$$;


ALTER FUNCTION public.printers_by_office(target_office text) OWNER TO postgres;

--
-- Name: printers_by_user(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.printers_by_user(target_user_id text) RETURNS TABLE(printer_id uuid, printer_name text, ip_address text, model text, office text, status text, is_primary boolean, assigned_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
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
    upa.assigned_at
  FROM printers p
  INNER JOIN user_printer_assignments upa ON p.id = upa.printer_id
  WHERE upa.user_id = target_user_id
  ORDER BY upa.is_primary DESC, p.name;
END;
$$;


ALTER FUNCTION public.printers_by_user(target_user_id text) OWNER TO postgres;

--
-- Name: total_by_user(jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.total_by_user(params jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(user_id text, full_name text, total_prints bigint, total_copies bigint, total_scans bigint, total_fax bigint, last_activity timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
  target_user_id TEXT := params->>'target_user_id';
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.full_name,
    COALESCE(SUM(pm.print_total), 0)::BIGINT as total_prints,
    COALESCE(SUM(pm.copy_total), 0)::BIGINT as total_copies,
    COALESCE(SUM(pm.scan_total), 0)::BIGINT as total_scans,
    COALESCE(SUM(pm.fax_total), 0)::BIGINT as total_fax,
    MAX(pr.report_timestamp) as last_activity
  FROM users u
  LEFT JOIN prints_monthly pm ON u.id = pm.user_id
  LEFT JOIN prints_raw pr ON u.id = pr.user_id
  WHERE (target_user_id IS NULL OR u.id = target_user_id)
  GROUP BY u.id, u.full_name
  ORDER BY total_prints DESC;
END;
$$;


ALTER FUNCTION public.total_by_user(params jsonb) OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: users_by_printer(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.users_by_printer(target_printer_id uuid) RETURNS TABLE(user_id text, full_name text, email text, office text, department text, is_primary boolean, assigned_at timestamp with time zone, notes text)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.full_name,
    u.email,
    u.office,
    u.department,
    upa.is_primary,
    upa.assigned_at,
    upa.notes
  FROM users u
  INNER JOIN user_printer_assignments upa ON u.id = upa.user_id
  WHERE upa.printer_id = target_printer_id
  ORDER BY upa.is_primary DESC, u.full_name;
END;
$$;


ALTER FUNCTION public.users_by_printer(target_printer_id uuid) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: import_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.import_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_name text NOT NULL,
    batch_id uuid DEFAULT gen_random_uuid() NOT NULL,
    imported_at timestamp with time zone DEFAULT now(),
    rows_processed integer DEFAULT 0,
    rows_success integer DEFAULT 0,
    rows_failed integer DEFAULT 0,
    error_details jsonb,
    imported_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.import_log OWNER TO postgres;

--
-- Name: printers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.printers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    ip_address text NOT NULL,
    model text NOT NULL,
    office text,
    status text DEFAULT 'Active'::text,
    location_details text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT printers_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'Maintenance'::text])))
);


ALTER TABLE public.printers OWNER TO postgres;

--
-- Name: prints_monthly; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prints_monthly (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    print_total integer DEFAULT 0,
    print_color integer DEFAULT 0,
    print_mono integer DEFAULT 0,
    copy_total integer DEFAULT 0,
    copy_color integer DEFAULT 0,
    copy_mono integer DEFAULT 0,
    scan_total integer DEFAULT 0,
    fax_total integer DEFAULT 0,
    print_total_diff integer DEFAULT 0,
    copy_total_diff integer DEFAULT 0,
    scan_total_diff integer DEFAULT 0,
    fax_total_diff integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.prints_monthly OWNER TO postgres;

--
-- Name: prints_raw; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prints_raw (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    report_timestamp timestamp with time zone NOT NULL,
    account_status text,
    print_total integer DEFAULT 0,
    print_color integer DEFAULT 0,
    print_mono integer DEFAULT 0,
    copy_total integer DEFAULT 0,
    copy_color integer DEFAULT 0,
    copy_mono integer DEFAULT 0,
    scan_total integer DEFAULT 0,
    fax_total integer DEFAULT 0,
    import_batch_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.prints_raw OWNER TO postgres;

--
-- Name: user_printer_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_printer_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    printer_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by text,
    is_primary boolean DEFAULT false,
    notes text
);


ALTER TABLE public.user_printer_assignments OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    status text DEFAULT 'Normal'::text NOT NULL,
    email text,
    full_name text,
    office text,
    department text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role text DEFAULT 'user'::text,
    password_hash text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: import_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.import_log (id, file_name, batch_id, imported_at, rows_processed, rows_success, rows_failed, error_details, imported_by, created_at, updated_at) FROM stdin;
72e1d7aa-b248-4242-82a4-7f28fa96f922	noviembreinforme.csv	3f911422-ba12-4f96-8832-389cddc1c22d	2025-12-27 15:38:18.33716-05	280	0	280	[{"row": 2, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 3, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 4, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 5, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 6, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 7, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 8, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 9, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 10, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 11, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 12, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 13, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 14, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 15, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 16, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 17, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 18, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 19, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 20, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 21, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 22, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 23, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 24, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 25, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 26, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 27, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 28, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 29, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 30, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 31, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 32, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 33, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 34, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 35, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 36, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 37, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 38, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 39, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 40, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 41, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 42, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 43, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 44, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 45, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 46, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 47, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 48, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 49, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 50, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 51, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 52, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 53, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 54, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 55, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 56, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 57, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 58, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 59, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 60, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 61, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 62, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 63, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 64, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 65, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 66, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 67, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 68, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 69, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 70, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 71, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 72, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 73, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 74, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 75, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 76, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 77, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 78, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 79, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 80, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 81, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 82, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 83, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 84, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 85, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 86, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 87, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 88, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 89, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 90, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 91, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 92, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 93, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 94, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 95, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 96, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 97, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 98, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 99, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 100, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}, {"row": 101, "error": "la sintaxis de entrada no es válida para tipo timestamp with time zone: «0NaN-NaN-NaNTNaN:NaN:NaN.NaN+NaN:NaN»"}]	\N	2025-12-27 15:38:18.33716-05	2025-12-27 15:38:18.33716-05
7f8d9aca-f69a-401f-9223-04cb242fbb03	noviembreinforme.csv	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.273691-05	280	280	0	[]	\N	2025-12-27 15:42:11.273691-05	2025-12-27 15:42:11.273691-05
5498f33b-e64e-4b44-b59b-748022770a78	noviembreinforme.csv	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.695527-05	280	280	0	[]	\N	2025-12-27 15:45:11.695527-05	2025-12-27 15:45:11.695527-05
\.


--
-- Data for Name: printers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.printers (id, name, ip_address, model, office, status, location_details, created_at, updated_at) FROM stdin;
7a993600-5464-4d31-bf77-4311889baa36	Impresora Principal	192.168.1.100	HP LaserJet Pro M404dn	Oficina Central	Active	Primer piso	2025-12-27 14:26:16.57139-05	2025-12-27 14:26:16.57139-05
cf93b885-a932-4a7e-9a73-b0a607d76a50	Printer Final Test Edited	10.0.0.99	Canon	Test Office	Active		2025-12-27 16:39:02.493397-05	2025-12-27 16:39:44.517626-05
\.


--
-- Data for Name: prints_monthly; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.prints_monthly (id, user_id, year, month, print_total, print_color, print_mono, copy_total, copy_color, copy_mono, scan_total, fax_total, print_total_diff, copy_total_diff, scan_total_diff, fax_total_diff, created_at, updated_at) FROM stdin;
f5128fd0-cd2e-433f-ac35-ca1a9755cba3	demo-admin-001	2024	12	250	100	150	120	50	70	80	15	50	20	20	5	2025-12-27 14:25:24.324733-05	2025-12-27 14:25:24.324733-05
e1ea8bb1-00c7-4606-a8f4-ccdc62090074	demo-admin-001	2024	11	200	80	120	100	40	60	60	10	200	100	60	10	2025-12-27 14:25:24.324733-05	2025-12-27 14:25:24.324733-05
10c55c79-91fc-40f7-84bb-65270bee02db	demo-user-001	2024	12	150	60	90	80	30	50	40	8	30	20	10	3	2025-12-27 14:25:24.324733-05	2025-12-27 14:25:24.324733-05
88911633-3342-45fb-b17d-918fb2d8cb29	demo-user-001	2024	11	120	45	75	60	25	35	30	5	120	60	30	5	2025-12-27 14:25:24.324733-05	2025-12-27 14:25:24.324733-05
a6428ee9-6a75-47f7-99b0-e4a4790c38e3	demo-user-002	2024	12	180	70	110	90	35	55	50	12	20	15	5	4	2025-12-27 14:25:24.324733-05	2025-12-27 14:25:24.324733-05
eeee4d82-4100-41f6-a9f4-16440c6bab83	demo-user-002	2024	11	160	55	105	75	30	45	45	8	160	75	45	8	2025-12-27 14:25:24.324733-05	2025-12-27 14:25:24.324733-05
06d458f6-e132-4c1b-a2da-f546f39f6323	demo-admin-001	2025	12	450	180	270	320	120	200	85	15	0	0	0	0	2025-12-27 14:59:39.504692-05	2025-12-27 14:59:39.504692-05
19f1e542-4fba-4667-b560-afab8d900af3	demo-user-001	2025	12	280	100	180	190	70	120	45	8	0	0	0	0	2025-12-27 14:59:39.504692-05	2025-12-27 14:59:39.504692-05
a3eb71b0-4223-4625-b01f-8d29ab2e9774	demo-user-002	2025	12	310	120	190	210	80	130	55	12	0	0	0	0	2025-12-27 14:59:39.504692-05	2025-12-27 14:59:39.504692-05
0701790d-082b-44fa-93fa-d01298348688	0104	2025	12	60	0	60	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.306787-05	2025-12-27 15:45:11.336001-05
f4e664bc-95ce-4553-ac83-de734ee56ed5	0116	2025	12	36	0	36	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.308779-05	2025-12-27 15:45:11.338397-05
604b5c25-e601-47fd-b58a-f2d45c456b9e	0207	2025	12	1224	0	1224	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.311053-05	2025-12-27 15:45:11.340264-05
9129fe23-b31d-47f2-946d-d77112dff991	0218	2025	12	244	0	244	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.31307-05	2025-12-27 15:45:11.34254-05
cc8d0cf1-6621-4a25-ae61-33d45dc8b4d2	0306	2025	12	124	0	124	2	0	2	2	0	0	0	0	0	2025-12-27 15:42:10.315006-05	2025-12-27 15:45:11.346185-05
fe224385-4d1b-4018-a4a2-491f83efa995	0325	2025	12	546	0	546	36	0	36	206	0	0	0	0	0	2025-12-27 15:42:10.316821-05	2025-12-27 15:45:11.348539-05
c92b3711-0ce3-4948-809e-2591c02e328f	0408	2025	12	18	0	18	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.318432-05	2025-12-27 15:45:11.35125-05
ea1fa04e-66eb-456e-a3dd-c5e562e5b529	0409	2025	12	70	0	70	18	0	18	86	0	0	0	0	0	2025-12-27 15:42:10.320089-05	2025-12-27 15:45:11.353502-05
f63ffe76-011c-4e07-8290-c11540e4bbc8	0424	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.321759-05	2025-12-27 15:45:11.355904-05
56094b1e-2639-4a3a-8569-cdb7a94fd7af	0505	2025	12	42	0	42	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.32499-05	2025-12-27 15:45:11.360609-05
1a6b531d-1427-4f29-bd82-d219f94d0bcb	0525	2025	12	10	0	10	12	0	12	12	0	0	0	0	0	2025-12-27 15:42:10.326826-05	2025-12-27 15:45:11.362769-05
2de4a70c-f562-4616-8076-4cc3d67226f4	0624	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.328504-05	2025-12-27 15:45:11.36478-05
db419d5f-33fa-4de3-9189-d7d1bbb6b9f1	0712	2025	12	226	0	226	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.33013-05	2025-12-27 15:45:11.367241-05
a49d0ee1-3ca1-44dd-a05f-25559d3ad721	0729	2025	12	100	0	100	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.33278-05	2025-12-27 15:45:11.369555-05
76544b08-e0c3-4b24-810d-304bb9f270d8	0803	2025	12	460	0	460	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.336641-05	2025-12-27 15:45:11.371895-05
2f9ac6d2-2a6a-4400-9985-e93ba99b31af	0819	2025	12	112	0	112	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.339902-05	2025-12-27 15:45:11.3743-05
ac31048f-5639-4c92-9812-d0d7e1c26d5b	0821	2025	12	56	0	56	4	0	4	4	0	0	0	0	0	2025-12-27 15:42:10.347063-05	2025-12-27 15:45:11.376339-05
c77ea620-520a-4c28-b6eb-678d8b8c1d8b	0825	2025	12	16	0	16	4	0	4	6	0	0	0	0	0	2025-12-27 15:42:10.353512-05	2025-12-27 15:45:11.37856-05
aee7de1f-9f20-4521-bd3c-b1eda2901ac6	0826	2025	12	38	0	38	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.358343-05	2025-12-27 15:45:11.38068-05
c9807d14-7815-45ef-8da3-7808cf0939fa	0934	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.363435-05	2025-12-27 15:45:11.382789-05
ca46c73b-71d2-431c-be8b-c1456964b5dc	1004	2025	12	568	0	568	46	0	46	250	0	0	0	0	0	2025-12-27 15:42:10.369084-05	2025-12-27 15:45:11.384329-05
3a265e2a-d7f5-4d76-a08d-6654b7f7f06b	1010	2025	12	64	0	64	40	0	40	40	0	0	0	0	0	2025-12-27 15:42:10.375069-05	2025-12-27 15:45:11.386421-05
289eafb6-e6af-4472-baff-2af911604cff	1102	2025	12	96	0	96	2	0	2	2	0	0	0	0	0	2025-12-27 15:42:10.381311-05	2025-12-27 15:45:11.387946-05
6b1b5c21-817d-48ba-9e69-845d1c81d1e5	1111	2025	12	122	0	122	8	0	8	4	0	0	0	0	0	2025-12-27 15:42:10.38841-05	2025-12-27 15:45:11.38976-05
970b2a3e-439f-48ab-8265-47dce1c3bd1d	1119	2025	12	246	0	246	0	0	0	10	0	0	0	0	0	2025-12-27 15:42:10.395678-05	2025-12-27 15:45:11.391777-05
b15fa437-7759-4bbe-929e-8dc461dd4bab	1121	2025	12	246	0	246	6	0	6	186	0	0	0	0	0	2025-12-27 15:42:10.404496-05	2025-12-27 15:45:11.3935-05
60556788-ad42-4615-bc74-f3834e9ab963	1122	2025	12	438	0	438	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.409235-05	2025-12-27 15:45:11.395973-05
e0ff9582-dedc-4273-b495-15e3536b2680	1210	2025	12	128	0	128	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.415489-05	2025-12-27 15:45:11.399428-05
b6eb0dae-118e-4533-9293-bd5b279c15c3	1212	2025	12	206	0	206	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.422247-05	2025-12-27 15:45:11.402669-05
3929956a-b661-4478-84cd-5f0d9d583749	1234	2025	12	176	0	176	0	0	0	34	0	0	0	0	0	2025-12-27 15:42:10.427886-05	2025-12-27 15:45:11.405581-05
ec14f1b1-af45-40b3-ac25-a12ef7a2e53e	1268	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.433479-05	2025-12-27 15:45:11.407368-05
77abe326-0d12-47ec-99c3-a7c3e9e43198	1278	2025	12	1380	0	1380	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.436387-05	2025-12-27 15:45:11.409759-05
4b871011-d711-4a38-96ea-cc3c1d1103b1	1303	2025	12	452	0	452	0	0	0	54	0	0	0	0	0	2025-12-27 15:42:10.438767-05	2025-12-27 15:45:11.411625-05
b7eaab0e-9ac2-443e-b727-ad822fd03f9a	1305	2025	12	4140	0	4140	12	0	12	10	0	0	0	0	0	2025-12-27 15:42:10.441193-05	2025-12-27 15:45:11.412959-05
807e69fe-fc4f-42f9-a03e-e72882ec3e52	1306	2025	12	72	0	72	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.443514-05	2025-12-27 15:45:11.414106-05
e8949f2e-401b-4e5b-9fa5-9a8050df0ea8	1313	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.445416-05	2025-12-27 15:45:11.416635-05
8ff6772b-8eaf-4029-8a42-be9ebf05799b	1423	2025	12	180	0	180	0	0	0	140	0	0	0	0	0	2025-12-27 15:42:10.447849-05	2025-12-27 15:45:11.418924-05
f3456a85-b1ab-4c78-81da-fcb014d95330	1472	2025	12	40	0	40	0	0	0	2	0	0	0	0	0	2025-12-27 15:42:10.449542-05	2025-12-27 15:45:11.420861-05
e6066d3c-2d0e-49df-a8b6-2e4f8339bbca	1491	2025	12	300	0	300	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.451111-05	2025-12-27 15:45:11.422832-05
1951b68f-7ed7-418d-9420-cfb8622fe2c5	1510	2025	12	17556	0	17556	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.454822-05	2025-12-27 15:45:11.425321-05
d5afe09b-0c57-44b4-9b26-aa0b44f5ae50	1606	2025	12	198	0	198	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.456612-05	2025-12-27 15:45:11.427151-05
2497151c-f74e-4258-90cd-0c98b5a4b687	1611	2025	12	58	0	58	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.458294-05	2025-12-27 15:45:11.429269-05
1781ff93-ef6b-4fd2-8837-5affc1c9d427	1612	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.460486-05	2025-12-27 15:45:11.432126-05
e944e8b1-ee61-4783-abfd-5a964c62ebdb	1614	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.462744-05	2025-12-27 15:45:11.433886-05
9512bd66-3c10-443b-98c1-8985031f8e16	1706	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.465093-05	2025-12-27 15:45:11.435936-05
de4193af-63b2-44b7-9e82-6a7092df9d74	1707	2025	12	216	0	216	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.467285-05	2025-12-27 15:45:11.437526-05
c465b3b1-d6fd-4b1b-8970-b97cfba9ed8f	1709	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.469017-05	2025-12-27 15:45:11.439404-05
37ca2af6-c3a1-468c-96bb-8937a380efdd	1758	2025	12	1488	0	1488	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.470421-05	2025-12-27 15:45:11.441299-05
0ec616d8-c4a7-47b5-8add-8280a61287be	1767	2025	12	284	0	284	20	0	20	20	0	0	0	0	0	2025-12-27 15:42:10.471762-05	2025-12-27 15:45:11.442838-05
7021c692-64ee-4b8f-9ad0-fd7c3e52ce41	1803	2025	12	222	0	222	0	0	0	48	0	0	0	0	0	2025-12-27 15:42:10.473195-05	2025-12-27 15:45:11.444549-05
ba3e5bad-f54f-421e-92ad-81b6124bbd41	1903	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.475577-05	2025-12-27 15:45:11.446471-05
da771265-abde-494e-b4b0-cc70889b3804	1917	2025	12	20	0	20	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.477731-05	2025-12-27 15:45:11.448477-05
1329422f-7764-400b-ace4-a4c14801fc02	1935	2025	12	142	0	142	100	0	100	32	0	0	0	0	0	2025-12-27 15:42:10.480528-05	2025-12-27 15:45:11.450349-05
8555285c-b1e0-47ea-94d8-a98b737fdc5d	1952	2025	12	660	0	660	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.58265-05	2025-12-27 15:45:11.454293-05
5991210c-1c96-49ad-9769-740c25400ba7	1967	2025	12	112	0	112	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.58511-05	2025-12-27 15:45:11.455906-05
6f36582c-836d-4e9d-8732-41f3703a857f	1970	2025	12	2248	0	2248	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.587944-05	2025-12-27 15:45:11.457755-05
6701d154-ef04-4e05-a32b-fe7d13d94f71	1973	2025	12	226	0	226	88	0	88	44	0	0	0	0	0	2025-12-27 15:42:10.590177-05	2025-12-27 15:45:11.459308-05
060f3717-7e1f-4671-8456-90190682d958	1975	2025	12	48	0	48	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.592297-05	2025-12-27 15:45:11.460617-05
a80b0916-6b07-4707-bb6f-69ae9bb18b50	1978	2025	12	260	0	260	4	0	4	2	0	0	0	0	0	2025-12-27 15:42:10.595345-05	2025-12-27 15:45:11.462173-05
bbcd3e82-7de5-4a82-9cb2-093241bed691	1985	2025	12	0	0	0	0	0	0	142	0	0	0	0	0	2025-12-27 15:42:10.597441-05	2025-12-27 15:45:11.463671-05
00b37435-ee08-422b-bd89-66e8d812290f	1987	2025	12	198	0	198	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.599917-05	2025-12-27 15:45:11.465159-05
55fdab68-e5ea-4538-9b96-b8427ec9016e	1992	2025	12	742	0	742	0	0	0	18	0	0	0	0	0	2025-12-27 15:42:10.602767-05	2025-12-27 15:45:11.46664-05
5f62df0a-c880-497e-a242-a44f828bd7de	1994	2025	12	36	0	36	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.604007-05	2025-12-27 15:45:11.468-05
d7fbc59c-ef39-460c-a1e3-6ad2213b8110	1995	2025	12	112	0	112	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.605329-05	2025-12-27 15:45:11.469337-05
101756b6-8405-40bd-b54b-25ab96165a67	1998	2025	12	518	0	518	24	0	24	114	0	0	0	0	0	2025-12-27 15:42:10.607064-05	2025-12-27 15:45:11.470615-05
8d86e28f-2c91-466a-873e-3b71b5f14999	2000	2025	12	250	0	250	6	0	6	6	0	0	0	0	0	2025-12-27 15:42:10.609068-05	2025-12-27 15:45:11.471795-05
9ed0925d-06a5-48ef-a6f0-4997098669b4	2001	2025	12	34	0	34	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.612098-05	2025-12-27 15:45:11.472812-05
03473377-b61c-45a8-bb82-d26095d08219	2002	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.614137-05	2025-12-27 15:45:11.473629-05
c77dbd9b-1127-4e15-8ec7-a6f791264372	2009	2025	12	258	0	258	16	0	16	72	0	0	0	0	0	2025-12-27 15:42:10.616241-05	2025-12-27 15:45:11.475011-05
c07ef0ef-e63f-4d33-9117-bdde2e19344a	2015	2025	12	382	0	382	60	0	60	62	0	0	0	0	0	2025-12-27 15:42:10.618669-05	2025-12-27 15:45:11.476496-05
4ae896a9-44e8-4d9b-bb42-c53272ee7e3e	2016	2025	12	1088	0	1088	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.620572-05	2025-12-27 15:45:11.477961-05
3857738d-e759-42b3-8ad3-ad1e6d4eba31	2020	2025	12	216	0	216	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.62239-05	2025-12-27 15:45:11.479396-05
d838577a-43aa-46ea-9f1a-9efce5097e5a	2022	2025	12	234	0	234	6	0	6	18	0	0	0	0	0	2025-12-27 15:42:10.624073-05	2025-12-27 15:45:11.480838-05
08199ad1-4dbe-4b81-904f-34dabd16b8f9	2023	2025	12	1066	0	1066	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.625874-05	2025-12-27 15:45:11.48241-05
b4ed74de-340c-4e18-993c-50df854a8675	2024	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.628638-05	2025-12-27 15:45:11.483756-05
99a03738-1615-4657-8dd6-9856b8cfe299	2025	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.630383-05	2025-12-27 15:45:11.48467-05
fe023350-2624-4d55-8429-c31530423e36	2026	2025	12	678	0	678	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.633452-05	2025-12-27 15:45:11.485472-05
33978071-d353-4ced-b0cd-a20b7e9bffc2	2027	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.637076-05	2025-12-27 15:45:11.486301-05
37496af2-8ed7-49d9-b30b-240a0ecebc09	2028	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.640196-05	2025-12-27 15:45:11.487094-05
b3bc9e51-9fb7-4326-ae0b-4c173c54c200	2084	2025	12	206	0	206	30	0	30	14	0	0	0	0	0	2025-12-27 15:42:10.643164-05	2025-12-27 15:45:11.487916-05
232330f2-2658-4006-9f53-5017d6d3a6f8	2201	2025	12	388	0	388	56	0	56	146	0	0	0	0	0	2025-12-27 15:42:10.655579-05	2025-12-27 15:45:11.490645-05
ca6c9181-47f7-41c6-a43c-e7b6a2100665	2203	2025	12	1798	0	1798	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.658796-05	2025-12-27 15:45:11.491494-05
a19da552-444f-47da-b8a6-37c3c9e985f1	2205	2025	12	152	0	152	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.662012-05	2025-12-27 15:45:11.492381-05
aa48e2f1-b773-40a8-b652-62f33f64778b	2211	2025	12	522	0	522	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.668617-05	2025-12-27 15:45:11.49374-05
715e1194-7d16-481e-894b-6b4cd63180e3	2213	2025	12	710	0	710	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.672675-05	2025-12-27 15:45:11.495222-05
74cc0f8e-7fce-4fce-8a18-18701d9ddcce	2223	2025	12	48	0	48	0	0	0	28	0	0	0	0	0	2025-12-27 15:42:10.677531-05	2025-12-27 15:45:11.496918-05
c0534e8e-0d35-4535-9924-27b8339b253f	2301	2025	12	266	0	266	140	0	140	154	0	0	0	0	0	2025-12-27 15:42:10.681205-05	2025-12-27 15:45:11.498228-05
0aad09db-4bdb-43ec-8680-8030e7f90522	2307	2025	12	46	0	46	8	0	8	70	0	0	0	0	0	2025-12-27 15:42:10.684238-05	2025-12-27 15:45:11.499532-05
1632faf1-ec41-496e-987e-8951a216a9cf	2356	2025	12	92	0	92	0	0	0	94	0	0	0	0	0	2025-12-27 15:42:10.687119-05	2025-12-27 15:45:11.500553-05
4bd3dc0e-a870-4bec-ae12-3ed4076033a2	2418	2025	12	620	0	620	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.690021-05	2025-12-27 15:45:11.501508-05
02a6ca59-ad22-47ff-8fa6-fbc37d4bd067	2424	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.693052-05	2025-12-27 15:45:11.502336-05
56ac81de-3176-49f1-a797-5c8342ed3c9e	2429	2025	12	290	0	290	4	0	4	6	0	0	0	0	0	2025-12-27 15:42:10.696949-05	2025-12-27 15:45:11.50315-05
1ec8df3a-e99f-4bb9-90c8-0e53a178f878	2502	2025	12	442	0	442	540	0	540	186	0	0	0	0	0	2025-12-27 15:42:10.699954-05	2025-12-27 15:45:11.503917-05
3172c63c-cb22-4747-a803-bb19d566c9dd	2503	2025	12	162	0	162	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.703705-05	2025-12-27 15:45:11.504764-05
fe02576e-a420-4d72-8135-304710397ac7	2527	2025	12	294	0	294	26	0	26	20	0	0	0	0	0	2025-12-27 15:42:10.707056-05	2025-12-27 15:45:11.505596-05
198c982f-2501-4b51-b2bc-bb9cbe3d513d	2620	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.711244-05	2025-12-27 15:45:11.506343-05
c01e7fd9-1545-4cb0-8c0d-eb3af7e0b433	2705	2025	12	2	0	2	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.714843-05	2025-12-27 15:45:11.507085-05
3d05b913-0bc5-4c46-8ec5-629f7dafa201	2708	2025	12	30	0	30	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.718388-05	2025-12-27 15:45:11.507869-05
93de9e2a-44f8-41e1-a914-7a85792277fa	2716	2025	12	582	0	582	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.723582-05	2025-12-27 15:45:11.508699-05
2fdc677d-312b-438d-864c-b8e509117585	2755	2025	12	2	0	2	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.726085-05	2025-12-27 15:45:11.509438-05
36443251-ef57-4c96-868f-f9fe43cc6671	2784	2025	12	128	0	128	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.728716-05	2025-12-27 15:45:11.510177-05
9b443f08-f20f-47aa-b83d-bde6a8bedd47	2904	2025	12	68	0	68	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.731344-05	2025-12-27 15:45:11.510939-05
739833f3-111f-472d-94c1-f6920ffa3aba	2905	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.733197-05	2025-12-27 15:45:11.511675-05
e4a7986c-1f14-4499-abb3-7b726bedad01	2953	2025	12	0	0	0	44	0	44	22	0	0	0	0	0	2025-12-27 15:42:10.735281-05	2025-12-27 15:45:11.512415-05
2928e7a4-a5de-4e8b-bc59-5fd694edaedb	3004	2025	12	268	0	268	62	0	62	40	0	0	0	0	0	2025-12-27 15:42:10.736659-05	2025-12-27 15:45:11.513135-05
2cdb555f-c1a2-4179-b7c9-23804b828e20	3005	2025	12	608	0	608	86	0	86	54	0	0	0	0	0	2025-12-27 15:42:10.738926-05	2025-12-27 15:45:11.513913-05
ad07eec1-4dc7-4e03-8d46-176d7f0bf280	3019	2025	12	0	0	0	6	0	6	4	0	0	0	0	0	2025-12-27 15:42:10.740959-05	2025-12-27 15:45:11.515317-05
688ac1eb-8e53-40fa-99e9-77e76e534197	3107	2025	12	36	0	36	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.742577-05	2025-12-27 15:45:11.516836-05
5d464a2d-8492-4266-85a5-297715a63424	3146	2025	12	264	0	264	26	0	26	14	0	0	0	0	0	2025-12-27 15:42:10.744536-05	2025-12-27 15:45:11.518128-05
25e88020-8bb9-4acc-a57a-ea57d39cd9cf	3333	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.746312-05	2025-12-27 15:45:11.519339-05
9a329c15-9391-4273-88ed-c9590c4e64e1	3824	2025	12	68	0	68	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.749996-05	2025-12-27 15:45:11.522099-05
941ddb1c-54a4-43d0-9586-5df858e2f321	4012	2025	12	496	0	496	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.752407-05	2025-12-27 15:45:11.523479-05
725c6b0c-2057-4985-96b4-5add2b28c65a	4013	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.755713-05	2025-12-27 15:45:11.524832-05
27647d01-0bc8-4514-83ea-00b9cb8a8044	4061	2025	12	974	0	974	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.758929-05	2025-12-27 15:45:11.526205-05
2aa42940-c7b6-4cd5-b44a-dcc5f29b790d	4086	2025	12	256	0	256	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.768388-05	2025-12-27 15:45:11.527622-05
b98b182b-9cf6-4f28-98fa-14cb25f95a58	4210	2025	12	92	0	92	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.779553-05	2025-12-27 15:45:11.532339-05
8fa49789-3818-4b9d-96f7-3cf0e2f470ec	4312	2025	12	22	0	22	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.783825-05	2025-12-27 15:45:11.533768-05
50de9dec-df8a-4f1a-b147-e9f278edb723	4321	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.78809-05	2025-12-27 15:45:11.534911-05
9312d3d3-9a76-4a54-817e-e53e79eb9c77	4423	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.794387-05	2025-12-27 15:45:11.535865-05
5806fb54-0854-4470-a1a9-25cc7afd2578	4523	2025	12	168	0	168	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.803129-05	2025-12-27 15:45:11.537023-05
718d5ec0-396e-441d-a557-aa25cdb51d3b	4775	2025	12	82	0	82	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.809194-05	2025-12-27 15:45:11.538134-05
935378dd-23aa-4cce-ab9c-e21ddc26a5f6	4858	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.813866-05	2025-12-27 15:45:11.539307-05
6552517c-56b2-4888-89ee-08f2e91a48a2	5020	2025	12	388	0	388	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.817796-05	2025-12-27 15:45:11.540429-05
6a63380f-36e9-4065-b246-bab197c1b28f	5467	2025	12	534	0	534	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.821707-05	2025-12-27 15:45:11.541462-05
3863165c-8410-488d-ae3b-4b852ad38994	5648	2025	12	268	0	268	0	0	0	20	0	0	0	0	0	2025-12-27 15:42:10.829402-05	2025-12-27 15:45:11.54237-05
88c1f116-dc21-41d9-9d92-d1d3e9af020e	6001	2025	12	256	0	256	4	0	4	4	0	0	0	0	0	2025-12-27 15:42:10.833769-05	2025-12-27 15:45:11.543591-05
dc55f195-d923-4e37-a17d-c316d23dbb12	6025	2025	12	282	0	282	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.837241-05	2025-12-27 15:45:11.544965-05
6ac624cc-5e7c-4553-8bca-2e15711ad1dc	6028	2025	12	128	0	128	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.842484-05	2025-12-27 15:45:11.546113-05
d81a64a1-cf11-4f85-b359-138a549e5f46	6034	2025	12	518	0	518	0	0	0	2	0	0	0	0	0	2025-12-27 15:42:10.847088-05	2025-12-27 15:45:11.547118-05
ea96df64-ea79-4487-a841-fe69209ed5f2	6037	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.84926-05	2025-12-27 15:45:11.548316-05
24f117da-c70d-43a7-9771-e915de724f7c	6048	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.851512-05	2025-12-27 15:45:11.550392-05
0355b20a-e77f-4dab-8614-bdcb5bb94c2f	6076	2025	12	522	0	522	2	0	2	2	0	0	0	0	0	2025-12-27 15:42:10.852833-05	2025-12-27 15:45:11.552298-05
1d9743ae-d218-40a3-bbfa-1c7d3090b124	6088	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.854295-05	2025-12-27 15:45:11.553428-05
031b6ebf-5f3d-4c3d-a992-a577dc9a3d88	6092	2025	12	64	0	64	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.855923-05	2025-12-27 15:45:11.554472-05
e4981db9-c7d4-4bdf-af72-d178509875c4	6097	2025	12	12	0	12	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.857285-05	2025-12-27 15:45:11.555453-05
0a0a74fa-944f-4e80-b852-9f9f42a97c4f	6281	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.85903-05	2025-12-27 15:45:11.556409-05
2ea8aa6e-14b6-45d3-b6eb-d68aecc26009	6336	2025	12	210	0	210	2	0	2	2	0	0	0	0	0	2025-12-27 15:42:10.861599-05	2025-12-27 15:45:11.557432-05
8c425f8f-1309-40b3-a914-6a7a0f151694	6568	2025	12	522	0	522	16	0	16	194	0	0	0	0	0	2025-12-27 15:42:10.864145-05	2025-12-27 15:45:11.558425-05
d623ca3f-e506-491a-9ca4-2dd2e773b89a	6754	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.865988-05	2025-12-27 15:45:11.559438-05
54467d41-ce68-45b0-af62-0c161eb2dc34	6784	2025	12	24	0	24	538	0	538	106	0	0	0	0	0	2025-12-27 15:42:10.867547-05	2025-12-27 15:45:11.560488-05
2e83335a-07b3-4927-9ed0-1b4bc63ad0e0	6871	2025	12	252	0	252	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.869189-05	2025-12-27 15:45:11.561475-05
44f7581c-628b-4f91-a506-a379b7d00a18	7005	2025	12	2	0	2	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.872048-05	2025-12-27 15:45:11.562394-05
58d0f041-0383-452c-a252-083ce75513bf	7012	2025	12	348	0	348	26	0	26	66	0	0	0	0	0	2025-12-27 15:42:10.879858-05	2025-12-27 15:45:11.564656-05
7b686f74-0721-4033-a9e4-fac9ea02e416	7021	2025	12	196	0	196	12	0	12	16	0	0	0	0	0	2025-12-27 15:42:10.88332-05	2025-12-27 15:45:11.566394-05
50a9d382-bde1-4f55-8a70-e8459cd40484	7026	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.890123-05	2025-12-27 15:45:11.567569-05
5d3eaaa0-5b41-4c09-8772-36028e6d4819	7032	2025	12	272	0	272	2	0	2	10	0	0	0	0	0	2025-12-27 15:42:10.894958-05	2025-12-27 15:45:11.568645-05
861d7c94-42ae-4e8b-9bb0-5a9c588c5bbd	7033	2025	12	16	0	16	0	0	0	36	0	0	0	0	0	2025-12-27 15:42:10.90011-05	2025-12-27 15:45:11.569706-05
14e48f39-e0bd-429f-92ae-81c0a669de27	7034	2025	12	116	0	116	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.903401-05	2025-12-27 15:45:11.570745-05
f58904a5-e499-492f-b7ef-24f6c48ae1b5	7035	2025	12	0	0	0	24	0	24	24	0	0	0	0	0	2025-12-27 15:42:10.908788-05	2025-12-27 15:45:11.571894-05
d1c5acfe-0b5a-4128-8348-2419e1fc65ba	7036	2025	12	48	0	48	0	0	0	52	0	0	0	0	0	2025-12-27 15:42:10.931715-05	2025-12-27 15:45:11.572875-05
7681201b-b7e8-4f82-b9d9-cbd490afdade	7045	2025	12	314	0	314	2	0	2	12	0	0	0	0	0	2025-12-27 15:42:10.936493-05	2025-12-27 15:45:11.573907-05
72d733bb-4987-4649-bc69-5ee00b9aba9d	7066	2025	12	8	0	8	0	0	0	34	0	0	0	0	0	2025-12-27 15:42:10.940792-05	2025-12-27 15:45:11.574904-05
d3cf7f7c-d231-456c-ba32-43abe98d644c	7067	2025	12	812	0	812	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.945891-05	2025-12-27 15:45:11.575904-05
9077f181-091c-4b1f-a645-cba439a464b1	7082	2025	12	384	0	384	4	0	4	56	0	0	0	0	0	2025-12-27 15:42:10.950482-05	2025-12-27 15:45:11.577075-05
9788e341-6793-4ab4-94c6-2e970497b7d8	7087	2025	12	112	0	112	0	0	0	16	0	0	0	0	0	2025-12-27 15:42:10.954863-05	2025-12-27 15:45:11.578285-05
de974c0f-9bf7-4093-a759-b87133eeca71	7091	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.958753-05	2025-12-27 15:45:11.579419-05
2b75d0fa-5eaf-441a-808f-f121ed12c9d9	7094	2025	12	712	0	712	0	0	0	30	0	0	0	0	0	2025-12-27 15:42:10.963538-05	2025-12-27 15:45:11.580625-05
9b8b2545-a3dd-4c6a-8c08-70ae9439b4a9	7097	2025	12	58	0	58	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.966454-05	2025-12-27 15:45:11.582897-05
d94e2d46-d76c-43b9-a1f7-7289bb47b957	7121	2025	12	348	0	348	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.96958-05	2025-12-27 15:45:11.584342-05
2f5e914a-5c6b-4be6-94ae-2ed4e0c74290	7214	2025	12	430	0	430	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.972303-05	2025-12-27 15:45:11.585724-05
10795d6d-4c9a-4eed-9a7b-38887d7cfd34	7216	2025	12	156	0	156	0	0	0	104	0	0	0	0	0	2025-12-27 15:42:10.975437-05	2025-12-27 15:45:11.586881-05
6c572c74-da4b-4624-b130-806c71006ad4	7496	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.978356-05	2025-12-27 15:45:11.587799-05
95770b21-89db-46fe-8fc5-2ab89a286998	7532	2025	12	136	0	136	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.980245-05	2025-12-27 15:45:11.588643-05
eb8e2d19-ee40-486d-ad67-55d8ff85471b	7605	2025	12	286	0	286	2	0	2	48	0	0	0	0	0	2025-12-27 15:42:10.983265-05	2025-12-27 15:45:11.589467-05
98ab93ec-d9a7-46d5-bb2e-76f040ef290c	7777	2025	12	2	0	2	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.985023-05	2025-12-27 15:45:11.590333-05
bcdf2aa7-253f-43b7-965a-b433bc370e24	7811	2025	12	6	0	6	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.986649-05	2025-12-27 15:45:11.591418-05
2e605af7-d3ad-4c39-a23b-84992fa224eb	7894	2025	12	0	0	0	176	0	176	108	0	0	0	0	0	2025-12-27 15:42:10.988185-05	2025-12-27 15:45:11.592611-05
023b3bce-7553-4f12-bb41-6bfb09fb2759	7907	2025	12	32	0	32	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.989407-05	2025-12-27 15:45:11.593501-05
5c34bb3c-fc36-4bc9-887a-c3601e15bd30	8005	2025	12	254	0	254	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.99073-05	2025-12-27 15:45:11.594351-05
bcfd9408-6589-4fc0-9e3e-eb7d357ef8be	8008	2025	12	176	0	176	4	0	4	10	0	0	0	0	0	2025-12-27 15:42:10.992044-05	2025-12-27 15:45:11.595121-05
a4066f0b-3255-4163-95af-b03885c9af2f	8010	2025	12	578	0	578	50	0	50	32	0	0	0	0	0	2025-12-27 15:42:10.993757-05	2025-12-27 15:45:11.595961-05
532bce82-bb78-48a8-a4d9-66485b0d7121	8011	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.995575-05	2025-12-27 15:45:11.596704-05
f11b1dc7-fc94-446f-bb87-543bb1cf4f80	8020	2025	12	534	0	534	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.999445-05	2025-12-27 15:45:11.598868-05
aedc789a-b923-4e6e-8651-ccafd2fc5ed3	8023	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.000991-05	2025-12-27 15:45:11.600021-05
6ce17deb-7a87-4263-aa56-8ca5d245ec5b	8025	2025	12	182	0	182	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.002223-05	2025-12-27 15:45:11.600837-05
1e3b97b7-a664-42c1-9882-a511a8004acc	8030	2025	12	952	0	952	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.003975-05	2025-12-27 15:45:11.602019-05
cf917e61-f740-4f83-8140-dcb4f6c4eb8b	8033	2025	12	198	0	198	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.005442-05	2025-12-27 15:45:11.602922-05
edd0ea38-fbc6-4467-aa50-33ea10f3f5df	8036	2025	12	0	0	0	12	0	12	6	0	0	0	0	0	2025-12-27 15:42:11.008268-05	2025-12-27 15:45:11.604502-05
0168de5f-2601-4889-836e-d5bd95c6f1fb	8040	2025	12	662	0	662	36	0	36	24	0	0	0	0	0	2025-12-27 15:42:11.011088-05	2025-12-27 15:45:11.605352-05
975ecbf8-7950-44a4-bd7a-787b309e94fb	8044	2025	12	60	0	60	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.013084-05	2025-12-27 15:45:11.606117-05
7c1cc88d-a67d-4527-9c15-2abae4f20ed1	8049	2025	12	96	0	96	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.015053-05	2025-12-27 15:45:11.606843-05
4ebb300f-cfa6-4d7f-bfb6-668983543f91	8050	2025	12	528	0	528	48	0	48	22	0	0	0	0	0	2025-12-27 15:42:11.016825-05	2025-12-27 15:45:11.607549-05
3a6e2f8a-bf7d-4842-b2c4-002237407ec3	8051	2025	12	202	0	202	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.018122-05	2025-12-27 15:45:11.608296-05
21c44dbd-e28b-4c10-83f4-cb88d6b36a5c	8058	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.019863-05	2025-12-27 15:45:11.60901-05
d7018018-4251-46c1-b608-00f35dce9f1d	8060	2025	12	412	0	412	16	0	16	8	0	0	0	0	0	2025-12-27 15:42:11.021433-05	2025-12-27 15:45:11.609691-05
ec165263-e1f0-4f6c-80d4-ab7e751360a3	8064	2025	12	252	0	252	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.02452-05	2025-12-27 15:45:11.610387-05
bfbbb674-57d2-4a67-af14-c949b9ee9c6e	8070	2025	12	334	0	334	8	0	8	4	0	0	0	0	0	2025-12-27 15:42:11.027737-05	2025-12-27 15:45:11.611371-05
86b2364b-c37c-4119-8732-e1f06455ab85	8074	2025	12	1334	0	1334	4	0	4	6	0	0	0	0	0	2025-12-27 15:42:11.030653-05	2025-12-27 15:45:11.612155-05
8de714cc-8f8b-47ad-8631-63de202ea1dd	8078	2025	12	94	0	94	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.033564-05	2025-12-27 15:45:11.612908-05
e53c53ad-e47d-4902-b66e-48e77b49cc11	8081	2025	12	1210	0	1210	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.036482-05	2025-12-27 15:45:11.613804-05
ed8dda0f-09d0-438a-9d35-6519c3d23909	8085	2025	12	208	0	208	72	0	72	16	0	0	0	0	0	2025-12-27 15:42:11.039232-05	2025-12-27 15:45:11.615066-05
ebacdd02-a422-4f18-8600-3a42fee251a1	8090	2025	12	182	0	182	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.042246-05	2025-12-27 15:45:11.616364-05
65ca8a9d-cfe4-4bc3-bd58-75ba3652ff96	8098	2025	12	262	0	262	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.046628-05	2025-12-27 15:45:11.617282-05
1d58cacd-9474-4153-b13d-5c46488e3fc8	8207	2025	12	94	0	94	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.049638-05	2025-12-27 15:45:11.61846-05
9a3fac30-d24f-458f-ad44-34214358d0bb	8346	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.052514-05	2025-12-27 15:45:11.619466-05
facd5132-5832-4f76-a3d3-05e271643850	8888	2025	12	178	0	178	12	0	12	12	0	0	0	0	0	2025-12-27 15:42:11.056336-05	2025-12-27 15:45:11.62032-05
d3d87d2e-5c21-4c7d-affb-99389acacd0c	8899	2025	12	398	0	398	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.059703-05	2025-12-27 15:45:11.621131-05
60664963-e240-4b0b-822c-c4eabab0726a	8919	2025	12	250	0	250	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.063264-05	2025-12-27 15:45:11.622344-05
c5469e32-94e8-4c88-b8e5-8ea7d1c2c259	9000	2025	12	740	0	740	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.067123-05	2025-12-27 15:45:11.623556-05
26e57a9e-b9c1-44cf-81d8-fdc795a9db38	9001	2025	12	276	0	276	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.070984-05	2025-12-27 15:45:11.624883-05
0025b569-0f06-4d19-b965-9ccc9fe0177e	9002	2025	12	1220	0	1220	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.074833-05	2025-12-27 15:45:11.625954-05
e6ac2561-c235-4004-8b5e-6062477c7683	9003	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.07942-05	2025-12-27 15:45:11.627-05
d384bcc5-954d-4f52-bcd3-71b8693e5381	9004	2025	12	4030	0	4030	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.084877-05	2025-12-27 15:45:11.628343-05
f9f32d6f-e017-466f-8d80-d7a8a58a1876	9005	2025	12	968	0	968	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.08988-05	2025-12-27 15:45:11.629538-05
13f4e372-9b2b-4bac-937d-ca7c1e4e17f4	9010	2025	12	154	0	154	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.097858-05	2025-12-27 15:45:11.632129-05
af44e3f5-fd68-4b43-9b7e-b2f338846fcd	9608	2025	12	934	0	934	26	0	26	498	0	0	0	0	0	2025-12-27 15:42:11.10243-05	2025-12-27 15:45:11.633818-05
f7c0311f-603d-4e98-b235-398fed9bd1f5	9736	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.106406-05	2025-12-27 15:45:11.635025-05
649c2624-2160-4415-b784-6f19e6d825bc	9815	2025	12	334	0	334	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.111604-05	2025-12-27 15:45:11.636531-05
21207b2e-8834-401a-862f-2bc913e056ef	9868	2025	12	26	0	26	4	0	4	16	0	0	0	0	0	2025-12-27 15:42:11.114503-05	2025-12-27 15:45:11.637768-05
494ebee3-7319-4b89-bc42-85c30f421fe1	9905	2025	12	588	0	588	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.11884-05	2025-12-27 15:45:11.638707-05
0596345b-76df-4048-af82-35a91a14aa91	12345	2025	12	8	0	8	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.121935-05	2025-12-27 15:45:11.639571-05
1c19bcf7-52b8-4948-b727-26753ebb8947	15160	2025	12	238	0	238	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.124721-05	2025-12-27 15:45:11.640689-05
c98a2664-752a-4058-b888-018dcd2f8ef6	15287	2025	12	16	0	16	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.127375-05	2025-12-27 15:45:11.641693-05
1f2be46e-f34b-48fd-863c-6a3025a759b0	15975	2025	12	38	0	38	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.129264-05	2025-12-27 15:45:11.642637-05
5bcd11b5-4ead-4254-9b60-580a6be75e44	17425	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.130982-05	2025-12-27 15:45:11.643525-05
25a42bf6-ea3b-41d4-b259-f80a158013e1	19932	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.132705-05	2025-12-27 15:45:11.644381-05
22fa4737-5124-4848-a2c4-82e5322eefd3	20250	2025	12	362	0	362	0	0	0	154	0	0	0	0	0	2025-12-27 15:42:11.134316-05	2025-12-27 15:45:11.645166-05
8560c82a-587c-447d-9dc3-8668083dbf4a	20251	2025	12	4	0	4	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.136016-05	2025-12-27 15:45:11.646064-05
51602c69-d5f4-493e-996e-6e1677f2f17c	21121	2025	12	112	0	112	4	0	4	146	0	0	0	0	0	2025-12-27 15:42:11.137429-05	2025-12-27 15:45:11.647196-05
80cc3d6c-5bbb-480b-8b83-c5727de1dad8	25049	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.138973-05	2025-12-27 15:45:11.648669-05
71a2fa9b-9688-464c-9a45-964d7864b3d0	25257	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.140474-05	2025-12-27 15:45:11.651615-05
850f500e-ebeb-4fbb-b4f0-19d8d8fef642	25366	2025	12	620	0	620	0	0	0	272	0	0	0	0	0	2025-12-27 15:42:11.141798-05	2025-12-27 15:45:11.652677-05
84ba1e4c-8325-455c-90ef-dbcf46d2a5dd	30111	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.14332-05	2025-12-27 15:45:11.653724-05
93ae16b6-a49b-4dc4-b075-5ba36f4d4425	44444	2025	12	462	0	462	0	0	0	90	0	0	0	0	0	2025-12-27 15:42:11.145449-05	2025-12-27 15:45:11.654885-05
fbe1bf76-8f40-4923-b52b-55c57d0c8339	052919	2025	12	1572	0	1572	2	0	2	28	0	0	0	0	0	2025-12-27 15:42:11.147535-05	2025-12-27 15:45:11.656207-05
7d5e3d13-c907-40e0-bea4-6c33d8511f53	54321	2025	12	178	0	178	48	0	48	202	0	0	0	0	0	2025-12-27 15:42:11.149588-05	2025-12-27 15:45:11.657133-05
93b4d59f-bd88-4ee8-998a-9bef77313f03	67890	2025	12	6	0	6	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.151304-05	2025-12-27 15:45:11.658308-05
2c2b328c-7876-4658-9d5b-7b69385a3443	70665	2025	12	1198	0	1198	12	0	12	114	0	0	0	0	0	2025-12-27 15:42:11.152973-05	2025-12-27 15:45:11.659322-05
4ba97fa9-f3f3-4ead-8257-ae30ff7a0bc1	77777	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.154489-05	2025-12-27 15:45:11.660184-05
65f9f5bf-1cfe-4b37-9cea-6a0f35a1341c	80262	2025	12	46	0	46	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.156038-05	2025-12-27 15:45:11.661078-05
c9bcb36a-b47f-491e-8189-da85f3f3a7aa	85020	2025	12	416	0	416	16	0	16	572	0	0	0	0	0	2025-12-27 15:42:11.157384-05	2025-12-27 15:45:11.661856-05
69138f1a-d7fe-4713-95fc-9abe5e63439d	88888	2025	12	14	0	14	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.158993-05	2025-12-27 15:45:11.662648-05
dcbe3cc5-27c5-4ddf-beaf-88e51fb5a68d	092312	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.160718-05	2025-12-27 15:45:11.663438-05
73027ae2-d195-4cf7-9a0d-a2da14eb9c4d	92312	2025	12	680	0	680	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.163379-05	2025-12-27 15:45:11.664455-05
20c29291-d39a-49aa-a45f-4d8ea439dcd2	100425	2025	12	164	0	164	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.167255-05	2025-12-27 15:45:11.667111-05
bd75e385-9970-4cb9-bf26-49830f4162a0	100591	2025	12	730	0	730	10	0	10	40	0	0	0	0	0	2025-12-27 15:42:11.168494-05	2025-12-27 15:45:11.667867-05
8dba30fa-7467-4e1f-b6c0-fd15b4c54f0f	123456	2025	12	126	0	126	44	0	44	22	0	0	0	0	0	2025-12-27 15:42:11.170394-05	2025-12-27 15:45:11.668647-05
58a55c53-7466-4521-b0ec-6bcdebaeb0b0	131313	2025	12	384	0	384	0	0	0	40	0	0	0	0	0	2025-12-27 15:42:11.172877-05	2025-12-27 15:45:11.66936-05
419aebfa-5ed1-4a88-8e8f-59b080322d73	142533	2025	12	0	0	0	4	0	4	38	0	0	0	0	0	2025-12-27 15:42:11.175648-05	2025-12-27 15:45:11.670102-05
5f56a75d-a5dc-4ec3-b8cd-08088dd1ecd2	0000	2025	12	396	0	396	504	0	504	334	0	0	0	0	0	2025-12-27 15:42:10.303468-05	2025-12-27 15:45:11.332088-05
55c946cc-05d7-4349-9037-4a11ed512516	0477	2025	12	146	0	146	18	0	18	12	0	0	0	0	0	2025-12-27 15:42:10.323426-05	2025-12-27 15:45:11.358199-05
90d12b20-3ac9-4e8e-8b25-a62236302fb3	1504	2025	12	122	0	122	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.452848-05	2025-12-27 15:45:11.424102-05
f02eeafb-c16e-4d69-a71b-c2967e1664b3	1937	2025	12	30	0	30	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.483476-05	2025-12-27 15:45:11.452354-05
84e56e29-fb03-48c8-a719-882ce7f2a569	2170	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.650943-05	2025-12-27 15:45:11.489392-05
86505506-1c61-4b9a-b719-76802d0668c4	3566	2025	12	546	0	546	14	0	14	234	0	0	0	0	0	2025-12-27 15:42:10.748134-05	2025-12-27 15:45:11.520717-05
527708ad-c251-45e4-a338-825fb844a060	4163	2025	12	250	0	250	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.773013-05	2025-12-27 15:45:11.528863-05
d5eac74f-5258-4342-a02b-c3318f1288fe	7007	2025	12	222	0	222	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:10.875581-05	2025-12-27 15:45:11.563389-05
54994ad3-c979-4465-8e28-fb45dc5d9efb	8014	2025	12	140	0	140	4	0	4	2	0	0	0	0	0	2025-12-27 15:42:10.997387-05	2025-12-27 15:45:11.597442-05
e838e6d0-0247-481c-b76f-4a0d48aed416	8035	2025	12	654	0	654	40	0	40	34	0	0	0	0	0	2025-12-27 15:42:11.006627-05	2025-12-27 15:45:11.60373-05
81f3e1ea-25bd-47a6-8793-06d3a70bdc20	9009	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.094152-05	2025-12-27 15:45:11.630555-05
96266e40-ae85-4e3c-9fc3-08e49554f555	97052	2025	12	46	0	46	4	0	4	6	0	0	0	0	0	2025-12-27 15:42:11.165479-05	2025-12-27 15:45:11.666102-05
020a0bf9-fea8-4409-a8c4-67606d1b09f5	150828	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.184568-05	2025-12-27 15:45:11.67083-05
68870bf0-79ce-4eae-916a-307f08ae9c47	170195	2025	12	294	0	294	4	0	4	18	0	0	0	0	0	2025-12-27 15:42:11.18755-05	2025-12-27 15:45:11.671547-05
52c9e8e3-dd7f-4408-b3fc-974eb0461922	181818	2025	12	38	0	38	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.192214-05	2025-12-27 15:45:11.672267-05
308e45a6-e5b1-45a8-9594-2bfbc19aad6c	191919	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.200659-05	2025-12-27 15:45:11.672964-05
8b9d14eb-e0c6-46bc-ab43-345f2a8bffc2	202130	2025	12	60	0	60	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.203703-05	2025-12-27 15:45:11.67365-05
36786d78-056f-4717-829a-f2011f38dc88	202526	2025	12	1018	0	1018	4	0	4	832	0	0	0	0	0	2025-12-27 15:42:11.207036-05	2025-12-27 15:45:11.674434-05
36ef6104-4c15-4f6e-875c-87ee61c712fc	232025	2025	12	98	0	98	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.20961-05	2025-12-27 15:45:11.675188-05
3cf5cecc-190f-4785-96bb-a98450f48d66	240114	2025	12	194	0	194	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.213435-05	2025-12-27 15:45:11.675886-05
c2c76214-68b1-45fe-b166-fb1be1680c11	320121	2025	12	0	0	0	14	0	14	110	0	0	0	0	0	2025-12-27 15:42:11.216701-05	2025-12-27 15:45:11.676564-05
897e07bc-e0ce-4f5b-840e-1977ecd7679c	333333	2025	12	160	0	160	46	0	46	68	0	0	0	0	0	2025-12-27 15:42:11.219588-05	2025-12-27 15:45:11.67732-05
58f4bc47-367e-4967-8190-1115e9b23f0d	425529	2025	12	562	0	562	8	0	8	430	0	0	0	0	0	2025-12-27 15:42:11.222283-05	2025-12-27 15:45:11.678046-05
6f9199cd-1319-4471-b6aa-e3d847220715	458501	2025	12	0	0	0	0	0	0	10	0	0	0	0	0	2025-12-27 15:42:11.224886-05	2025-12-27 15:45:11.678729-05
2246a0a9-e86e-43b2-ac3e-70cb486fdd67	555555	2025	12	232	0	232	0	0	0	2	0	0	0	0	0	2025-12-27 15:42:11.228965-05	2025-12-27 15:45:11.679473-05
60ecfee3-94d5-40f8-b52c-c3a4fe10f291	654321	2025	12	684	0	684	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.231729-05	2025-12-27 15:45:11.680203-05
5f3bd580-b913-40bc-8a3e-5979db220dc1	666666	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.235518-05	2025-12-27 15:45:11.68102-05
d3a1172a-e1d3-4e1d-ad49-059c318b1433	741836	2025	12	364	0	364	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.238365-05	2025-12-27 15:45:11.682783-05
5ac9f9a7-b773-4611-bf2f-c93d818837f0	808080	2025	12	12	0	12	286	0	286	220	0	0	0	0	0	2025-12-27 15:42:11.240831-05	2025-12-27 15:45:11.683799-05
15cb71a3-8bd9-4964-8cbd-2f95156ada8e	820408	2025	12	338	0	338	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.24387-05	2025-12-27 15:45:11.68458-05
891184ab-37d4-43db-82e9-48f125c91875	999999	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.246489-05	2025-12-27 15:45:11.685333-05
93197109-0a33-477a-a68a-62afea31dfcf	1234567	2025	12	498	0	498	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.249346-05	2025-12-27 15:45:11.686322-05
2e4729f3-b53b-46cb-829f-b81bea36f93f	2025432	2025	12	658	0	658	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.252131-05	2025-12-27 15:45:11.687195-05
cce5e707-69bd-452e-bec1-4a7a1887f54e	2025805	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.254812-05	2025-12-27 15:45:11.687983-05
6732b88a-8a12-4a83-a9bd-94354d203524	2025807	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.257508-05	2025-12-27 15:45:11.688695-05
8762a22f-f791-4776-b7bb-ff366c9cc77e	2025809	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.260385-05	2025-12-27 15:45:11.689731-05
9b3b5242-5b43-4171-8edd-71b4e58aacd5	02132856	2025	12	672	0	672	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.263665-05	2025-12-27 15:45:11.690895-05
8573edda-b92d-4b79-9b27-041269acf682	9101112	2025	12	100	0	100	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.265458-05	2025-12-27 15:45:11.692097-05
150fd212-2fc5-46f4-bf2d-68a2ee8ddaca	16684502	2025	12	0	0	0	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.267343-05	2025-12-27 15:45:11.693071-05
a99a979e-8742-43c6-93c9-79a1c687dabe	76314865	2025	12	620	0	620	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.268959-05	2025-12-27 15:45:11.693996-05
c827bfa5-8f71-468e-bcd1-0621a9483254	Other	2025	12	888	0	888	0	0	0	0	0	0	0	0	0	2025-12-27 15:42:11.273014-05	2025-12-27 15:45:11.695138-05
\.


--
-- Data for Name: prints_raw; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.prints_raw (id, user_id, report_timestamp, account_status, print_total, print_color, print_mono, copy_total, copy_color, copy_mono, scan_total, fax_total, import_batch_id, created_at) FROM stdin;
fd2b8006-6e1f-461d-94f6-27f079f0514a	demo-admin-001	2024-12-01 04:00:00-05	Normal	250	100	150	120	50	70	80	15	\N	2025-12-27 14:25:24.320036-05
32124fcc-eefb-47cf-be98-95ac507de5ca	demo-admin-001	2024-11-01 04:00:00-05	Normal	200	80	120	100	40	60	60	10	\N	2025-12-27 14:25:24.320036-05
0be90b87-ae67-4260-8693-a00933fad6dc	demo-user-001	2024-12-01 04:00:00-05	Normal	150	60	90	80	30	50	40	8	\N	2025-12-27 14:25:24.320036-05
db24e910-41f5-4db8-b251-0fcd803d949b	demo-user-001	2024-11-01 04:00:00-05	Normal	120	45	75	60	25	35	30	5	\N	2025-12-27 14:25:24.320036-05
a3245656-1a74-4b65-a409-1fcbed9724f1	demo-user-002	2024-12-01 04:00:00-05	Normal	180	70	110	90	35	55	50	12	\N	2025-12-27 14:25:24.320036-05
48daf3f3-8ea4-431d-a45a-2922820c028b	demo-user-002	2024-11-01 04:00:00-05	Normal	160	55	105	75	30	45	45	8	\N	2025-12-27 14:25:24.320036-05
78645d78-ae45-4d8d-b4c9-86df3a660f0d	demo-admin-001	2025-12-01 10:00:00-05	Normal	150	60	90	100	40	60	30	5	\N	2025-12-27 14:59:39.521143-05
30b56e37-66b5-4882-a4cb-5da06fa154a5	demo-admin-001	2025-12-15 14:30:00-05	Normal	300	120	180	220	80	140	55	10	\N	2025-12-27 14:59:39.521143-05
94467aa8-7004-44bc-9124-664532c85366	demo-user-001	2025-12-05 09:15:00-05	Normal	100	35	65	70	25	45	20	3	\N	2025-12-27 14:59:39.521143-05
7e659892-b438-4a4d-9e05-d0ee748cb9f2	demo-user-001	2025-12-20 16:45:00-05	Normal	180	65	115	120	45	75	25	5	\N	2025-12-27 14:59:39.521143-05
57fee55a-0b76-4c1c-9aa5-017dac055981	demo-user-002	2025-12-10 11:20:00-05	Normal	120	45	75	80	30	50	25	4	\N	2025-12-27 14:59:39.521143-05
c5257862-398d-49d3-bc03-ab889eb1c183	demo-user-002	2025-12-22 13:00:00-05	Normal	190	75	115	130	50	80	30	8	\N	2025-12-27 14:59:39.521143-05
e39f9916-4d18-4d1f-bfe6-078772bd846e	0000	2025-12-03 17:16:14-05	Normal	198	0	198	252	0	252	167	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.294718-05
54e98256-ed3a-4894-8a79-82dffd9451bb	0104	2025-12-03 17:16:14-05	Normal	30	0	30	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.306097-05
28557cd2-efde-4af7-9ba9-96824f4f18b4	0116	2025-12-03 17:16:14-05	Normal	18	0	18	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.308081-05
fb06ccb1-8918-4af0-a3ac-8ccd6203f1b3	0207	2025-12-03 17:16:14-05	Normal	612	0	612	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.310311-05
d3b2bc31-f77d-4155-b395-a81c937767d5	0218	2025-12-03 17:16:14-05	Normal	122	0	122	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.312533-05
bebb0ba9-aef3-43ba-984e-718db83bd4c6	0306	2025-12-03 17:16:14-05	Normal	62	0	62	1	0	1	1	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.314345-05
dd242da1-5e3b-4aa4-959b-c5346c725658	0325	2025-12-03 17:16:14-05	Normal	273	0	273	18	0	18	103	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.316308-05
d2c2f441-5d45-49de-91fd-983f368e82f8	0408	2025-12-03 17:16:14-05	Normal	9	0	9	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.31792-05
bab15296-950c-470d-9ec8-e90344edc69b	0409	2025-12-03 17:16:14-05	Normal	35	0	35	9	0	9	43	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.319611-05
a3ee30d7-1128-48e9-b160-fa0e1f633c6d	0424	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.321134-05
8ef3b61a-e730-46cb-a0d9-35f078a98f70	0477	2025-12-03 17:16:14-05	Normal	73	0	73	9	0	9	6	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.32281-05
12a45e05-928b-4f1c-ac75-3e2653a68800	0505	2025-12-03 17:16:14-05	Normal	21	0	21	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.324558-05
5be94de7-b52d-45e8-902a-d9b9a8874e07	0525	2025-12-03 17:16:14-05	Normal	5	0	5	6	0	6	6	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.326127-05
22ce4e42-5b2a-400a-9c2e-04e64c6a651f	0624	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.327967-05
e08b10d4-fb5b-4a16-960b-dd88a96b673c	0712	2025-12-03 17:16:14-05	Normal	113	0	113	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.329624-05
c7e8eee3-6c70-4635-89a1-cdf93484acfb	0729	2025-12-03 17:16:14-05	Normal	50	0	50	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.331544-05
d7a03aa0-e4ab-419f-acaf-f5bc710dab25	0803	2025-12-03 17:16:14-05	Normal	230	0	230	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.335587-05
5ea417b1-8be5-4359-8c5d-d76fc2abde97	0819	2025-12-03 17:16:14-05	Normal	56	0	56	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.338902-05
ffc168a7-44a0-4037-b4ed-eb0c2ed49599	0821	2025-12-03 17:16:14-05	Normal	28	0	28	2	0	2	2	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.345889-05
b5fcdbd3-7761-4f03-9f6d-53c4fb48ffb8	0825	2025-12-03 17:16:14-05	Normal	8	0	8	2	0	2	3	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.350084-05
ce4f8bcb-5468-4082-b453-d87e1c0681d4	0826	2025-12-03 17:16:14-05	Normal	19	0	19	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.357324-05
9b431f74-cf17-4757-8a9a-7b3afa9d72c0	0934	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.361896-05
51a2bce7-e762-40a5-a5c2-56e3a678dfd3	1004	2025-12-03 17:16:14-05	Normal	284	0	284	23	0	23	125	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.367657-05
8122ed89-2ed5-40ea-8df5-cc9946b3ebd7	1010	2025-12-03 17:16:14-05	Normal	32	0	32	20	0	20	20	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.373675-05
589c3dec-1e7d-45f5-b839-674fd48fadfb	1102	2025-12-03 17:16:14-05	Normal	48	0	48	1	0	1	1	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.379687-05
17621720-f1eb-4a6a-9917-0ef19c3de114	1111	2025-12-03 17:16:14-05	Normal	61	0	61	4	0	4	2	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.386967-05
64b53850-8d9e-4b99-ac24-fe7b764b5417	1119	2025-12-03 17:16:14-05	Normal	123	0	123	0	0	0	5	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.394647-05
656563c0-5aa8-43be-96f4-0580195f5e06	1121	2025-12-03 17:16:14-05	Normal	123	0	123	3	0	3	93	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.402756-05
253bcae3-d896-4c9d-9f2a-fa312579447f	1122	2025-12-03 17:16:14-05	Normal	219	0	219	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.407656-05
2f4c6724-b32a-4f1b-abd5-fe7b6bfefa5b	1210	2025-12-03 17:16:14-05	Normal	64	0	64	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.413797-05
aef33620-7dd4-475e-bc53-f147f0324c69	1212	2025-12-03 17:16:14-05	Normal	103	0	103	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.420793-05
3a8c0600-01c9-485d-a217-58247f50798d	1234	2025-12-03 17:16:14-05	Normal	88	0	88	0	0	0	17	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.424588-05
cac0df88-1444-457e-a192-d5d8d9979d05	1268	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.432154-05
f2cd2899-2596-4273-80fb-c5bf0596ff9f	1278	2025-12-03 17:16:14-05	Normal	690	0	690	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.435615-05
7293ee14-f609-4bab-ab8c-40b2b8c08019	1303	2025-12-03 17:16:14-05	Normal	226	0	226	0	0	0	27	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.438014-05
cb71fbb5-643b-4d58-b67c-f5ebb8e7093d	1305	2025-12-03 17:16:14-05	Normal	2070	0	2070	6	0	6	5	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.439994-05
0a55ac9e-ccf5-47ef-bbf5-e26bbfc9cd73	1306	2025-12-03 17:16:14-05	Normal	36	0	36	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.442597-05
d90be1ef-3bfd-4206-bd24-13f67b11de7e	1313	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.44482-05
4f2366d8-01d3-4b40-9eb4-bc40fa654a72	1423	2025-12-03 17:16:14-05	Normal	90	0	90	0	0	0	70	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.447297-05
3493905b-28a6-4d27-947b-b63f53ddd56e	1472	2025-12-03 17:16:14-05	Normal	20	0	20	0	0	0	1	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.449037-05
3ae48538-da55-4c3b-8487-f17ce65b209e	1491	2025-12-03 17:16:14-05	Normal	150	0	150	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.450487-05
f274ceff-87fd-4533-a751-603cc3887ba6	1504	2025-12-03 17:16:14-05	Normal	61	0	61	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.452337-05
7902b824-c131-4e48-bb7b-afb106b53987	1510	2025-12-03 17:16:14-05	Normal	8778	0	8778	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.454222-05
53dac52b-3a6a-41c7-b529-07f58f60fdf6	1606	2025-12-03 17:16:14-05	Normal	99	0	99	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.455937-05
c5fa0a17-1261-4e88-b357-0beaca8f392e	1611	2025-12-03 17:16:14-05	Normal	29	0	29	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.457641-05
2610df4d-c112-4dd2-90b6-228b24f3045c	1612	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.459513-05
a097e0c0-ec52-4b25-878b-0b04be3e66a4	1614	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.462096-05
5207a39d-bdfc-4718-bc66-7e1cb6542bd0	1706	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.464018-05
2dd7f395-0726-433c-b758-5096615be9f7	1707	2025-12-03 17:16:14-05	Normal	108	0	108	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.466633-05
bfab8f2e-bfee-4aaf-b1b0-e92a0b8c3e1d	1709	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.468356-05
8cc63feb-f771-45dc-a1b5-e7bf09b43b62	1758	2025-12-03 17:16:14-05	Normal	744	0	744	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.46997-05
d8e6b4fd-1dcc-45fc-8400-7bfafb80e195	1767	2025-12-03 17:16:14-05	Normal	142	0	142	10	0	10	10	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.471375-05
eb3f8ffd-50ec-4693-8d17-4326e6685338	1803	2025-12-03 17:16:14-05	Normal	111	0	111	0	0	0	24	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.472706-05
2ef6b4b4-ff97-4600-a0ed-cf93d3429061	1903	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.474319-05
159d9bbe-c624-48e6-a1e2-024bc2b35a0e	1917	2025-12-03 17:16:14-05	Normal	10	0	10	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.476967-05
6d7d4b05-14a2-45e6-9e32-b38b9b90fb81	1935	2025-12-03 17:16:14-05	Normal	71	0	71	50	0	50	16	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.479463-05
2a63119e-18b6-4550-ac13-cf785ded1dc1	1937	2025-12-03 17:16:14-05	Normal	15	0	15	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.482483-05
51fa015a-b408-46ed-9b31-6db1e201ca42	1952	2025-12-03 17:16:14-05	Normal	330	0	330	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.581704-05
4c6ac9b3-2cee-4e74-8d54-5b6038f24d77	1967	2025-12-03 17:16:14-05	Normal	56	0	56	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.584309-05
23ef32e0-5396-4cfd-87df-7b822c0b5166	1970	2025-12-03 17:16:14-05	Normal	1124	0	1124	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.587184-05
1efa99b5-03d2-4dff-82ad-5dfc771c7f48	1973	2025-12-03 17:16:14-05	Normal	113	0	113	44	0	44	22	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.589458-05
af1e0b5a-4c19-4797-90ae-ed38a97822b9	1975	2025-12-03 17:16:14-05	Normal	24	0	24	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.591685-05
c86e773b-c5da-42e6-aecd-90e06a2c286f	1978	2025-12-03 17:16:14-05	Normal	130	0	130	2	0	2	1	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.594221-05
03f06914-aa3a-4904-9ac2-0d8e942af369	1985	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	71	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.596645-05
e08afa17-fb51-4f7b-811f-b80119c9c3d2	1987	2025-12-03 17:16:14-05	Normal	99	0	99	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.598783-05
ced2c3d3-5de7-4528-a695-14a72cdfcecc	1992	2025-12-03 17:16:14-05	Normal	371	0	371	0	0	0	9	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.602262-05
a51f3cfe-832c-49a1-b3c4-27719668e2d4	1994	2025-12-03 17:16:14-05	Normal	18	0	18	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.603614-05
acdc819e-efe5-4ae3-8fff-bdc2ea9a8257	1995	2025-12-03 17:16:14-05	Normal	56	0	56	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.604895-05
f8bb42cc-6bab-4ad4-a561-5e9febbeab8d	1998	2025-12-03 17:16:14-05	Normal	259	0	259	12	0	12	57	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.606579-05
7b4d7a2a-4843-45bd-9700-f50caa139603	2000	2025-12-03 17:16:14-05	Normal	125	0	125	3	0	3	3	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.608556-05
68d704e2-c7a9-4f4f-b199-5357b8872df9	2001	2025-12-03 17:16:14-05	Normal	17	0	17	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.611192-05
ab4c572b-d90c-4a1b-b69c-bb57df6e8067	2002	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.61339-05
ce11d2aa-8055-4c57-9853-a006dfe6d790	2009	2025-12-03 17:16:14-05	Normal	129	0	129	8	0	8	36	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.615637-05
664fb233-7fd8-4da6-b4cb-e1411f74e0a0	2015	2025-12-03 17:16:14-05	Normal	191	0	191	30	0	30	31	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.618197-05
0c298724-45c9-4525-9b5a-452a9fb1a14d	2016	2025-12-03 17:16:14-05	Normal	544	0	544	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.619941-05
40e1759e-ebf6-4992-8262-7b8040d6fee1	2020	2025-12-03 17:16:14-05	Normal	108	0	108	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.621595-05
b1914bc8-105f-4c6a-8d10-f19b5c554888	2022	2025-12-03 17:16:14-05	Normal	117	0	117	3	0	3	9	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.623594-05
cc4fe7a5-b04a-4eec-b031-b2109530162d	2023	2025-12-03 17:16:14-05	Normal	533	0	533	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.625412-05
20b2dfb9-0d6f-4b92-9164-2ef1e526241a	2024	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.628005-05
b8a3d61a-8522-4a44-b527-2d4d66bbc896	2025	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.62987-05
9f44ea0f-8beb-4bf1-bbae-e695dbb0f3e8	2026	2025-12-03 17:16:14-05	Normal	339	0	339	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.632557-05
f99a9a6b-f70f-4eeb-9866-24339c4b5c52	2027	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.636144-05
99f0bac8-a27b-4928-a7c0-f7db0bce6738	2028	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.639239-05
2a633327-b73a-464c-babf-b11c3147d7f0	2084	2025-12-03 17:16:14-05	Normal	103	0	103	15	0	15	7	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.642258-05
6cacb141-2fa7-45e1-9c8b-5bcb5e894003	2170	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.648573-05
d2c61ba8-8eba-4d7a-8207-b629642289b1	2201	2025-12-03 17:16:14-05	Normal	194	0	194	28	0	28	73	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.654587-05
5bf73559-8c78-410d-8976-bed6752589fb	2203	2025-12-03 17:16:14-05	Normal	899	0	899	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.657855-05
a477af91-3e24-417f-acf7-c3c11f69f93d	2205	2025-12-03 17:16:14-05	Normal	76	0	76	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.661037-05
d8135198-4c8c-47e6-aa8b-ed9e59f46ef6	2211	2025-12-03 17:16:14-05	Normal	261	0	261	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.667659-05
e08f4932-d379-4d40-be71-2bfdbcecb9cb	2213	2025-12-03 17:16:14-05	Normal	355	0	355	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.671769-05
8f1c50ee-495e-462b-a431-feeeafba2384	2223	2025-12-03 17:16:14-05	Normal	24	0	24	0	0	0	14	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.675803-05
1ef909b7-96d7-4afe-a45a-3a99dc6c310c	2301	2025-12-03 17:16:14-05	Normal	133	0	133	70	0	70	77	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.680224-05
ec41e16d-5923-447b-bdee-e1aef6ea9e5f	2307	2025-12-03 17:16:14-05	Normal	23	0	23	4	0	4	35	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.683293-05
441c88b1-6a9d-4869-9355-d63929872fc3	2356	2025-12-03 17:16:14-05	Normal	46	0	46	0	0	0	47	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.68617-05
29ff9764-7fec-41e2-8ea6-4d57df1c3198	2418	2025-12-03 17:16:14-05	Normal	310	0	310	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.689083-05
b0af53b9-f98b-4e51-974e-bfadb246414f	2424	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.692093-05
a2727136-5c6a-470a-961a-e7d3df18f877	2429	2025-12-03 17:16:14-05	Normal	145	0	145	2	0	2	3	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.69583-05
a1eed596-2638-410b-87e7-bc026a990017	2502	2025-12-03 17:16:14-05	Normal	221	0	221	270	0	270	93	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.699004-05
ecc58c75-ab09-4aa4-9ec9-7480209729c8	2503	2025-12-03 17:16:14-05	Normal	81	0	81	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.702553-05
a538dbab-a9ed-4ba9-9814-1de2ab82e962	2527	2025-12-03 17:16:14-05	Normal	147	0	147	13	0	13	10	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.706032-05
b5a27633-5cdd-4ae6-9824-d55179a8a48b	2620	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.709254-05
00536121-6b3e-410e-9ee6-731b2ab837b7	2705	2025-12-03 17:16:14-05	Normal	1	0	1	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.713663-05
389f99f6-36a4-4bf0-be79-0073f2461474	2708	2025-12-03 17:16:14-05	Normal	15	0	15	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.717206-05
2c69a6a7-e803-477d-a14d-c525c451213e	2716	2025-12-03 17:16:14-05	Normal	291	0	291	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.72271-05
5a39e408-caa5-4df1-81cc-8c3d478527ee	2755	2025-12-03 17:16:14-05	Normal	1	0	1	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.725194-05
d6dca710-c348-41d9-8d4d-857c2673d822	2784	2025-12-03 17:16:14-05	Normal	64	0	64	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.727984-05
5cd8d215-48e3-43b7-9687-4ed8a44cbe04	2904	2025-12-03 17:16:14-05	Normal	34	0	34	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.730536-05
f5ec2fb0-2c66-465c-8358-bc59d3165fa9	2905	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.732688-05
cf5f1824-5f06-403b-aab8-4b58258741e0	2953	2025-12-03 17:16:14-05	Normal	0	0	0	22	0	22	11	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.734637-05
3d1a384c-a916-4dd8-97f8-f5f0d8b7dded	3004	2025-12-03 17:16:14-05	Normal	134	0	134	31	0	31	20	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.736237-05
f93c2248-16f1-4a75-bc55-f96c557c7edd	3005	2025-12-03 17:16:14-05	Normal	304	0	304	43	0	43	27	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.738179-05
b36362ce-4dc1-4028-ad47-e1632cb38c8d	3019	2025-12-03 17:16:14-05	Normal	0	0	0	3	0	3	2	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.740394-05
fbac7a8c-5e06-4d2b-a9de-8d39b74deedc	3107	2025-12-03 17:16:14-05	Normal	18	0	18	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.742053-05
6dbde940-9513-474c-8050-7b50be9d9d84	3146	2025-12-03 17:16:14-05	Normal	132	0	132	13	0	13	7	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.74382-05
9bbda1fc-c061-4ebb-af4c-151bb1f83183	3333	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.74578-05
a3b8882a-7ea0-4a0a-bd47-9b58a6840291	3566	2025-12-03 17:16:14-05	Normal	273	0	273	7	0	7	117	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.747642-05
9b814e29-21f7-41a7-b306-d2f8082d7af1	3824	2025-12-03 17:16:14-05	Normal	34	0	34	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.7494-05
5d7cab41-b0d8-4b0f-8ba0-cfb3f57dfc4c	4012	2025-12-03 17:16:14-05	Normal	248	0	248	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.751336-05
84d63b4c-68e2-4c44-aecf-c8c8e9f0dca3	4013	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.754682-05
7136dfbf-16b6-4533-9bbd-f2961a96fe8a	4061	2025-12-03 17:16:14-05	Normal	487	0	487	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.757889-05
17be2079-ac0a-4b8a-8eab-9589eec77076	4086	2025-12-03 17:16:14-05	Normal	128	0	128	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.767164-05
fc49c133-1a4d-42f7-8185-89204ea5cad9	4163	2025-12-03 17:16:14-05	Normal	125	0	125	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.772089-05
4209195f-138a-4e49-a27f-2bf96088789a	4210	2025-12-03 17:16:14-05	Normal	46	0	46	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.778431-05
1ba5113a-552f-4e4e-b19b-14f559fa3bac	4312	2025-12-03 17:16:14-05	Normal	11	0	11	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.78273-05
cc78514b-eea0-4671-88c2-4dc384f2081b	4321	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.787146-05
a3ddd723-bead-4abd-b8a5-f62fb12893e8	4423	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.793077-05
3a26b841-68d3-426a-9ecf-c724ada847e3	4523	2025-12-03 17:16:14-05	Normal	84	0	84	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.799185-05
c4731f50-7442-4356-98ba-4ff3a804ffc8	4775	2025-12-03 17:16:14-05	Normal	41	0	41	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.807854-05
f717e713-2538-4c57-a9ee-d473748ff1eb	4858	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.812632-05
213b5601-e829-42f4-b585-60958438f404	5020	2025-12-03 17:16:14-05	Normal	194	0	194	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.81657-05
6426a45c-cf58-44fb-9849-1d3ec4558cc7	5467	2025-12-03 17:16:14-05	Normal	267	0	267	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.82016-05
49da6405-89be-4017-8fe6-7454e2570093	5648	2025-12-03 17:16:14-05	Normal	134	0	134	0	0	0	10	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.824155-05
7115ff6b-0474-4693-95fb-96a14017b78f	6001	2025-12-03 17:16:14-05	Normal	128	0	128	2	0	2	2	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.832096-05
4c0ce669-6a6d-41bd-9ba7-b6fb57ee0bcb	6025	2025-12-03 17:16:14-05	Normal	141	0	141	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.836144-05
8ee919e7-7370-4ab2-80b9-1532496f1ed2	6028	2025-12-03 17:16:14-05	Normal	64	0	64	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.841244-05
92845cf8-831e-43bc-90f5-7bb65aa32680	6034	2025-12-03 17:16:14-05	Normal	259	0	259	0	0	0	1	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.846159-05
f25a0d52-7995-41cc-a078-4aca027f1c46	6037	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.848574-05
77548c0a-3055-4834-8b9d-d4a39f609a74	6048	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.850618-05
6220a62a-bde3-48dd-b226-22573ea26be3	6076	2025-12-03 17:16:14-05	Normal	261	0	261	1	0	1	1	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.852439-05
5a294e2e-8344-471d-950f-6d2d0ce333d0	6088	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.853615-05
c87559c8-df0c-42d7-a432-49697843e839	6092	2025-12-03 17:16:14-05	Normal	32	0	32	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.855336-05
ce03bfc7-8172-4225-a84e-913f6efa087c	6097	2025-12-03 17:16:14-05	Normal	6	0	6	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.856782-05
386836a5-654f-472e-bbe5-53e84df3a547	6281	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.858407-05
ca1c0ec8-e57a-41a8-93a9-33997c8eab5b	6336	2025-12-03 17:16:14-05	Normal	105	0	105	1	0	1	1	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.860489-05
6903b594-190f-4d8b-865a-b84b5d8a394d	6568	2025-12-03 17:16:14-05	Normal	261	0	261	8	0	8	97	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.863255-05
8d6174bc-e069-433e-9c06-e898fede5739	6754	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.8654-05
82d8ec0f-f23e-4a7c-b56a-c0477269e642	6784	2025-12-03 17:16:14-05	Normal	12	0	12	269	0	269	53	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.866984-05
fc8b0fd3-fd33-44e9-81f9-bb66a5997c62	6871	2025-12-03 17:16:14-05	Normal	126	0	126	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.868568-05
a5af1be1-7b6a-4f1f-af97-20bf37250fe6	7005	2025-12-03 17:16:14-05	Normal	1	0	1	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.871093-05
357cac13-7ea7-4361-ad1d-5103c117a5bc	7007	2025-12-03 17:16:14-05	Normal	111	0	111	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.874368-05
9b2adcc4-bff0-4fd4-b2df-31cf118b8870	7012	2025-12-03 17:16:14-05	Normal	174	0	174	13	0	13	33	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.878835-05
cbde93b8-00e0-44d3-93b6-ec0fc8dcf020	7021	2025-12-03 17:16:14-05	Normal	98	0	98	6	0	6	8	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.882249-05
6d8dc6ee-425d-4ac7-aad4-c85e4b092cd9	7026	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.885908-05
470c1a6f-e69c-4265-8c32-6a62da1264a1	7032	2025-12-03 17:16:14-05	Normal	136	0	136	1	0	1	5	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.892401-05
417ab09b-9a20-47ab-b1fe-4a1c8d50bf17	7033	2025-12-03 17:16:14-05	Normal	8	0	8	0	0	0	18	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.897795-05
6934125b-bced-42c7-b779-a3d077df5a2b	7034	2025-12-03 17:16:14-05	Normal	58	0	58	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.902441-05
10c88965-db94-4258-a27f-5150885774b2	7035	2025-12-03 17:16:14-05	Normal	0	0	0	12	0	12	12	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.907479-05
9db637f7-bbf0-407d-b087-ca5363d4f0aa	7036	2025-12-03 17:16:14-05	Normal	24	0	24	0	0	0	26	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.930166-05
17a05f17-a159-4f27-bf85-b3e8ab87b8ca	7045	2025-12-03 17:16:14-05	Normal	157	0	157	1	0	1	6	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.935157-05
f8b55bcd-7878-498a-a3af-dae1a5ff1950	7066	2025-12-03 17:16:14-05	Normal	4	0	4	0	0	0	17	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.939422-05
1d82bada-61bf-4369-a0b3-920d2cbd11b8	7067	2025-12-03 17:16:14-05	Normal	406	0	406	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.944523-05
8425197d-b8dd-4d6c-9d6c-1a56f0f49596	7082	2025-12-03 17:16:14-05	Normal	192	0	192	2	0	2	28	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.94899-05
68afb28d-d222-4782-b839-9c901736b808	7087	2025-12-03 17:16:14-05	Normal	56	0	56	0	0	0	8	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.953483-05
948b8ea1-edca-428e-b3d9-7dafa07aa9bd	7091	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.957295-05
5f2973bc-ea6c-43f0-aff0-6f15f70c6034	7094	2025-12-03 17:16:14-05	Normal	356	0	356	0	0	0	15	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.962529-05
af601b6f-ca6e-416a-885f-8760c86e0aa3	7097	2025-12-03 17:16:14-05	Normal	29	0	29	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.965483-05
4476d939-2cad-4491-bbe1-0232a2c09433	7121	2025-12-03 17:16:14-05	Normal	174	0	174	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.968612-05
0cd29996-3168-4b4d-a6de-0a0967409229	7214	2025-12-03 17:16:14-05	Normal	215	0	215	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.971428-05
78af166e-11b4-4cb1-866b-dbd0732a3927	7216	2025-12-03 17:16:14-05	Normal	78	0	78	0	0	0	52	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.974399-05
fd5b8e8c-0eb9-4770-8728-8b240d003b79	7496	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.977695-05
8665cf15-e617-46f9-b80e-a5bfe552af6a	7532	2025-12-03 17:16:14-05	Normal	68	0	68	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.979627-05
460a7558-4a68-4b5f-b760-486afa88bdd0	7605	2025-12-03 17:16:14-05	Normal	143	0	143	1	0	1	24	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.982666-05
faf0d04e-aba2-4a21-928c-5b8e29b98d9e	7777	2025-12-03 17:16:14-05	Normal	1	0	1	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.984489-05
010e77f8-136a-4ec8-8fb7-7a5b967cff1e	7811	2025-12-03 17:16:14-05	Normal	3	0	3	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.986207-05
b54454ac-b59e-454c-b49a-5023a0cc88ec	7894	2025-12-03 17:16:14-05	Normal	0	0	0	88	0	88	54	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.987519-05
0c5f5e95-b402-4284-a3f6-f21d0124e95c	7907	2025-12-03 17:16:14-05	Normal	16	0	16	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.989028-05
3b4f801c-6c85-4203-811f-b47b46d7b565	8005	2025-12-03 17:16:14-05	Normal	127	0	127	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.990298-05
87c9db6f-c411-4a5d-a503-5bc331afe0ac	8008	2025-12-03 17:16:14-05	Normal	88	0	88	2	0	2	5	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.991683-05
184a87fa-5797-4f32-911a-4d6f59b754c6	8010	2025-12-03 17:16:14-05	Normal	289	0	289	25	0	25	16	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.992923-05
d71b5af3-c2d3-48bf-87d0-c2e63910a06b	8011	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.995017-05
0868c689-8933-4710-adad-d8cd8ea2cc43	8014	2025-12-03 17:16:14-05	Normal	70	0	70	2	0	2	1	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.996711-05
102bc8ed-e82e-463e-b343-70cb4e33a1a7	8020	2025-12-03 17:16:14-05	Normal	267	0	267	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:10.998781-05
390489e4-1130-4d69-8eaf-10bcaf4a3088	8023	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.000469-05
073557fa-9f97-4e60-8e17-947b8ceddbd6	8025	2025-12-03 17:16:14-05	Normal	91	0	91	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.001799-05
f3b8c1d9-5caa-4802-95cb-cc38b6e78ac8	8030	2025-12-03 17:16:14-05	Normal	476	0	476	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.003313-05
7ca586dd-1328-49dc-809d-2243ed1ec97b	8033	2025-12-03 17:16:14-05	Normal	99	0	99	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.005061-05
26ecce42-7d4d-48c0-a986-85af6b6b528e	8035	2025-12-03 17:16:14-05	Normal	327	0	327	20	0	20	17	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.006232-05
b04378a5-8e56-42c0-9b41-9a32a0ae64a3	8036	2025-12-03 17:16:14-05	Normal	0	0	0	6	0	6	3	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.007854-05
080cabee-91a2-409e-b73d-3d331857c816	8040	2025-12-03 17:16:14-05	Normal	331	0	331	18	0	18	12	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.010383-05
8a123119-2dc6-4f52-ad7a-5df31e1b8b0c	8044	2025-12-03 17:16:14-05	Normal	30	0	30	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.012465-05
2f370104-58e0-4f1f-9d42-bae835c712d3	8049	2025-12-03 17:16:14-05	Normal	48	0	48	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.014414-05
e1b422dc-30fd-4598-bea1-3a5dedaa6216	8050	2025-12-03 17:16:14-05	Normal	264	0	264	24	0	24	11	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.016374-05
6c19a5f8-1e21-41df-bb8d-20885cb9abf6	8051	2025-12-03 17:16:14-05	Normal	101	0	101	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.017731-05
ef874150-7117-42f4-9b4c-a848b7595947	8058	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.019208-05
247e418d-0bf6-4dbe-86bd-1fc672487091	8060	2025-12-03 17:16:14-05	Normal	206	0	206	8	0	8	4	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.020745-05
5d9636a8-ba14-41c2-848a-1958cec716e3	8064	2025-12-03 17:16:14-05	Normal	126	0	126	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.023569-05
9fd0d4e1-166e-4d47-a4c1-2c4dd72614ca	8070	2025-12-03 17:16:14-05	Normal	167	0	167	4	0	4	2	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.02654-05
f40e2704-79eb-47f8-b86e-e7bed34a94e9	8074	2025-12-03 17:16:14-05	Normal	667	0	667	2	0	2	3	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.029728-05
8f625597-ac50-4fdf-a2a2-1d8cd30cdb6e	8078	2025-12-03 17:16:14-05	Normal	47	0	47	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.032627-05
4963b4f3-f6d8-45a9-a9f8-22478b0e8d77	8081	2025-12-03 17:16:14-05	Normal	605	0	605	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.035585-05
0a796ce1-9ef3-487e-881a-d5d15caeaf07	8085	2025-12-03 17:16:14-05	Normal	104	0	104	36	0	36	8	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.038204-05
7d2ba9be-1016-4ddd-9cc9-423f5ff4b060	8090	2025-12-03 17:16:14-05	Normal	91	0	91	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.041262-05
00ac62fa-60b3-4963-b7ef-0be1904f005e	8098	2025-12-03 17:16:14-05	Normal	131	0	131	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.0446-05
d9a16ee2-13af-438a-881b-5b2ebd4d9c77	8207	2025-12-03 17:16:14-05	Normal	47	0	47	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.048657-05
64393a1b-4856-43c9-8400-068fa3a8b4ef	8346	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.051536-05
7f4289ad-0b1d-41ae-b396-708d713536fe	8888	2025-12-03 17:16:14-05	Normal	89	0	89	6	0	6	6	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.055199-05
c7d5cf57-b5fb-48ad-a87c-8d660f676901	8899	2025-12-03 17:16:14-05	Normal	199	0	199	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.058621-05
68359785-1ce4-4e1f-bdf8-ab7d37e8b564	8919	2025-12-03 17:16:14-05	Normal	125	0	125	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.062146-05
b0da4598-df41-4cf7-8d39-2957eae05365	9000	2025-12-03 17:16:14-05	Normal	370	0	370	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.065855-05
d0d8c3a2-9480-4a71-8861-4e53a5cd9692	9001	2025-12-03 17:16:14-05	Normal	138	0	138	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.069639-05
b9c61c65-df3f-415b-878e-01f906c8135c	9002	2025-12-03 17:16:14-05	Normal	610	0	610	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.073612-05
08b76f65-28b4-41ad-ab14-0ff5966a8414	9003	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.077496-05
7058e62d-c49a-4c50-9ca4-ac7082f68924	9004	2025-12-03 17:16:14-05	Normal	2015	0	2015	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.081888-05
3b7b9d92-e2c3-4612-b05d-27d99be3d5d4	9005	2025-12-03 17:16:14-05	Normal	484	0	484	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.088421-05
e1915bab-2ad9-447f-a9e4-7795a5601761	9009	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.092616-05
e725b690-b897-4dfe-aa71-a8f1c407dcf0	9010	2025-12-03 17:16:14-05	Normal	77	0	77	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.096613-05
e2760af8-0c21-41b4-b9fd-fee99cda0c0c	9608	2025-12-03 17:16:14-05	Normal	467	0	467	13	0	13	249	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.10065-05
7f8479d9-c7e2-4050-9723-2f8927f75c1b	9736	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.105076-05
baf68040-15c7-4ac4-96e6-72b1eb6a7700	9815	2025-12-03 17:16:14-05	Normal	167	0	167	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.10906-05
b6dbcbd5-e18f-486d-a1e5-011b87c3f513	9868	2025-12-03 17:16:14-05	Normal	13	0	13	2	0	2	8	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.113573-05
b90ae6a5-c68a-47e0-b529-6fe70889299a	9905	2025-12-03 17:16:14-05	Normal	294	0	294	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.117741-05
ec845fc5-5db9-4097-8de5-24653490e4df	12345	2025-12-03 17:16:14-05	Normal	4	0	4	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.120991-05
fef0d3ff-d6ed-433d-a52d-baafc4658fcd	15160	2025-12-03 17:16:14-05	Normal	119	0	119	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.123873-05
780a9ee7-20d4-4326-bc87-cbd2fb7d832d	15287	2025-12-03 17:16:14-05	Normal	8	0	8	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.126355-05
37290dab-a9ee-4cd9-9fa3-8aca71da6b8e	15975	2025-12-03 17:16:14-05	Normal	19	0	19	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.128612-05
85e4aeae-98a5-40fa-bab3-134c140ee13a	17425	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.130468-05
d6c8c0a7-3265-44bf-8b63-b3adaa098b46	19932	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.132259-05
d2d53fcb-6147-4cfa-84c1-e9f8c3104ba4	20250	2025-12-03 17:16:14-05	Normal	181	0	181	0	0	0	77	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.133569-05
e16afb39-6a97-4b8c-a6b3-390bcfdfe632	20251	2025-12-03 17:16:14-05	Normal	2	0	2	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.13555-05
fa03f190-7401-4d56-8097-ba4abf37e3ff	21121	2025-12-03 17:16:14-05	Normal	56	0	56	2	0	2	73	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.137074-05
fb4159c5-5e2a-4046-904e-ce2a430e978e	25049	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.138436-05
371fc1e2-e019-49da-a6ff-48555a8437d3	25257	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.140072-05
7ded7abc-996a-4758-812a-84fe860b6645	25366	2025-12-03 17:16:14-05	Normal	310	0	310	0	0	0	136	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.141436-05
0ae9a218-71ee-4d77-8c11-0282904dad2a	30111	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.142651-05
a5eb952a-55d9-44c6-a692-e6a550aef369	44444	2025-12-03 17:16:14-05	Normal	231	0	231	0	0	0	45	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.144476-05
8e1d26bd-9d9e-43cd-a793-9a076c9a0f4e	052919	2025-12-03 17:16:14-05	Normal	786	0	786	1	0	1	14	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.146909-05
2d6c0fdd-7704-496e-84cb-3552a444e016	54321	2025-12-03 17:16:14-05	Normal	89	0	89	24	0	24	101	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.149116-05
58e30bc6-4503-4554-8b81-4040f97597cf	67890	2025-12-03 17:16:14-05	Normal	3	0	3	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.150779-05
b7ecf6f9-af09-4196-97b3-f277418cf322	70665	2025-12-03 17:16:14-05	Normal	599	0	599	6	0	6	57	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.152465-05
0200d434-dfe7-4054-9ab2-9a6295aef5db	77777	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.154078-05
8ceb7178-25a6-4933-a6df-618f6d7fa96f	80262	2025-12-03 17:16:14-05	Normal	23	0	23	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.155607-05
e5c81511-0e34-46fd-8352-a31773b12fe3	85020	2025-12-03 17:16:14-05	Normal	208	0	208	8	0	8	286	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.156988-05
6cdb782a-fc7b-48d0-baba-4b988ea2172e	88888	2025-12-03 17:16:14-05	Normal	7	0	7	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.158415-05
c6e94e1f-4ba5-4b0c-9aee-bb417f098a0d	092312	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.160245-05
ccbfa8f0-768c-4113-808a-7f3afb1385ba	92312	2025-12-03 17:16:14-05	Normal	340	0	340	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.162739-05
3fd0cd0c-8474-439c-8ef1-68014c02225f	97052	2025-12-03 17:16:14-05	Normal	23	0	23	2	0	2	3	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.164983-05
2fa5c78f-4322-4f9b-a0d7-23285eef02aa	100425	2025-12-03 17:16:14-05	Normal	82	0	82	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.166669-05
086d0b4d-e2e7-4d43-8a93-0b9f670c799c	100591	2025-12-03 17:16:14-05	Normal	365	0	365	5	0	5	20	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.168121-05
5417c55a-e94e-4b55-9203-8428d45c0454	123456	2025-12-03 17:16:14-05	Normal	63	0	63	22	0	22	11	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.16978-05
fff1f575-3a4f-48a8-8700-8e549403efc9	131313	2025-12-03 17:16:14-05	Normal	192	0	192	0	0	0	20	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.171976-05
eeccb5c5-6a68-4a0d-b77e-426c69c50473	142533	2025-12-03 17:16:14-05	Normal	0	0	0	2	0	2	19	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.174815-05
3cb7f5ee-301b-48fd-98bc-b11758641b7c	150828	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.183621-05
62d3d5b8-a0a7-484c-bb1a-307b3c779d3a	170195	2025-12-03 17:16:14-05	Normal	147	0	147	2	0	2	9	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.186696-05
30575944-29cc-4ef4-abe2-ba79c86df531	181818	2025-12-03 17:16:14-05	Normal	19	0	19	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.189539-05
0c9b6344-bced-47ef-9635-ddf4cc88920c	191919	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.199748-05
a250d47f-2639-45a2-8975-5c6082093c74	202130	2025-12-03 17:16:14-05	Normal	30	0	30	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.202823-05
865ead39-bdad-4947-8540-2096d190e235	202526	2025-12-03 17:16:14-05	Normal	509	0	509	2	0	2	416	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.205637-05
a06e608f-5983-442e-90eb-91d2e350d7dc	232025	2025-12-03 17:16:14-05	Normal	49	0	49	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.208769-05
11bb0f37-27e1-499c-b79d-400814aa8794	240114	2025-12-03 17:16:14-05	Normal	97	0	97	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.212546-05
c06e0d9f-5816-4697-bfe4-0b4b10c7e398	320121	2025-12-03 17:16:14-05	Normal	0	0	0	7	0	7	55	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.215347-05
dbf04a7d-c832-410a-8fa7-ddea94ca264b	333333	2025-12-03 17:16:14-05	Normal	80	0	80	23	0	23	34	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.218668-05
e9c4df2b-5d2f-4816-ac1b-a53ca3814627	425529	2025-12-03 17:16:14-05	Normal	281	0	281	4	0	4	215	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.221443-05
40d4dbc4-c80d-4ab2-8855-43dbd04beb9b	458501	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	5	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.224079-05
ef15705d-a7d8-4763-a106-60982923a48e	555555	2025-12-03 17:16:14-05	Normal	116	0	116	0	0	0	1	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.227467-05
27214133-b4c0-49b3-bfe7-7101240290fc	654321	2025-12-03 17:16:14-05	Normal	342	0	342	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.230851-05
ce81c3b7-69cb-44dc-9488-59bb2d8d7393	666666	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.234637-05
2200b00c-978f-4ca6-95f4-04bdb6796b53	741836	2025-12-03 17:16:14-05	Normal	182	0	182	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.237447-05
66842b82-0943-403b-8987-cbc84873ca94	808080	2025-12-03 17:16:14-05	Normal	6	0	6	143	0	143	110	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.240069-05
3fd94ca3-2155-4c08-9f91-791fa4fcb09c	820408	2025-12-03 17:16:14-05	Normal	169	0	169	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.24263-05
ebf04f1f-16c2-498c-8baa-9ba7dce86782	999999	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.245665-05
1637e204-9f47-406b-8995-7db5bfdd5623	1234567	2025-12-03 17:16:14-05	Normal	249	0	249	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.248346-05
88a36da9-4bb8-4285-9276-2ea30fff54f3	2025432	2025-12-03 17:16:14-05	Normal	329	0	329	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.25129-05
43013a58-bc64-40f3-ad65-e42206253939	2025805	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.253984-05
c274bcae-021c-468e-8cff-cbfc8cd264a8	2025807	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.256585-05
b3ef4b2e-2bfe-4006-a96f-97ad71b8ef6d	2025809	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.259338-05
8313ceee-6333-42be-a0ec-6fe70db317e3	02132856	2025-12-03 17:16:14-05	Normal	336	0	336	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.261622-05
4caa8d81-decf-4609-b3e5-1b9a751d4d4b	9101112	2025-12-03 17:16:14-05	Normal	50	0	50	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.264729-05
b13afef4-91b9-4443-9e3c-5eb362883a2a	16684502	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.266907-05
ac7862eb-f86a-437e-a4c6-8f24e1a2dba6	76314865	2025-12-03 17:16:14-05	Normal	310	0	310	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.268335-05
4b2b6230-da11-4984-b874-48ed6a3558d2	Other	2025-12-03 17:16:14-05	Normal	444	0	444	0	0	0	0	0	179eb050-b338-469c-876c-fc5f1280ad72	2025-12-27 15:42:11.271959-05
29cce137-9872-489e-818b-82df817b6e04	0000	2025-12-03 17:16:14-05	Normal	198	0	198	252	0	252	167	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.328433-05
21cac8cc-3519-4144-8ca3-cec10aa726c2	0104	2025-12-03 17:16:14-05	Normal	30	0	30	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.33514-05
2f9fe67f-9730-4707-a23c-1d3142c0fe75	0116	2025-12-03 17:16:14-05	Normal	18	0	18	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.337592-05
23fc1ead-4af5-4955-9d4d-bbaba286b056	0207	2025-12-03 17:16:14-05	Normal	612	0	612	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.33962-05
be288440-1f9b-424e-b8eb-a09ae00fe572	0218	2025-12-03 17:16:14-05	Normal	122	0	122	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.341789-05
a37db6b8-92da-45b5-b16c-62b699bf141c	0306	2025-12-03 17:16:14-05	Normal	62	0	62	1	0	1	1	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.344866-05
84cd2995-7ffe-48a0-8952-db2a3113ef10	0325	2025-12-03 17:16:14-05	Normal	273	0	273	18	0	18	103	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.347816-05
e53e5ab7-4cc6-46db-a08a-49ded90bc6b8	0408	2025-12-03 17:16:14-05	Normal	9	0	9	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.35049-05
88dcac8b-735c-49d0-a517-6026fff6c473	0409	2025-12-03 17:16:14-05	Normal	35	0	35	9	0	9	43	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.352713-05
ffe627aa-23c0-4aa8-900c-c7cc1bb45b1a	0424	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.355077-05
f406ba63-1dc0-42b2-a30e-90d1376fde20	0477	2025-12-03 17:16:14-05	Normal	73	0	73	9	0	9	6	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.35746-05
ba723ab8-3ee4-4395-acdc-d961b234719e	0505	2025-12-03 17:16:14-05	Normal	21	0	21	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.359895-05
eadfbfdc-a18b-4d77-972a-2f8024e900df	0525	2025-12-03 17:16:14-05	Normal	5	0	5	6	0	6	6	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.361979-05
2ce3948d-5bae-46ff-a30c-de55f429295c	0624	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.364064-05
300fe686-9e12-4e6b-a2c0-b83d82108aa9	0712	2025-12-03 17:16:14-05	Normal	113	0	113	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.36639-05
f28e5116-e421-4dba-9587-9edb5c7d2d67	0729	2025-12-03 17:16:14-05	Normal	50	0	50	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.368669-05
c989e2fd-87b8-4b84-9cff-163107e7add5	0803	2025-12-03 17:16:14-05	Normal	230	0	230	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.37115-05
f2045eb2-81aa-4879-a5f8-1cee3c997d35	0819	2025-12-03 17:16:14-05	Normal	56	0	56	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.373545-05
b8d10461-14ef-47de-88a1-aeafce550add	0821	2025-12-03 17:16:14-05	Normal	28	0	28	2	0	2	2	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.375711-05
895d419f-9d43-406d-82a8-16bdee130063	0825	2025-12-03 17:16:14-05	Normal	8	0	8	2	0	2	3	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.377763-05
7154165d-1ca7-4de8-aa53-9b6b339fdd43	0826	2025-12-03 17:16:14-05	Normal	19	0	19	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.3801-05
64978c39-d106-4547-bedd-fd0d669b7f7d	0934	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.382154-05
9434cec2-b5f6-47b9-adea-d62aebc3f08d	1004	2025-12-03 17:16:14-05	Normal	284	0	284	23	0	23	125	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.383874-05
3ef185c2-2f72-4a92-84b3-555ace01b85a	1010	2025-12-03 17:16:14-05	Normal	32	0	32	20	0	20	20	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.385937-05
cb77d750-91e2-41ff-8c19-c370637e3647	1102	2025-12-03 17:16:14-05	Normal	48	0	48	1	0	1	1	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.387393-05
bdb8f2c8-a394-464a-adee-c351be7b3bd7	1111	2025-12-03 17:16:14-05	Normal	61	0	61	4	0	4	2	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.389209-05
2fb969cd-6703-49f0-b40c-5d2bbd4e8cd2	1119	2025-12-03 17:16:14-05	Normal	123	0	123	0	0	0	5	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.391031-05
32f28fdf-8420-4f84-be1f-7f4307613ebc	1121	2025-12-03 17:16:14-05	Normal	123	0	123	3	0	3	93	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.39285-05
a7b9876f-25ee-46d7-863e-eada21936fdc	1122	2025-12-03 17:16:14-05	Normal	219	0	219	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.395066-05
1aabb478-ab13-44f8-b3c8-8e365bf569ac	1210	2025-12-03 17:16:14-05	Normal	64	0	64	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.397827-05
1959d38c-9739-4e50-b059-65ef81efc63e	1212	2025-12-03 17:16:14-05	Normal	103	0	103	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.401711-05
a3ffca10-913c-4c9e-a5d2-051c857e8c15	1234	2025-12-03 17:16:14-05	Normal	88	0	88	0	0	0	17	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.40445-05
aeb28ebd-9d78-4781-9667-080aef7817ce	1268	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.406902-05
b3c7ea44-b4cf-48bf-8648-04af540d75f0	1278	2025-12-03 17:16:14-05	Normal	690	0	690	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.408512-05
77d0a9df-8380-4fac-9a62-5f1e957cb138	1303	2025-12-03 17:16:14-05	Normal	226	0	226	0	0	0	27	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.411152-05
2e4992bf-f250-476a-bdf0-2465f426342b	1305	2025-12-03 17:16:14-05	Normal	2070	0	2070	6	0	6	5	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.412542-05
c8a52720-4e22-4d51-a176-43470f048051	1306	2025-12-03 17:16:14-05	Normal	36	0	36	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.413725-05
4a2cc8af-6b3e-45c3-b8a8-18c8c328cf63	1313	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.415987-05
07f2acd5-262e-45c6-8218-5ecd7d59f2f8	1423	2025-12-03 17:16:14-05	Normal	90	0	90	0	0	0	70	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.418291-05
575e9040-0709-4ccd-8b40-00bc997c1614	1472	2025-12-03 17:16:14-05	Normal	20	0	20	0	0	0	1	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.420205-05
beeaf158-80ec-4977-8fb9-d3e296f97cf5	1491	2025-12-03 17:16:14-05	Normal	150	0	150	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.422133-05
e1fd7190-446f-404f-a37b-d8642541a12b	1504	2025-12-03 17:16:14-05	Normal	61	0	61	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.423736-05
d6e9997b-89c2-4f85-8ca0-ae4ed2714820	1510	2025-12-03 17:16:14-05	Normal	8778	0	8778	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.42491-05
beddbd05-bd4f-468f-8ec3-86a249e8b4c0	1606	2025-12-03 17:16:14-05	Normal	99	0	99	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.426448-05
25d8588b-63bf-4b92-8610-29677a320a08	1611	2025-12-03 17:16:14-05	Normal	29	0	29	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.428563-05
14a21278-1d03-4038-8874-eba7f0e75211	1612	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.430654-05
b5c57466-440c-4ccb-9540-f4eff252fef7	1614	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.43345-05
620b9f39-09d6-41f6-95b4-37e1bc922bbe	1706	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.435161-05
788c7a89-8796-492f-b896-3db8996093fa	1707	2025-12-03 17:16:14-05	Normal	108	0	108	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.436982-05
cd60d84f-9f64-4636-bcbf-55af336d469f	1709	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.438723-05
d3723632-03d9-4575-aeda-6c68873eace6	1758	2025-12-03 17:16:14-05	Normal	744	0	744	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.440766-05
ad5d4278-ed4d-4687-949c-ef3484dc6c19	1767	2025-12-03 17:16:14-05	Normal	142	0	142	10	0	10	10	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.44226-05
6fcd55c5-1066-42ee-8565-0ab2711e44f3	1803	2025-12-03 17:16:14-05	Normal	111	0	111	0	0	0	24	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.44397-05
8695b75a-91ff-4665-ac1f-737f24943a63	1903	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.44588-05
f9b411dc-edd7-4365-925d-7ed8d70cbdb5	1917	2025-12-03 17:16:14-05	Normal	10	0	10	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.447866-05
76dee2dc-5e23-48ac-9837-9731c87639a6	1935	2025-12-03 17:16:14-05	Normal	71	0	71	50	0	50	16	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.449775-05
960d4c5c-62fb-4aa5-ae0a-7e8d2b36a3e4	1937	2025-12-03 17:16:14-05	Normal	15	0	15	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.451776-05
299478c8-aad8-4153-a839-7ed15fcf2651	1952	2025-12-03 17:16:14-05	Normal	330	0	330	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.453741-05
8a747201-5f75-4f98-babe-451adcbb66ac	1967	2025-12-03 17:16:14-05	Normal	56	0	56	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.455425-05
621f4c15-6e72-4295-8509-2be5295f562d	1970	2025-12-03 17:16:14-05	Normal	1124	0	1124	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.457255-05
a99f8109-ed11-4c00-824d-2c0460885bdb	1973	2025-12-03 17:16:14-05	Normal	113	0	113	44	0	44	22	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.458858-05
080dca08-cbb0-4ef3-b9c6-32ae5cebf5c7	1975	2025-12-03 17:16:14-05	Normal	24	0	24	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.460207-05
571648ae-d575-46c5-a4c6-b5b40d7f64f9	1978	2025-12-03 17:16:14-05	Normal	130	0	130	2	0	2	1	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.461578-05
570849e6-6d7b-478a-9ceb-1e0103c9360d	1985	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	71	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.463213-05
e1894872-a58f-4524-ab23-5697748a3fed	1987	2025-12-03 17:16:14-05	Normal	99	0	99	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.46469-05
6f9a14bd-363c-4468-acb1-bdb03044f121	1992	2025-12-03 17:16:14-05	Normal	371	0	371	0	0	0	9	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.466135-05
488c6b1b-6122-4fe4-a1bc-637c4fc63e36	1994	2025-12-03 17:16:14-05	Normal	18	0	18	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.467576-05
24fe0b2c-fc2a-4e21-b7e9-1efe30c7813d	1995	2025-12-03 17:16:14-05	Normal	56	0	56	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.46887-05
0df61884-3080-41bf-8d33-82ed0c608b0b	1998	2025-12-03 17:16:14-05	Normal	259	0	259	12	0	12	57	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.470225-05
cf2cef44-16d5-4565-a2d7-2220a196f1c3	2000	2025-12-03 17:16:14-05	Normal	125	0	125	3	0	3	3	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.471406-05
afa971c9-c68f-40f4-86eb-810edd519764	2001	2025-12-03 17:16:14-05	Normal	17	0	17	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.472519-05
6e33617e-488d-44f8-9c2b-9f2c81ded349	2002	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.473368-05
dde955c9-6795-402d-a545-a18150c3190e	2009	2025-12-03 17:16:14-05	Normal	129	0	129	8	0	8	36	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.474515-05
422e8a7c-da8e-4327-8a3c-55055af863b3	2015	2025-12-03 17:16:14-05	Normal	191	0	191	30	0	30	31	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.476002-05
2c6f4dbc-f1cc-4637-aa86-53b728b6cd8d	2016	2025-12-03 17:16:14-05	Normal	544	0	544	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.477484-05
dc3a00c6-ba24-453d-8b4d-01634c4feb2e	2020	2025-12-03 17:16:14-05	Normal	108	0	108	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.478925-05
91d45fc2-007e-44f5-a695-1b6caa6b6498	2022	2025-12-03 17:16:14-05	Normal	117	0	117	3	0	3	9	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.480368-05
99daa262-2483-423a-a541-796c7c0b87de	2023	2025-12-03 17:16:14-05	Normal	533	0	533	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.48194-05
943fe065-7abe-4c25-bc13-d7bcd7157853	2024	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.483417-05
8331185e-c749-484f-b731-efdfafacfb88	2025	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.484399-05
6c24daa8-d564-492a-b43a-4cde30a0e71e	2026	2025-12-03 17:16:14-05	Normal	339	0	339	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.485211-05
36bbad8d-dec9-42e8-836c-b50cf6b45dc8	2027	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.486023-05
006c810c-f430-4e84-8013-9270813a058f	2028	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.486821-05
b841af3e-b816-45bb-9b61-ed3c6ae425c6	2084	2025-12-03 17:16:14-05	Normal	103	0	103	15	0	15	7	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.487651-05
d85802c3-bf92-422d-a298-d87124c076c7	2170	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.488922-05
a5ed829f-a228-4741-8d50-4827a0ebed4f	2201	2025-12-03 17:16:14-05	Normal	194	0	194	28	0	28	73	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.490331-05
7bf87144-e59d-44c5-94c6-548512d98e11	2203	2025-12-03 17:16:14-05	Normal	899	0	899	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.491227-05
ddb664ff-8b9c-453e-b1b0-13838bdb75c6	2205	2025-12-03 17:16:14-05	Normal	76	0	76	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.492042-05
01195562-650a-4b43-b4e7-cdf1d3b16f63	2211	2025-12-03 17:16:14-05	Normal	261	0	261	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.493309-05
ab927036-c4aa-4fa3-82d4-a730c0fb2161	2213	2025-12-03 17:16:14-05	Normal	355	0	355	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.49479-05
0e25a1e4-77fd-41f0-8ec7-7f2cf8d4c7a4	2223	2025-12-03 17:16:14-05	Normal	24	0	24	0	0	0	14	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.496512-05
24324af1-f887-4bd4-b07d-771c838a3bbd	2301	2025-12-03 17:16:14-05	Normal	133	0	133	70	0	70	77	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.497762-05
60e1128e-4ffa-42e4-9ce7-d46649291be7	2307	2025-12-03 17:16:14-05	Normal	23	0	23	4	0	4	35	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.499157-05
4b48695b-904e-48ee-91e0-218735ecc9cb	2356	2025-12-03 17:16:14-05	Normal	46	0	46	0	0	0	47	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.500206-05
974fb37b-727e-4ea5-b2b0-fed57ee70304	2418	2025-12-03 17:16:14-05	Normal	310	0	310	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.501224-05
bd406d99-e926-4ce4-b65e-1f8c97e8a4b8	2424	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.502078-05
f1722ce5-f4d6-46fd-ac00-1ae7bb75b37f	2429	2025-12-03 17:16:14-05	Normal	145	0	145	2	0	2	3	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.502902-05
c5e356c3-55bf-4b3b-bb29-5f72782d82dc	2502	2025-12-03 17:16:14-05	Normal	221	0	221	270	0	270	93	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.503659-05
50dec380-3527-4f62-9024-f55808b8b66e	2503	2025-12-03 17:16:14-05	Normal	81	0	81	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.504444-05
43751760-93c2-4bb8-a9ec-03d791766d22	2527	2025-12-03 17:16:14-05	Normal	147	0	147	13	0	13	10	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.505331-05
b79a2eb0-dad6-440c-bf2f-58d61c2e1900	2620	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.506096-05
9b82eb8b-4e06-469f-870c-421fda556084	2705	2025-12-03 17:16:14-05	Normal	1	0	1	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.506848-05
46fdefe2-1871-4200-bd15-5275c33f05c9	2708	2025-12-03 17:16:14-05	Normal	15	0	15	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.507564-05
7d267c3e-efd9-4406-beff-62ad4f1b9226	2716	2025-12-03 17:16:14-05	Normal	291	0	291	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.508439-05
96acf085-eaeb-4d88-8f24-1ddf62fccbae	2755	2025-12-03 17:16:14-05	Normal	1	0	1	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.509197-05
d1ef34e3-ea63-482d-a1f9-7065fed328c7	2784	2025-12-03 17:16:14-05	Normal	64	0	64	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.509943-05
97db2995-e1e8-446a-b959-30f5709ff4dd	2904	2025-12-03 17:16:14-05	Normal	34	0	34	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.510698-05
f2e4bc75-da28-495b-a92c-0439d9182b9d	2905	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.511445-05
c793b427-4140-4302-b2d8-766fede26514	2953	2025-12-03 17:16:14-05	Normal	0	0	0	22	0	22	11	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.512177-05
2e7bbd9c-290a-4a83-bdb4-f7ad46243285	3004	2025-12-03 17:16:14-05	Normal	134	0	134	31	0	31	20	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.512893-05
f2464e3a-26dc-45c9-a7e8-3455d2dae261	3005	2025-12-03 17:16:14-05	Normal	304	0	304	43	0	43	27	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.513652-05
aced4129-acea-43c0-9565-7562c02bb36e	3019	2025-12-03 17:16:14-05	Normal	0	0	0	3	0	3	2	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.514686-05
0495fbf3-07b5-44f0-81b7-317d6828e208	3107	2025-12-03 17:16:14-05	Normal	18	0	18	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.516411-05
4848d6e2-6370-416a-89a6-7398c35829b3	3146	2025-12-03 17:16:14-05	Normal	132	0	132	13	0	13	7	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.517753-05
e579e89d-bd0a-4f45-8c42-24afb0e44c7d	3333	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.518899-05
d4ce8c55-5f66-45c8-92a7-76925c3376cd	3566	2025-12-03 17:16:14-05	Normal	273	0	273	7	0	7	117	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.520244-05
e4a4457e-9eaa-40d7-8430-5758d52774e9	3824	2025-12-03 17:16:14-05	Normal	34	0	34	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.52166-05
afcbdf0c-aa91-4b75-9315-8f20f73f55e6	4012	2025-12-03 17:16:14-05	Normal	248	0	248	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.523072-05
0aa7454e-fd4c-4c20-90c1-d6e98332067d	4013	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.524378-05
65ba1783-1b39-489c-970d-86d795190527	4061	2025-12-03 17:16:14-05	Normal	487	0	487	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.525747-05
e6ae7bd8-61a8-42a2-82bf-082f83b0e2d8	4086	2025-12-03 17:16:14-05	Normal	128	0	128	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.527084-05
fc5d4a11-db85-43b0-a774-9f3c58397a7d	4163	2025-12-03 17:16:14-05	Normal	125	0	125	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.52846-05
5e860c6a-5878-4b81-bca3-76b0d9e54050	4210	2025-12-03 17:16:14-05	Normal	46	0	46	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.53116-05
3c1dbd63-7721-447e-9930-2e6004bd1f71	4312	2025-12-03 17:16:14-05	Normal	11	0	11	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.533379-05
344e478d-76d0-43fa-a0f8-8a70f33b8e68	4321	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.534588-05
55082395-db1a-4b0f-af5c-b587323bfff1	4423	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.535512-05
a767e116-5f24-42b4-8b75-b4bfae423faf	4523	2025-12-03 17:16:14-05	Normal	84	0	84	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.536621-05
6e22144f-9819-434e-9556-89aa4eb0c674	4775	2025-12-03 17:16:14-05	Normal	41	0	41	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.537812-05
1bd88885-183c-4693-ae81-c89f1da80a73	4858	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.538941-05
739c99f3-b03a-46e6-8433-0ab737510d1c	5020	2025-12-03 17:16:14-05	Normal	194	0	194	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.54004-05
4815e662-d3c2-4631-8946-89e9b6afc8f0	5467	2025-12-03 17:16:14-05	Normal	267	0	267	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.541161-05
80e7c28d-da07-48c5-b4b8-c75eb9668bf9	5648	2025-12-03 17:16:14-05	Normal	134	0	134	0	0	0	10	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.542072-05
ee6b2ce2-aa61-4700-b657-5f2c634bf7cd	6001	2025-12-03 17:16:14-05	Normal	128	0	128	2	0	2	2	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.543129-05
209fa61e-d882-40d8-b324-18cb51feca69	6025	2025-12-03 17:16:14-05	Normal	141	0	141	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.544583-05
c7d17d43-2d04-4a0c-9914-02a42e35d36c	6028	2025-12-03 17:16:14-05	Normal	64	0	64	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.545747-05
cc53f0bb-b9de-44ed-b253-545a36205f6b	6034	2025-12-03 17:16:14-05	Normal	259	0	259	0	0	0	1	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.546791-05
44ec8b01-2e4d-420f-93b8-b6fe3bc9f225	6037	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.547796-05
9da89b93-2088-4a94-860e-a0957e25f67a	6048	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.549474-05
298071c9-b453-4ba0-9be3-d674d28dd0e6	6076	2025-12-03 17:16:14-05	Normal	261	0	261	1	0	1	1	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.55185-05
72bd0347-c726-438e-9252-1ae4d768daa8	6088	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.55308-05
e315d4b7-856e-41ed-8f61-0c22e65dd4fa	6092	2025-12-03 17:16:14-05	Normal	32	0	32	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.554089-05
72a44549-7127-4e33-836d-9ce0f110a4cc	6097	2025-12-03 17:16:14-05	Normal	6	0	6	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.555143-05
945be9d9-46f5-4a0e-ae7c-4fe42185e6d1	6281	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.556117-05
1fdfe6b4-9c6a-4148-9ea3-fa8e84c4a77f	6336	2025-12-03 17:16:14-05	Normal	105	0	105	1	0	1	1	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.557084-05
facf6638-b949-4961-b0ed-e3dfad93c45d	6568	2025-12-03 17:16:14-05	Normal	261	0	261	8	0	8	97	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.558111-05
9828abca-2944-4172-a106-9a77b9225e35	6754	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.559129-05
db4168c8-1f70-42b9-a8bd-46dadc7d20c4	6784	2025-12-03 17:16:14-05	Normal	12	0	12	269	0	269	53	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.56016-05
715227c3-b9a4-472e-aed4-8104fc2a96c4	6871	2025-12-03 17:16:14-05	Normal	126	0	126	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.561146-05
4cfa185e-b7af-4b51-8db9-57a38c23cb83	7005	2025-12-03 17:16:14-05	Normal	1	0	1	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.562094-05
7aadf9c1-0728-4cad-bb20-9642f69b8b15	7007	2025-12-03 17:16:14-05	Normal	111	0	111	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.563023-05
ac583eff-952d-45df-8384-c72d01c01f18	7012	2025-12-03 17:16:14-05	Normal	174	0	174	13	0	13	33	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.564218-05
0de73022-508d-4975-a7b4-9f6a2e9d67d2	7021	2025-12-03 17:16:14-05	Normal	98	0	98	6	0	6	8	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.565968-05
fd443650-1f5d-4694-a958-c6fc2744b701	7026	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.567206-05
db0e79d5-3849-426f-824f-1c5d0fffb9d6	7032	2025-12-03 17:16:14-05	Normal	136	0	136	1	0	1	5	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.568303-05
b5e4648e-94e1-4138-957d-6f3545ad66fd	7033	2025-12-03 17:16:14-05	Normal	8	0	8	0	0	0	18	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.569346-05
630d251f-6212-45f4-bff1-09aa98ca870c	7034	2025-12-03 17:16:14-05	Normal	58	0	58	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.57042-05
9665c9fd-02ae-4b49-a580-9e6e6ea0e7a5	7035	2025-12-03 17:16:14-05	Normal	0	0	0	12	0	12	12	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.57145-05
129a0761-015a-49ac-9aec-e357849ebffc	7036	2025-12-03 17:16:14-05	Normal	24	0	24	0	0	0	26	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.572547-05
9dbc23fa-8c37-467f-9d0d-f5787390bd5e	7045	2025-12-03 17:16:14-05	Normal	157	0	157	1	0	1	6	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.573568-05
1baf866a-92af-4e42-ae8c-34e7f4fc3334	7066	2025-12-03 17:16:14-05	Normal	4	0	4	0	0	0	17	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.57458-05
852ae603-047e-41d4-88ee-6e022a71b7c7	7067	2025-12-03 17:16:14-05	Normal	406	0	406	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.575597-05
131ff407-58c1-44b7-92aa-1b4b416dccf2	7082	2025-12-03 17:16:14-05	Normal	192	0	192	2	0	2	28	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.576617-05
b6e41752-2941-44ca-bcb2-db4acde42596	7087	2025-12-03 17:16:14-05	Normal	56	0	56	0	0	0	8	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.577925-05
a930f221-01d3-4272-b307-12f146d33706	7091	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.579017-05
26388316-5b85-46bc-96e9-f63728c4eadb	7094	2025-12-03 17:16:14-05	Normal	356	0	356	0	0	0	15	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.580181-05
37ec8480-4749-46cd-bbee-cb18ff85af99	7097	2025-12-03 17:16:14-05	Normal	29	0	29	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.582178-05
ddd327cc-dc45-4440-a704-13e310b40f11	7121	2025-12-03 17:16:14-05	Normal	174	0	174	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.583936-05
4592d925-05c0-40ad-896b-c7c239be9466	7214	2025-12-03 17:16:14-05	Normal	215	0	215	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.585282-05
a0c90a4f-e9c0-464b-ab4d-2fd49a729b3a	7216	2025-12-03 17:16:14-05	Normal	78	0	78	0	0	0	52	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.586515-05
5872fda2-48ed-46f9-80a3-2de2e39d601f	7496	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.587535-05
18b47246-e26b-4add-86d6-b1833f518e11	7532	2025-12-03 17:16:14-05	Normal	68	0	68	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.588393-05
cd6b833a-928b-4cca-a5e4-924629882e33	7605	2025-12-03 17:16:14-05	Normal	143	0	143	1	0	1	24	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.589173-05
c2d65429-2790-4a1d-9636-cd1edd1bdbba	7777	2025-12-03 17:16:14-05	Normal	1	0	1	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.59005-05
2481467c-8c56-430e-9680-8ab99676a26d	7811	2025-12-03 17:16:14-05	Normal	3	0	3	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.591059-05
1ddf4bbf-0c25-4c5f-8729-68ed900d01ce	7894	2025-12-03 17:16:14-05	Normal	0	0	0	88	0	88	54	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.592278-05
a7347195-094d-4a3c-8589-6012055bbfd6	7907	2025-12-03 17:16:14-05	Normal	16	0	16	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.593232-05
d339e369-a621-4106-8a0b-25db63eee8d6	8005	2025-12-03 17:16:14-05	Normal	127	0	127	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.59409-05
3f62bfb3-1452-4af2-adba-66a001bf0f76	8008	2025-12-03 17:16:14-05	Normal	88	0	88	2	0	2	5	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.594851-05
69c5fef7-1f71-4b5e-86b3-75e05d5a16f7	8010	2025-12-03 17:16:14-05	Normal	289	0	289	25	0	25	16	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.595715-05
d248a961-cead-4271-ad10-d95b1d58f901	8011	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.596465-05
8278a731-9e1e-4dcc-8cf1-884c70992a28	8014	2025-12-03 17:16:14-05	Normal	70	0	70	2	0	2	1	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.597176-05
cb5a24c8-761a-4360-9771-32c94883b7a6	8020	2025-12-03 17:16:14-05	Normal	267	0	267	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.598324-05
9aaa902a-ca1d-40c6-90d2-343da274f68e	8023	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.599712-05
a3590e4a-0507-4273-9869-ec05e90a868a	8025	2025-12-03 17:16:14-05	Normal	91	0	91	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.600575-05
3aed03bf-b477-4ffa-8936-effac583cb62	8030	2025-12-03 17:16:14-05	Normal	476	0	476	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.601627-05
a0e2cc2c-6d38-478c-9665-ef36127380fd	8033	2025-12-03 17:16:14-05	Normal	99	0	99	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.602638-05
c622037e-1fab-425e-8279-b4ba0c464aee	8035	2025-12-03 17:16:14-05	Normal	327	0	327	20	0	20	17	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.603477-05
f8479685-9756-4888-bd29-f4faa92b1a8b	8036	2025-12-03 17:16:14-05	Normal	0	0	0	6	0	6	3	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.60425-05
645d0372-924c-4d20-a925-936d7ab8cbab	8040	2025-12-03 17:16:14-05	Normal	331	0	331	18	0	18	12	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.605063-05
1e264c21-4228-4300-a729-65498bbb0968	8044	2025-12-03 17:16:14-05	Normal	30	0	30	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.605844-05
3cb850a3-eec9-49eb-99d8-99a475883886	8049	2025-12-03 17:16:14-05	Normal	48	0	48	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.606602-05
1a148c91-96b1-4533-8eb8-334b58c7ca6e	8050	2025-12-03 17:16:14-05	Normal	264	0	264	24	0	24	11	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.607316-05
39fed279-c9e5-4df3-95d3-95442f08f055	8051	2025-12-03 17:16:14-05	Normal	101	0	101	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.60805-05
8ec1d553-9eed-4797-8490-90447ec8574e	8058	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.608778-05
f0c1b090-cce1-4fb0-921f-01e1675558e2	8060	2025-12-03 17:16:14-05	Normal	206	0	206	8	0	8	4	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.60946-05
92d17772-b8a2-4625-8d8f-128c622bd84a	8064	2025-12-03 17:16:14-05	Normal	126	0	126	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.610162-05
115db7e6-e475-42a0-9949-e5b1f8222772	8070	2025-12-03 17:16:14-05	Normal	167	0	167	4	0	4	2	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.611016-05
6914b54c-a800-4fc8-aa8a-ed69882bad0f	8074	2025-12-03 17:16:14-05	Normal	667	0	667	2	0	2	3	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.611911-05
0bb9b002-0247-4331-ad52-a508ce94a77b	8078	2025-12-03 17:16:14-05	Normal	47	0	47	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.612639-05
46196964-c600-4dfb-8faf-cba13a398df3	8081	2025-12-03 17:16:14-05	Normal	605	0	605	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.613367-05
eccd1efe-870f-4117-afa8-41ae123ca207	8085	2025-12-03 17:16:14-05	Normal	104	0	104	36	0	36	8	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.614566-05
bcd9be93-c667-4fa9-91ec-573090c41e0f	8090	2025-12-03 17:16:14-05	Normal	91	0	91	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.616008-05
90e2a6c1-fde9-4439-9292-9cbeeb9dc62c	8098	2025-12-03 17:16:14-05	Normal	131	0	131	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.617001-05
196e7c55-ce5f-41e9-a9c2-e7e6ea83b7b7	8207	2025-12-03 17:16:14-05	Normal	47	0	47	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.618027-05
0c89b5cf-c62f-43bd-9824-12a24cc9a148	8346	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.619163-05
ae7d7bcf-f09d-4522-8a0f-35666999e89c	8888	2025-12-03 17:16:14-05	Normal	89	0	89	6	0	6	6	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.620043-05
f143504e-394e-4eb7-afb6-1f8aab7d8ec5	8899	2025-12-03 17:16:14-05	Normal	199	0	199	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.620862-05
c6bd9c20-96b8-4107-a920-4e56cc4c9aea	8919	2025-12-03 17:16:14-05	Normal	125	0	125	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.621806-05
cc13a13b-031d-408b-969d-e3b823199624	9000	2025-12-03 17:16:14-05	Normal	370	0	370	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.623086-05
fb64e0e6-bbb7-44e7-aa6c-548d3a430329	9001	2025-12-03 17:16:14-05	Normal	138	0	138	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.624506-05
07d8cce7-de99-4745-a2c0-6bdddde67ee8	9002	2025-12-03 17:16:14-05	Normal	610	0	610	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.625556-05
af489961-aaa4-456e-902b-60b349ecb3a8	9003	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.626595-05
fc313cea-a8a0-449f-8f08-117c4a7458ca	9004	2025-12-03 17:16:14-05	Normal	2015	0	2015	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.627916-05
a87a5cba-4f37-4fe8-b725-491651ef2a71	9005	2025-12-03 17:16:14-05	Normal	484	0	484	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.62917-05
9fd0ed06-3ccb-4bfe-9a7e-d1b44753ac8c	9009	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.630248-05
fd1bfe5f-faf7-42bf-90b1-34bd93d58745	9010	2025-12-03 17:16:14-05	Normal	77	0	77	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.631358-05
259d0c43-cd5c-4918-bf0a-131123a7f8a0	9608	2025-12-03 17:16:14-05	Normal	467	0	467	13	0	13	249	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.633354-05
f1a16f8d-5a33-4390-8392-e34cb3337776	9736	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.634636-05
7e34f014-758f-4782-a23b-f1b028dc2a86	9815	2025-12-03 17:16:14-05	Normal	167	0	167	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.636081-05
f2d330d9-d7be-43c0-b415-2be7479d3e2b	9868	2025-12-03 17:16:14-05	Normal	13	0	13	2	0	2	8	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.637317-05
16948518-f480-47f2-8254-eebcd219b93d	9905	2025-12-03 17:16:14-05	Normal	294	0	294	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.638412-05
0b42daa6-912e-4e87-a080-35b62c80d3df	12345	2025-12-03 17:16:14-05	Normal	4	0	4	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.639299-05
ff8655ed-1ba0-4c80-96f9-95bc5e582f40	15160	2025-12-03 17:16:14-05	Normal	119	0	119	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.640267-05
7d94ad68-5645-4ac8-982c-9f3b4019851b	15287	2025-12-03 17:16:14-05	Normal	8	0	8	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.641398-05
7b745338-5603-4512-a4b4-cfef48aa31e4	15975	2025-12-03 17:16:14-05	Normal	19	0	19	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.642364-05
a1af92dd-3345-4f7b-b89a-11b62480139d	17425	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.643246-05
6cc3b4ef-9543-4eb0-b1bd-57f212df414e	19932	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.644107-05
c6b942bf-489d-49c9-adf2-4f1028277705	20250	2025-12-03 17:16:14-05	Normal	181	0	181	0	0	0	77	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.644894-05
1f1b7a41-f2cc-4fe2-a38b-0bd31d64ab70	20251	2025-12-03 17:16:14-05	Normal	2	0	2	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.645718-05
4ea7efdc-113d-44f0-a7c8-bcc1bd515aed	21121	2025-12-03 17:16:14-05	Normal	56	0	56	2	0	2	73	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.646852-05
b5199758-4a6c-4a7d-afbc-8c1ce29d9834	25049	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.647812-05
6a8db0be-b41e-4300-a987-15413da9fb42	25257	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.650577-05
4d67b64b-3e64-4ee0-ac83-5cb8520a7159	25366	2025-12-03 17:16:14-05	Normal	310	0	310	0	0	0	136	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.652351-05
60149529-08ca-4217-8b73-873c43b3523d	30111	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.65341-05
564be841-9b16-4548-8864-62e1522704c9	44444	2025-12-03 17:16:14-05	Normal	231	0	231	0	0	0	45	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.654409-05
7044806a-49ff-42b8-aabd-ebe659837555	052919	2025-12-03 17:16:14-05	Normal	786	0	786	1	0	1	14	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.655801-05
f1a75284-17f5-406e-bd67-d2437f5175a6	54321	2025-12-03 17:16:14-05	Normal	89	0	89	24	0	24	101	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.656866-05
02b06366-1d53-4f24-b006-a1788fab67dd	67890	2025-12-03 17:16:14-05	Normal	3	0	3	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.657924-05
0c3c5098-db99-4ec1-87a6-2492654706b7	70665	2025-12-03 17:16:14-05	Normal	599	0	599	6	0	6	57	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.659011-05
629b8709-b46f-49ac-a079-e7baf75d4271	77777	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.659918-05
746d565b-fb3a-4d43-a6f4-4dc8a4255616	80262	2025-12-03 17:16:14-05	Normal	23	0	23	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.660778-05
a2c40d61-027a-499d-9e2f-4373fa4c1875	85020	2025-12-03 17:16:14-05	Normal	208	0	208	8	0	8	286	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.661575-05
7b11b67b-31d5-43f5-bae7-07dd1ee74754	88888	2025-12-03 17:16:14-05	Normal	7	0	7	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.662402-05
9592df81-b346-482e-940d-542a8865fd34	092312	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.663173-05
4a6c3c90-5d38-4afe-a8c7-00c0744d5faa	92312	2025-12-03 17:16:14-05	Normal	340	0	340	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.664148-05
652bd8df-38e0-4ce3-a0cd-61a6cec20dda	97052	2025-12-03 17:16:14-05	Normal	23	0	23	2	0	2	3	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.665576-05
74e6c181-9e3b-474a-9933-c10a8d13ca3d	100425	2025-12-03 17:16:14-05	Normal	82	0	82	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.666836-05
35665d7b-7d66-4d1f-89ac-08e2343cf3d7	100591	2025-12-03 17:16:14-05	Normal	365	0	365	5	0	5	20	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.66762-05
49e9c358-6e23-46be-825f-2baae59b68b0	123456	2025-12-03 17:16:14-05	Normal	63	0	63	22	0	22	11	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.668382-05
8e4cbdb9-a1f6-4435-9c09-3b98d903c3bb	131313	2025-12-03 17:16:14-05	Normal	192	0	192	0	0	0	20	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.66913-05
17861e38-03c4-4660-8697-289a29b350e7	142533	2025-12-03 17:16:14-05	Normal	0	0	0	2	0	2	19	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.669832-05
2d6a5aa1-e09e-4cf0-b1d1-9786c180858a	150828	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.67056-05
fe910593-5c30-4b7a-b25c-2b3e696ddca3	170195	2025-12-03 17:16:14-05	Normal	147	0	147	2	0	2	9	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.671305-05
92ab3c0b-6a75-484d-9b97-b61d2c41763f	181818	2025-12-03 17:16:14-05	Normal	19	0	19	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.672033-05
488550ac-8230-4259-83d7-5e25181c4ee6	191919	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.672735-05
52b2b8d5-0e73-4581-bb83-e7b8e7f9ad7c	202130	2025-12-03 17:16:14-05	Normal	30	0	30	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.673405-05
4ec5c1e9-bdd4-4cd7-8e36-60d69b12732b	202526	2025-12-03 17:16:14-05	Normal	509	0	509	2	0	2	416	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.674128-05
8fa0f016-f76b-4f83-838b-903cbfb48ab9	232025	2025-12-03 17:16:14-05	Normal	49	0	49	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.674955-05
197f3d8d-3d8b-402e-9444-7ea7b818cb6d	240114	2025-12-03 17:16:14-05	Normal	97	0	97	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.675654-05
83ef0339-d9c3-4db8-8864-81a77db79f90	320121	2025-12-03 17:16:14-05	Normal	0	0	0	7	0	7	55	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.676329-05
70e1b525-a4b9-47a1-83dd-62e5e2e2b758	333333	2025-12-03 17:16:14-05	Normal	80	0	80	23	0	23	34	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.677065-05
f12c2939-6f7c-4220-bf04-c56f7c2c9096	425529	2025-12-03 17:16:14-05	Normal	281	0	281	4	0	4	215	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.677779-05
5d1a8727-a0da-42e3-a157-692590c43882	458501	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	5	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.678504-05
85f69f39-ed90-42a2-bad4-4ac302283164	555555	2025-12-03 17:16:14-05	Normal	116	0	116	0	0	0	1	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.679171-05
5543c04b-c399-4bbb-801e-2421d21f2568	654321	2025-12-03 17:16:14-05	Normal	342	0	342	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.679969-05
ac7a4b31-765b-4a7b-a05a-d30fa4d85efa	666666	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.680699-05
91d151e7-708c-47cf-b0f0-39a17af09575	741836	2025-12-03 17:16:14-05	Normal	182	0	182	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.682323-05
cc69fdf3-67b3-4cd3-8fe1-4938b21616d3	808080	2025-12-03 17:16:14-05	Normal	6	0	6	143	0	143	110	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.683502-05
1e8318e4-c6a6-4ab2-ad0b-6f327b89ddae	820408	2025-12-03 17:16:14-05	Normal	169	0	169	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.684327-05
884cbd99-e002-4dd9-98de-5bb959b012b1	999999	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.685092-05
6dcdffbe-bb73-4a5d-98f6-6adbd09f14d8	1234567	2025-12-03 17:16:14-05	Normal	249	0	249	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.68593-05
3755e9a0-cfad-41d2-a3a0-2760457b28c0	2025432	2025-12-03 17:16:14-05	Normal	329	0	329	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.686904-05
343846f3-bb7b-4676-82b0-b5130e26153f	2025805	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.687728-05
acf18f4a-b4f2-41b1-9614-44778e1ae8dd	2025807	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.688465-05
c3a04abe-c4fc-4bdb-a555-1f53219b05bf	2025809	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.689376-05
4037301b-1dbb-43cf-b1c8-1441ee6e4636	02132856	2025-12-03 17:16:14-05	Normal	336	0	336	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.690502-05
b8953691-f303-4691-bed7-14d8c7d88c43	9101112	2025-12-03 17:16:14-05	Normal	50	0	50	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.691704-05
e7251808-eef7-4e9b-ad6f-fd540ab12907	16684502	2025-12-03 17:16:14-05	Normal	0	0	0	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.692773-05
6a3c9a8d-dd1a-4d13-ab8c-48dffd623648	76314865	2025-12-03 17:16:14-05	Normal	310	0	310	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.693698-05
8208c0ee-7598-44b5-b539-5c0d4eac4120	Other	2025-12-03 17:16:14-05	Normal	444	0	444	0	0	0	0	0	8fbf244f-f001-4a63-bdef-19d3a5f6398e	2025-12-27 15:45:11.694828-05
\.


--
-- Data for Name: user_printer_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_printer_assignments (id, user_id, printer_id, assigned_at, assigned_by, is_primary, notes) FROM stdin;
85a9b034-24d7-4bef-a044-965448a73cbd	0000	cf93b885-a932-4a7e-9a73-b0a607d76a50	2025-12-27 16:43:26.830588-05	\N	f	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, status, email, full_name, office, department, created_at, updated_at, role, password_hash) FROM stdin;
demo-user-001	Normal	user@demo.com	Usuario Demo	Sucursal A	Operaciones	2025-12-27 14:25:24.317535-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0000	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.649342-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1967	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.968504-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2015	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.070227-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2211	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.302761-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2716	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.463461-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
4013	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.616332-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
4523	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.663544-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
5020	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.689492-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6568	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.758698-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7066	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.817444-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7894	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.875079-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8044	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.934018-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8346	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.989338-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9868	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.046601-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
44444	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.09832-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
131313	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.171443-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
458501	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.245451-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
555555	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.251502-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
demo-user-002	Normal	user2@demo.com	Usuario Demo 2	Sucursal B	Ventas	2025-12-27 14:25:24.317535-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0116	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.698314-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0207	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.701848-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0218	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.706214-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0306	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.710087-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0325	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.713881-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0408	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.722428-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0409	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.729586-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0424	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.748415-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0477	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.751837-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0505	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.755161-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0525	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.758768-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0624	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.763052-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0712	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.769973-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0729	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.775173-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0803	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.778533-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0819	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.78312-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
654321	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.256686-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
666666	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.26035-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
741836	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.266335-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
808080	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.270285-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
820408	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.275487-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0821	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.786337-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0825	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.789087-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0826	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.791779-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0934	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.795925-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1004	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.798984-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1010	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.801928-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1102	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.807126-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1111	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.810054-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1119	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.812907-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1121	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.815973-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1122	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.818662-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1210	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.822725-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1212	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.825161-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1234	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.827232-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1268	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.830052-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1278	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.834315-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1303	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.838516-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1305	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.846074-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1306	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.852523-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1313	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.856057-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1423	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.859377-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1472	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.863075-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1491	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.870393-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1504	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.87608-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1510	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.879406-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1606	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.882558-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1611	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.886859-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1612	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.891857-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1614	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.8961-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1706	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.902773-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1707	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.908813-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1709	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.920258-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1758	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.926341-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1767	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.932292-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1803	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.937127-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1903	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.943418-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1917	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.949894-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1935	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.953137-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1937	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.960153-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1952	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.963073-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1970	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.972093-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1973	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.977453-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1975	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.98202-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1978	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.985685-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1985	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.98841-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1987	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.991357-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1992	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.99519-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1994	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.999439-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1995	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.003936-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1998	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.009206-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2000	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.014001-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2001	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.020778-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2002	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.038237-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2009	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.057273-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2016	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.09286-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2020	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.109433-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2022	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.122359-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2023	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.134102-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2024	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.149128-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2025	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.161074-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2026	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.172802-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2027	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.196539-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2028	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.208457-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2084	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.221515-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2170	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.248807-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2201	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.263073-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2203	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.27926-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2205	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.291784-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2213	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.316707-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2223	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.329383-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2301	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.342801-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2307	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.358633-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2356	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.368999-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2418	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.389015-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2424	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.406498-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2429	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.421626-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2502	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.429328-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2503	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.43761-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2527	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.443505-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2620	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.448729-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2705	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.453997-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2708	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.458201-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2755	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.467614-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2784	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.472057-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2904	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.475389-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2905	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.479007-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2953	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.488117-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
3004	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.500066-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
3005	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.517356-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
3019	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.532599-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
3107	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.543987-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
3146	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.554429-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
3333	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.568946-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
3566	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.581835-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
3824	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.597667-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
4012	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.608319-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
4061	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.626247-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
4086	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.633762-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
4163	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.63818-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
4210	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.641517-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
4312	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.645754-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
4321	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.652691-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
4423	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.657426-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
0104	Normal	\N	\N	\N	\N	2025-12-27 15:38:16.691719-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
4858	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.684157-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
5467	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.692737-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
5648	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.696866-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6001	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.704131-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6025	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.709178-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6028	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.714442-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6034	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.71893-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6037	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.723794-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6048	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.727512-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6076	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.73201-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6088	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.736039-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6092	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.740868-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6097	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.745397-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6281	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.749174-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6336	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.754719-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6754	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.761657-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6784	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.765264-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
6871	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.769261-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7005	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.772927-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7007	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.776459-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7012	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.779511-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7021	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.783946-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7026	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.787675-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7032	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.791881-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7033	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.795306-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7034	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.801515-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7035	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.805635-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7036	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.809397-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7045	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.814025-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7067	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.821398-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7082	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.825244-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7087	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.8286-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7091	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.832355-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7094	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.835716-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7097	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.839659-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7121	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.843297-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7214	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.848047-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7216	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.853383-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7496	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.85745-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7532	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.860142-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7605	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.864124-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7777	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.866836-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7811	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.870391-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
7907	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.878725-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8005	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.885821-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8008	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.889743-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8010	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.894891-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8011	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.898754-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8014	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.901791-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8020	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.904546-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8023	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.907206-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8025	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.91076-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8030	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.913522-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8033	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.919657-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8035	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.923968-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8036	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.926919-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8040	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.930846-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8049	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.937193-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8050	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.940938-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8051	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.943829-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8058	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.946763-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8060	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.9527-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8064	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.956173-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8070	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.958557-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8074	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.961346-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8078	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.965885-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8081	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.96973-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8085	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.973067-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8090	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.977263-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8098	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.981935-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8207	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.984891-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8888	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.9944-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8899	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.000022-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
8919	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.005855-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9000	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.009617-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9001	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.013745-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9002	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.017266-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9003	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.020383-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9004	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.023798-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9005	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.028157-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9009	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.031044-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9010	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.03452-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9608	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.037251-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9736	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.040127-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9815	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.043497-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9905	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.051425-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
12345	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.054639-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
15160	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.057867-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
15287	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.060857-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
15975	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.063948-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
17425	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.068608-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
19932	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.071378-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
20250	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.073849-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
20251	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.076482-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
21121	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.078999-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
25049	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.08279-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
25257	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.08518-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
25366	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.089456-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
30111	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.094696-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
052919	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.104086-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
54321	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.107427-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
67890	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.111032-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
70665	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.115567-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
77777	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.120201-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
80262	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.12591-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
85020	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.132235-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
88888	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.135836-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
092312	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.141-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
92312	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.144716-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
97052	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.148962-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
100425	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.154761-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
100591	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.159657-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
123456	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.164358-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
142533	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.176068-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
150828	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.179119-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
170195	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.184051-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
181818	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.193256-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
191919	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.198662-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
202130	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.205811-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
202526	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.211814-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
232025	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.216951-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
240114	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.223308-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
320121	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.227106-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
333333	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.233596-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
425529	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.241584-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
4775	Normal	\N	\N	\N	\N	2025-12-27 15:38:17.675288-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
999999	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.278808-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
1234567	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.283659-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2025432	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.289238-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2025805	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.293289-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2025807	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.297794-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
2025809	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.301805-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
02132856	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.305935-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
9101112	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.314517-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
16684502	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.319308-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
76314865	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.326831-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
Other	Normal	\N	\N	\N	\N	2025-12-27 15:38:18.332176-05	2025-12-27 17:19:16.088687-05	user	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
demo-admin-001	Normal	admin@demo.com	Admin Demo	Oficina Principal	AdministraciÃ³n	2025-12-27 14:25:24.317535-05	2025-12-27 17:19:16.088687-05	admin	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
superadmin-1766873088205	Normal	estivenmendezr@gmail.com	Estiven Mendez	Dirección General	Sistemas	2025-12-27 17:04:48.20705-05	2025-12-27 17:19:16.088687-05	superadmin	$2b$10$Bxp0oVszrTorK2tF8ujInOwCfFwQJSizFA5xQEV08wHLwimU241rW
\.


--
-- Name: import_log import_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_log
    ADD CONSTRAINT import_log_pkey PRIMARY KEY (id);


--
-- Name: printers printers_ip_address_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.printers
    ADD CONSTRAINT printers_ip_address_key UNIQUE (ip_address);


--
-- Name: printers printers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.printers
    ADD CONSTRAINT printers_pkey PRIMARY KEY (id);


--
-- Name: prints_monthly prints_monthly_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prints_monthly
    ADD CONSTRAINT prints_monthly_pkey PRIMARY KEY (id);


--
-- Name: prints_monthly prints_monthly_user_id_year_month_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prints_monthly
    ADD CONSTRAINT prints_monthly_user_id_year_month_key UNIQUE (user_id, year, month);


--
-- Name: prints_raw prints_raw_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prints_raw
    ADD CONSTRAINT prints_raw_pkey PRIMARY KEY (id);


--
-- Name: user_printer_assignments user_printer_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_printer_assignments
    ADD CONSTRAINT user_printer_assignments_pkey PRIMARY KEY (id);


--
-- Name: user_printer_assignments user_printer_assignments_user_id_printer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_printer_assignments
    ADD CONSTRAINT user_printer_assignments_user_id_printer_id_key UNIQUE (user_id, printer_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_import_log_batch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_import_log_batch ON public.import_log USING btree (batch_id);


--
-- Name: idx_printers_ip; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_printers_ip ON public.printers USING btree (ip_address);


--
-- Name: idx_printers_office; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_printers_office ON public.printers USING btree (office);


--
-- Name: idx_printers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_printers_status ON public.printers USING btree (status);


--
-- Name: idx_prints_monthly_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prints_monthly_user_date ON public.prints_monthly USING btree (user_id, year, month);


--
-- Name: idx_prints_raw_user_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prints_raw_user_timestamp ON public.prints_raw USING btree (user_id, report_timestamp);


--
-- Name: idx_user_printer_printer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_printer_printer ON public.user_printer_assignments USING btree (printer_id);


--
-- Name: idx_user_printer_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_printer_user ON public.user_printer_assignments USING btree (user_id);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: import_log update_import_log_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_import_log_updated_at BEFORE UPDATE ON public.import_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: printers update_printers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_printers_updated_at BEFORE UPDATE ON public.printers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: prints_monthly update_prints_monthly_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_prints_monthly_updated_at BEFORE UPDATE ON public.prints_monthly FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: prints_monthly prints_monthly_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prints_monthly
    ADD CONSTRAINT prints_monthly_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: prints_raw prints_raw_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prints_raw
    ADD CONSTRAINT prints_raw_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_printer_assignments user_printer_assignments_printer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_printer_assignments
    ADD CONSTRAINT user_printer_assignments_printer_id_fkey FOREIGN KEY (printer_id) REFERENCES public.printers(id) ON DELETE CASCADE;


--
-- Name: user_printer_assignments user_printer_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_printer_assignments
    ADD CONSTRAINT user_printer_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict fxNFMNyqMBVbRLtR3krIlVtcsuc7NeapEaiF5yeOkUJ4eNaBx941ZatuKJAcF7Z

