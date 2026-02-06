-- Inspect RLS policies on 'marks' table
SELECT *
FROM pg_policies
WHERE tablename = 'marks';

-- Also check table definition just in case
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'marks';
