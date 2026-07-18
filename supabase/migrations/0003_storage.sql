-- Migration 0003: Storage bucket for card T&C PDFs (Phase 6 prep)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tnc_documents',
  'tnc_documents',
  FALSE,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "User can read own T&C docs" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'tnc_documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "User can upload own T&C docs" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'tnc_documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "User can delete own T&C docs" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'tnc_documents' AND (storage.foldername(name))[1] = auth.uid()::text);
