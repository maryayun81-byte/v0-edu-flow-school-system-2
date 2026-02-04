# Database Setup Guide

## Overview
This guide will help you fix the authentication issues in your EduFlow application by properly setting up the database schema.

## The Problem
You're experiencing two main issues:
1. **Profile creation error**: "Could not find the table 'public.profiles' in the schema cache"
2. **Login failure**: "No account found with this admission number" even after creating an account

These issues occur because the database schema is incomplete or hasn't been properly initialized.

## The Solution

### Step 1: Run the Database Setup Script

1. **Open Supabase Dashboard**
   - Go to [https://supabase.com](https://supabase.com)
   - Sign in to your account
   - Select your EduFlow project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query" button

3. **Copy and Execute the Setup Script**
   - Open the file: `scripts/fix-database-schema.sql`
   - Copy the entire contents
   - Paste into the Supabase SQL Editor
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

4. **Wait for Completion**
   - The script should complete in a few seconds
   - You should see "Success. No rows returned" or similar message

### Step 2: Verify the Setup

After running the script, verify that everything is set up correctly:

#### Check Profiles Table Structure

Run this query in the SQL Editor:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;
```

**Expected columns:**
- `id` (uuid)
- `full_name` (text)
- `email` (text)
- `phone` (text)
- `subject` (text)
- `bio` (text)
- `avatar_url` (text)
- `role` (text)
- `admission_number` (text)
- `username` (text)
- `school_name` (text)
- `form_class` (text)
- `subjects` (jsonb)
- `profile_completed` (boolean)
- `date_of_birth` (date)
- `guardian_name` (text)
- `guardian_phone` (text)
- `address` (text)
- `theme` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

#### Check RLS Policies

Run this query:

```sql
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';
```

**Expected policies:**
- `Anyone can view all profiles` (SELECT)
- `Users can insert their own profile` (INSERT)
- `Users can update their own profile` (UPDATE)

### Step 3: Test the Application

#### Test Student Signup

1. **Navigate to Signup Page**
   - Open your application
   - Go to `/student/signup`

2. **Fill in the Form**
   - Full Name: Enter a test name (e.g., "John Doe")
   - Username: Enter a username (e.g., "johndoe") - Optional
   - Email: Enter an email or leave blank - Optional
   - Password: Enter a password (at least 6 characters)
   - Confirm Password: Re-enter the same password

3. **Submit the Form**
   - Click "Create Account"
   - You should see a success page with an admission number

4. **Check Browser Console**
   - Press F12 to open Developer Tools
   - Go to the Console tab
   - Look for "Profile created successfully" message
   - If there are errors, copy them for debugging

#### Test Student Login

1. **Navigate to Login Page**
   - Go to `/student/login`

2. **Login with Admission Number**
   - Enter the admission number from signup (e.g., "ADM-2026-1234")
   - Enter your password
   - Click "Sign In"

3. **Check Browser Console**
   - Look for "Profile lookup:" log message
   - Look for "Using auth email:" log message
   - These will help debug any issues

4. **Verify Successful Login**
   - You should be redirected to `/student/dashboard`
   - If login fails, check the console for error messages

#### Test Alternative Login Methods

If you provided a username during signup:
- Try logging in with your username (e.g., "@johndoe" or just "johndoe")

If you provided an email during signup:
- Try logging in with your email

### Step 4: Verify Data in Database

1. **Go to Supabase Dashboard**
   - Navigate to "Table Editor" in the left sidebar
   - Click on "profiles" table

2. **Check for Your Profile**
   - You should see a row with your data
   - Verify all fields are populated correctly:
     - `id` should match your auth user ID
     - `full_name` should be your name
     - `admission_number` should be in format "ADM-YYYY-XXXX"
     - `username` should be your username (if provided)
     - `email` should be your email (if provided)
     - `role` should be "student"
     - `theme` should be "dark"

## Troubleshooting

### Issue: "Could not find the table 'public.profiles'"

**Solution:**
- The database setup script wasn't run
- Run the `fix-database-schema.sql` script in Supabase SQL Editor

### Issue: "Profile creation error" in browser console

**Possible causes:**
1. **RLS policies are too restrictive**
   - Re-run the database setup script to reset policies

2. **Missing columns**
   - Check the table structure using the verification query
   - Re-run the database setup script

3. **Permission issues**
   - Make sure you're using the correct Supabase project
   - Check that your Supabase URL and anon key are correct in `.env.local`

### Issue: "No account found with this admission number"

**Possible causes:**
1. **Profile wasn't created during signup**
   - Check browser console during signup for errors
   - Check the profiles table in Supabase to see if the profile exists

2. **Admission number mismatch**
   - Make sure you're entering the exact admission number shown after signup
   - Admission numbers are case-insensitive but must match the format

3. **RLS policies blocking SELECT**
   - Re-run the database setup script to ensure SELECT policy allows all users

### Issue: Login works but shows wrong data

**Solution:**
- Clear your browser cache and cookies
- Sign out and sign in again
- Check that the correct user data is in the profiles table

## Environment Variables

Make sure your `.env.local` file has the correct Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

You can find these in your Supabase Dashboard under Settings > API.

## Next Steps

After successfully fixing the authentication:

1. **Test all user flows**
   - Student signup and login
   - Teacher signup and login (if applicable)
   - Admin login (if applicable)

2. **Implement remaining features**
   - Profile completion
   - Theme selection
   - Dashboard functionality
   - Messaging system
   - Notifications

3. **Set up proper error monitoring**
   - Consider using Sentry or similar for production error tracking
   - Add more comprehensive logging

## Support

If you continue to experience issues:

1. **Check browser console** for detailed error messages
2. **Check Supabase logs** in Dashboard > Logs
3. **Verify environment variables** are correct
4. **Re-run the database setup script** to ensure everything is properly configured

## Summary

The fix involves:
1. ✅ Running the comprehensive database setup script
2. ✅ Verifying the profiles table structure
3. ✅ Testing signup and login flows
4. ✅ Checking data in the database

The updated code now includes:
- Better error handling in signup
- Detailed logging for debugging
- Improved error messages for users
- Proper profile creation with all required fields
