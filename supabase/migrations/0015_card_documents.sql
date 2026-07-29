-- Migration 0015: Card T&C document storage for RAG
-- Stores uploaded card T&C documents for AI-powered Q&A

CREATE TABLE IF NOT EXISTS card_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_name TEXT NOT NULL,
  file_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add foreign key after table creation (auth.users may not exist yet in migration runner)
-- ALTER TABLE card_documents ADD CONSTRAINT fk_card_documents_user
--   FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE card_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own card documents" ON card_documents
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Full-text search index for document retrieval
CREATE INDEX IF NOT EXISTS idx_card_documents_user ON card_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_card_documents_card_name ON card_documents(card_name);
CREATE INDEX IF NOT EXISTS idx_card_documents_updated_at ON card_documents(updated_at);
