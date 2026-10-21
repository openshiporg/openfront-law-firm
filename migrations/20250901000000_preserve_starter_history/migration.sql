-- Preserve the original starter schema and every row before installing the
-- independent Law Firm foundation. No old SQL is rewritten and no data is dropped.
-- This forward bridge applies between the unchanged starter and Law histories.
CREATE SCHEMA "legacy_starter";
DO $$
DECLARE target text;
BEGIN
  IF to_regclass('public."Firm"') IS NOT NULL THEN
    RAISE EXCEPTION 'Starter archival bridge must precede Law Firm foundation';
  END IF;
  FOREACH target IN ARRAY ARRAY['Role', 'User', 'Todo', 'TodoImage', '_Todo_todoImages'] LOOP
    IF to_regclass(format('public.%I', target)) IS NULL THEN
      RAISE EXCEPTION 'Expected original starter table % is missing', target;
    END IF;
    EXECUTE format('ALTER TABLE public.%I SET SCHEMA legacy_starter', target);
  END LOOP;
END $$;
REVOKE ALL ON SCHEMA "legacy_starter" FROM PUBLIC;
