import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRoute } from '@/server/route';

export const GET = withRoute({ cache: "private", action: "list universities" }, async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('universities').select('id,slug,name,city').eq('active', true).order('name');
  if (error) throw error;
  return NextResponse.json({ universities: data ?? [] });
});
