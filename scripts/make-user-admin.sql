-- Script to create an Admin user in Supabase
-- Replace 'YOUR_EMAIL' and 'YOUR_PASSWORD' with actual values

-- 1. Create the user in auth.users (if not exists, can be done via Dashboard UI manually too)
-- NOTE: It's often easier to Sign Up as a normal user first, then run the update below.
-- This script assumes you have ALREADY signed up as a user and want to make them an admin.

-- 2. Update the user's role in the profiles table
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'YOUR_EMAIL_HERE';

-- 3. (Optional) If you want to create a new user via SQL (requires pgcrypto extension)
-- INSERT INTO auth.users (id, email, password, email_confirmed_at, role)
-- VALUES (
--   gen_random_uuid(),
--   'admin@peakperformance.com',
--   crypt('password123', gen_salt('bf')),
--   now(),
--   'authenticated'
-- );

-- 4. Verify the check
SELECT * FROM public.profiles WHERE role = 'admin';
