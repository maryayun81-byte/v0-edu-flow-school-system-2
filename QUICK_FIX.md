# 🚀 Quick Fix Guide - Authentication Issues

## Problem
- ❌ "Could not find the table 'public.profiles'"
- ❌ "No account found with this admission number"

## Solution (3 Steps)

### 1️⃣ Run Database Script (5 minutes)

1. Open [Supabase Dashboard](https://supabase.com)
2. Go to **SQL Editor** → **New Query**
3. Copy contents from `scripts/fix-database-schema.sql`
4. Paste and click **Run**
5. Wait for "Success" message

### 2️⃣ Test Signup

1. Go to `/student/signup`
2. Fill in:
   - Full Name ✅
   - Username (optional)
   - Email (optional)
   - Password ✅
3. Click **Create Account**
4. Save the **Admission Number** shown

### 3️⃣ Test Login

1. Go to `/student/login`
2. Enter your **Admission Number**
3. Enter your **Password**
4. Click **Sign In**
5. Should redirect to dashboard ✅

## Verification Checklist

After running the script, verify in Supabase:

**Table Editor → profiles:**
- [ ] Table exists
- [ ] Has columns: `id`, `full_name`, `email`, `username`, `admission_number`, `theme`, `role`
- [ ] After signup, new row appears with your data

**SQL Editor - Check Policies:**
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'profiles';
```
Expected:
- ✅ Anyone can view all profiles
- ✅ Users can insert their own profile
- ✅ Users can update their own profile

## What Changed

### Database
- ✅ Created/updated `profiles` table with all required columns
- ✅ Added `username`, `email`, `theme` columns
- ✅ Fixed RLS policies to allow signup and login
- ✅ Added proper indexes for performance

### Code
- ✅ Enhanced error handling in signup
- ✅ Added detailed logging for debugging
- ✅ Better error messages for users
- ✅ Profile creation now fails loudly instead of silently

## Debugging

### Open Browser Console (F12)

**During Signup:**
- Look for: `"Profile created successfully"`
- If error, copy the full error message

**During Login:**
- Look for: `"Profile lookup:"` and `"Using auth email:"`
- These show what's happening behind the scenes

### Common Issues

**"Profile creation error"**
→ Re-run the database script

**"No account found"**
→ Check if profile exists in Supabase Table Editor

**Still not working?**
→ Check `.env.local` has correct Supabase URL and key

## Files Modified

1. ✅ `scripts/fix-database-schema.sql` - Comprehensive database setup
2. ✅ `app/student/signup/page.tsx` - Better error handling
3. ✅ `app/student/login/page.tsx` - Enhanced logging
4. ✅ `DATABASE_SETUP_GUIDE.md` - Detailed instructions

## Next Steps

Once authentication works:
1. Test theme selection
2. Complete profile setup
3. Test messaging system
4. Test notifications
5. Deploy to production

---

**Need Help?** Check `DATABASE_SETUP_GUIDE.md` for detailed troubleshooting.
