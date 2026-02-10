-- CHECK CONSTRAINTS
SELECT conname, confrelid::regclass, conrelid::regclass 
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass;
