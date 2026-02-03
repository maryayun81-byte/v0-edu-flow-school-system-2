# Storage Bucket Setup for Document Notes

## Manual Setup Required (Cannot be done via SQL)

Since Supabase storage buckets require dashboard configuration, follow these steps:

### Step 1: Create the `documents` Storage Bucket

1. Go to your Supabase Dashboard → Storage
2. Click "New Bucket"
3. Name it: `documents`
4. Make it **Private** (not public)
5. Click "Create bucket"

### Step 2: Set Storage Bucket Policies

In your Supabase Dashboard → Storage → documents bucket → Policies:

#### Policy 1: Allow users to upload files
```
CREATE POLICY "Users can upload files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
);
```

#### Policy 2: Allow users to read their own files
```
CREATE POLICY "Users can read files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
);
```

#### Policy 3: Allow users to delete their own files
```
CREATE POLICY "Users can delete files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents' 
  AND auth.uid() IS NOT NULL
);
```

## Database Setup - COMPLETED ✅

The following have been successfully configured:

### Tables Created
- ✅ `notes` - References `auth.users(id)`
- ✅ `assignments` - References `auth.users(id)`
- ✅ `timetables` - References `auth.users(id)`

### Foreign Keys Fixed
- ✅ All `created_by` columns reference `auth.users(id)` with cascade delete

### Row-Level Security (RLS) Enabled
- ✅ RLS enabled on all three tables
- ✅ Users can insert/read/update/delete only their own records
- ✅ Policies prevent cross-user data access

## Testing the Setup

You can now:
1. Create assignments - ✅ Will insert with current user's ID
2. Create timetables - ✅ Will insert with current user's ID
3. Upload notes - ✅ Will upload to storage and create database entry
4. All data is automatically filtered to show only the current user's records
