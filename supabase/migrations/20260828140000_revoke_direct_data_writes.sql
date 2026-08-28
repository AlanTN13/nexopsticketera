-- Apply only after the application version that uses the RPCs from
-- 20260828130000_data_integrity_boundary.sql is deployed and smoke-tested.
-- Keeping revocations separate makes the rollout backward compatible:
-- additive DB -> application deploy -> destructive grants cutover.

revoke insert, update on public.tickets from authenticated;
revoke insert on public.ticket_comments from authenticated;
revoke insert on public.ticket_attachments from authenticated;
revoke insert on public.ticket_history from authenticated;

-- User profile creation/update now uses the server-only service-role client
-- after the application has authorized the actor and target company/role.
revoke insert, update on public.users from authenticated;

