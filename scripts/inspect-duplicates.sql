-- List all classes to identify duplicates
SELECT id, name, form_level, created_at
FROM classes
ORDER BY name, created_at;

-- Count duplicates by name
SELECT name, count(*)
FROM classes
GROUP BY name
HAVING count(*) > 1;
