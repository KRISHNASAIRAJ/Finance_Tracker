-- Migration 0057: Row-Level Security for Notes v2.
-- Owned tables scope by user_id; junction tables scope by the parent note's
-- owner so a user can never attach a tag/link to somebody else's note.

ALTER TABLE note ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns notes_v2" ON note;
CREATE POLICY "User owns notes_v2" ON note FOR ALL
  USING ((select auth.uid())::text = user_id)
  WITH CHECK ((select auth.uid())::text = user_id);

DROP POLICY IF EXISTS "User owns note folders" ON folder;
CREATE POLICY "User owns note folders" ON folder FOR ALL
  USING ((select auth.uid())::text = user_id)
  WITH CHECK ((select auth.uid())::text = user_id);

DROP POLICY IF EXISTS "User owns note tags" ON tag;
CREATE POLICY "User owns note tags" ON tag FOR ALL
  USING ((select auth.uid())::text = user_id)
  WITH CHECK ((select auth.uid())::text = user_id);

DROP POLICY IF EXISTS "User owns note_tag rows" ON note_tag;
CREATE POLICY "User owns note_tag rows" ON note_tag FOR ALL
  USING (EXISTS (SELECT 1 FROM note n
                 WHERE n.id = note_tag.note_id
                   AND n.user_id = (select auth.uid())::text))
  WITH CHECK (EXISTS (SELECT 1 FROM note n
                      WHERE n.id = note_tag.note_id
                        AND n.user_id = (select auth.uid())::text));

DROP POLICY IF EXISTS "User owns note_link rows" ON note_link;
CREATE POLICY "User owns note_link rows" ON note_link FOR ALL
  USING (EXISTS (SELECT 1 FROM note n
                 WHERE n.id = note_link.note_id
                   AND n.user_id = (select auth.uid())::text))
  WITH CHECK (EXISTS (SELECT 1 FROM note n
                      WHERE n.id = note_link.note_id
                        AND n.user_id = (select auth.uid())::text));

DROP POLICY IF EXISTS "User owns note attachments" ON attachment;
CREATE POLICY "User owns note attachments" ON attachment FOR ALL
  USING (EXISTS (SELECT 1 FROM note n
                 WHERE n.id = attachment.note_id
                   AND n.user_id = (select auth.uid())::text))
  WITH CHECK (EXISTS (SELECT 1 FROM note n
                      WHERE n.id = attachment.note_id
                        AND n.user_id = (select auth.uid())::text));
