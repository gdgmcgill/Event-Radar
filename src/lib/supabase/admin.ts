import { createClient } from '@/lib/supabase/server';

export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return false;
  }

  // Check if user has admin role in the users table
  const { data: user, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (error || !user) {
    return false;
  }

  if (user.is_admin === true) {
    console.log('User is admin');
  }

  return user.is_admin === true;
}