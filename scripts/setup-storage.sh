#!/bin/bash

# This script creates the necessary storage buckets for the application
# Run this once after setting up your Supabase project

echo "Setting up Supabase storage buckets..."

# Create documents bucket for notes and assignments
curl -X POST "https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/b" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "documents",
    "public": true,
    "allowed_mime_types": ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain", "image/*"],
    "file_size_limit": 52428800
  }'

echo "Storage setup complete!"
