ALTER TABLE school_settings 
ADD COLUMN IF NOT EXISTS auto_attach_signature BOOLEAN DEFAULT false;
