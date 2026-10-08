-- PDF opcional (ex.: lista de questões) anexado ao exercício, guardado no próprio banco
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS pdf_name TEXT NOT NULL DEFAULT '';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS pdf_data BYTEA;
