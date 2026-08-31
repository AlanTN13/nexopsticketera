-- Client preference writes now go through the Portal's authenticated server
-- data-access layer. Remove the elevated Data API endpoint entirely.

drop function if exists public.update_radar_preferences(uuid, text[], integer, text, text);
