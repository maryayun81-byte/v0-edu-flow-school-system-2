-- ========================================
-- Add Quizzes and Leaderboard Tables
-- ========================================

-- Add date column to timetables for specific class dates
alter table timetables add column if not exists class_date date;
alter table timetables add column if not exists is_online boolean default false;
alter table timetables add column if not exists meeting_link text;
alter table timetables add column if not exists meeting_instructions text;

-- Create index for class_date
create index if not exists idx_timetables_class_date on timetables(class_date);

-- Create quizzes table
create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  time_limit_minutes integer default 30,
  points_per_question integer default 10,
  is_published boolean default false,
  scheduled_start timestamp with time zone,
  scheduled_end timestamp with time zone,
  allow_retake boolean default false,
  shuffle_questions boolean default true,
  show_correct_answers boolean default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create quiz questions table
create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('multiple_choice', 'true_false', 'short_answer')),
  options jsonb, -- For multiple choice: [{"id": "a", "text": "Option A"}, ...]
  correct_answer text not null, -- For multiple choice: option id, for true_false: "true"/"false", for short_answer: the answer
  points integer default 10,
  order_index integer default 0,
  explanation text, -- Optional explanation shown after answering
  created_at timestamp with time zone default now()
);

-- Create quiz attempts table (tracks student attempts)
create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  student_name text not null,
  student_email text,
  score integer default 0,
  points_earned integer default 0,
  total_points integer default 0,
  time_taken_seconds integer,
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  completed boolean default false,
  answers jsonb, -- {"question_id": "selected_answer", ...}
  created_at timestamp with time zone default now()
);

-- Add missing columns to quiz_attempts if they don't exist
alter table quiz_attempts add column if not exists points_earned integer default 0;
alter table quiz_attempts add column if not exists completed boolean default false;

-- Create leaderboard table (aggregates student scores)
create table if not exists leaderboard (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  student_email text unique,
  total_points integer default 0,
  quizzes_completed integer default 0,
  average_score decimal(5,2) default 0,
  streak_days integer default 0,
  last_activity timestamp with time zone default now(),
  badges jsonb default '[]', -- ["first_quiz", "perfect_score", "streak_7", ...]
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create indexes
create index if not exists idx_quizzes_created_by on quizzes(created_by);
create index if not exists idx_quizzes_published on quizzes(is_published);
create index if not exists idx_quiz_questions_quiz_id on quiz_questions(quiz_id);
create index if not exists idx_quiz_attempts_quiz_id on quiz_attempts(quiz_id);
create index if not exists idx_quiz_attempts_student on quiz_attempts(student_email);
create index if not exists idx_leaderboard_points on leaderboard(total_points desc);

-- Enable RLS
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_attempts enable row level security;
alter table leaderboard enable row level security;

-- Quizzes Policies
create policy "Teachers can insert quizzes"
  on quizzes for insert
  with check (created_by = auth.uid());

create policy "Everyone can view published quizzes"
  on quizzes for select
  using (is_published = true or created_by = auth.uid());

create policy "Teachers can update their own quizzes"
  on quizzes for update
  using (created_by = auth.uid());

create policy "Teachers can delete their own quizzes"
  on quizzes for delete
  using (created_by = auth.uid());

-- Quiz Questions Policies
create policy "Teachers can manage quiz questions"
  on quiz_questions for all
  using (
    exists (
      select 1 from quizzes
      where quizzes.id = quiz_questions.quiz_id
      and quizzes.created_by = auth.uid()
    )
  );

create policy "Everyone can view questions of published quizzes"
  on quiz_questions for select
  using (
    exists (
      select 1 from quizzes
      where quizzes.id = quiz_questions.quiz_id
      and quizzes.is_published = true
    )
  );

-- Quiz Attempts Policies (anyone can submit attempts)
create policy "Anyone can insert quiz attempts"
  on quiz_attempts for insert
  with check (true);

create policy "Anyone can view quiz attempts"
  on quiz_attempts for select
  using (true);

create policy "Anyone can update their own attempts"
  on quiz_attempts for update
  using (true);

-- Leaderboard Policies (public)
create policy "Anyone can view leaderboard"
  on leaderboard for select
  using (true);

create policy "Anyone can insert to leaderboard"
  on leaderboard for insert
  with check (true);

create policy "Anyone can update leaderboard"
  on leaderboard for update
  using (true);
