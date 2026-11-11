-- Migration 0045: mutual fund SIP due day
-- Every mutual fund in this portfolio is a recurring SIP that is due on the
-- 1st of the month. Rows created before this rule existed have no
-- sip_day (or an ad-hoc one), so normalise them to the 1st.

UPDATE holdings
SET sip_day = 1
WHERE type = 'mf'
  AND (sip_day IS NULL OR sip_day <> 1);
