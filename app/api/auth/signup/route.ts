import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name } = await request.json();

    // Sign up user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          role: 'teacher',
        },
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'User creation failed' },
        { status: 400 }
      );
    }

    // NOTE: Profile creation is now handled by the 'on_auth_user_created' database trigger.
    // We can verify it exists if we want, but letting the trigger handle it 
    // prevents RLS issues with the 'anon' key during signup.
    
    // We add a small delay or just proceed, as the trigger is synchronous in the transaction.

    return NextResponse.json(
      { user: authData.user, message: 'Signup successful' },
      { status: 200 }
    );

    return NextResponse.json(
      { user: authData.user, message: 'Signup successful' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred: ' + (error as any).message },
      { status: 500 }
    );
  }
}
