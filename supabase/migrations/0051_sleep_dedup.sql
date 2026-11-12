-- 0051_sleep_dedup.sql
-- Remove the duplicate sleep records.
--
-- One night = one record. The motion tracker detects the night, the user logs
-- it by hand and the quick log adds it — the same night can end up in the log
-- two or three times.
--
-- Two rows belong to the same night when their time ranges overlap by at
-- least 30 minutes, or when they start less than 60 minutes apart (the same
-- bedtime logged twice). The oldest row of each night survives.

DELETE FROM sleep_logs a
USING sleep_logs b
WHERE a.user_id = b.user_id
  -- Keep one row per night: only the row with the smallest ctid survives.
  AND a.ctid > b.ctid
  AND (
        -- the two nights overlap by at least 30 minutes
        (a.start_time < b.end_time - INTERVAL '30 minutes'
         AND b.start_time < a.end_time - INTERVAL '30 minutes')
        OR
        -- they start less than 60 minutes apart
        abs(EXTRACT(EPOCH FROM (a.start_time - b.start_time))) <= 3600
      );
