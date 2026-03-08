-- Create AI Insights table for caching
CREATE TABLE IF NOT EXISTS public.ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- e.g., 'admin-attendance', 'teacher-attendance'
    context_id TEXT NOT NULL, -- e.g., event_id or student_id
    insight TEXT NOT NULL,
    data_hash TEXT NOT NULL, -- To detect if underlying data changed significantly
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(type, context_id)
);

-- Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read insights
CREATE POLICY "Allow authenticated users to read insights"
ON public.ai_insights
FOR SELECT
TO authenticated
USING (true);

-- Allow admins to insert/update insights (assuming 'admin' role exists)
-- If role check is complex, we can simplify to all authenticated for now
-- but typically AI generation is triggered by higher roles.
CREATE POLICY "Allow service role or admins to manage insights"
ON public.ai_insights
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'teacher')
    )
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_insights_type_context ON public.ai_insights(type, context_id);
