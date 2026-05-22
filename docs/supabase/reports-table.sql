-- NewsHub — Reports table + RLS
-- Run in Supabase SQL Editor.
--
-- PostgreSQL does not support CREATE POLICY IF NOT EXISTS — use DROP + CREATE.

CREATE TABLE IF NOT EXISTS public.reports (
  id                BIGSERIAL    PRIMARY KEY,
  reporter_user_id  UUID         NOT NULL,
  target_type       TEXT         NOT NULL
                      CHECK (target_type IN
                        ('news', 'candidate', 'user', 'comment')),
  target_id         TEXT         NOT NULL,
  target_label      TEXT,
  reason            TEXT         NOT NULL,
  details           TEXT,
  status            TEXT         NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','REVIEWED','DISMISSED')),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reviewed_by       UUID,
  reviewed_at       TIMESTAMPTZ
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_insert_report" ON public.reports;
CREATE POLICY "auth_insert_report"
ON public.reports FOR INSERT TO authenticated
WITH CHECK (reporter_user_id = auth.uid());

DROP POLICY IF EXISTS "user_read_own_reports" ON public.reports;
CREATE POLICY "user_read_own_reports"
ON public.reports FOR SELECT TO authenticated
USING (reporter_user_id = auth.uid());

DROP POLICY IF EXISTS "admin_read_all_reports" ON public.reports;
CREATE POLICY "admin_read_all_reports"
ON public.reports FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE email = (auth.jwt() ->> 'email')
    AND role = 'ADMIN'
  )
);

DROP POLICY IF EXISTS "admin_update_reports" ON public.reports;
CREATE POLICY "admin_update_reports"
ON public.reports FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE email = (auth.jwt() ->> 'email')
    AND role = 'ADMIN'
  )
);
