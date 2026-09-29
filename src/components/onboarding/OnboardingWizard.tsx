"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import InterestTagSelector from "@/components/profile/InterestTagSelector";
import { useAuthStore } from "@/store/useAuthStore";
import type { UserUpdateBodyInput } from "@/contracts/users";

type University = { id: string; name: string };
type OnboardingWizardProps = { userId: string; initialName: string; avatarUrl: string | null };

export function OnboardingWizard({ userId, initialName }: OnboardingWizardProps) {
  const router = useRouter();
  const updateUser = useAuthStore(state => state.updateUser);
  const [name, setName] = useState(initialName);
  const [university, setUniversity] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [other, setOther] = useState("");
  const [program, setProgram] = useState("");
  const [year, setYear] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetch('/api/universities').then(async response => {
      if (!response.ok) throw new Error('Universities could not be loaded. You can choose Other or prefer not to specify.');
      const data = await response.json();
      if (live) setUniversities(data.universities);
    }).catch(error => { if (live) setError(error.message); });
    return () => { live = false; };
  }, []);
  const complete = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    const affiliation = university === 'other' || university === 'unspecified'
      ? { university_id: null, other_university: university === 'unspecified' ? 'Prefer not to specify' : other.trim() || 'Other' }
      : { university_id: university, other_university: null };
    const payload = { name: name.trim(), ...affiliation, program: program.trim() || null, year: year.trim() || null, interest_tags: tags, onboarding_completed: true } satisfies UserUpdateBodyInput;
    try {
      const response = await fetch(`/api/users/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save your profile');
      const finished = await fetch('/api/onboarding/complete', { method: 'POST' });
      if (!finished.ok) throw new Error('Profile saved. Please try finishing again.');
      updateUser({ ...payload, affiliation_source: 'self_declared' });
      router.push('/'); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your profile'); setSaving(false); }
  };
  const selectClass = 'h-11 w-full rounded-md border border-input bg-background px-3 text-sm';
  return <main className="mx-auto max-w-xl px-4 py-12">
    <h1 className="text-3xl font-semibold tracking-tight">Make UNI-VERSE yours</h1>
    <p className="mt-3 text-muted-foreground">A name and university choice are all you need. Interests help tailor discovery and are optional.</p>
    <form onSubmit={complete} className="mt-8 space-y-6">
      <div className="space-y-2"><label htmlFor="ob-name">Display name</label><Input id="ob-name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={50} required autoComplete="name" /></div>
      <div className="space-y-2"><label htmlFor="ob-university">University</label><select id="ob-university" value={university} onChange={e => setUniversity(e.target.value)} required className={selectClass}><option value="">Choose a university</option>{universities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="other">Other</option><option value="unspecified">Prefer not to specify</option></select><p className="text-xs text-muted-foreground">Self-declared affiliation does not verify enrollment or grant organizer access.</p></div>
      {university === 'other' && <div className="space-y-2"><label htmlFor="ob-other">University name (optional)</label><Input id="ob-other" value={other} onChange={e => setOther(e.target.value)} maxLength={120} /></div>}
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="ob-program">Program (optional)</label><Input id="ob-program" value={program} onChange={e => setProgram(e.target.value)} maxLength={120} /></div><div className="space-y-2"><label htmlFor="ob-year">Year (optional)</label><Input id="ob-year" value={year} onChange={e => setYear(e.target.value)} maxLength={30} /></div></div>
      <details className="rounded-lg border p-4"><summary className="cursor-pointer font-medium">Interests (optional)</summary><div className="pt-4"><InterestTagSelector selected={tags} onChange={setTags} min={0} /></div></details>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving || name.trim().length < 2 || !university} className="w-full">{saving ? 'Saving…' : 'Finish setup'}</Button>
      <p className="text-sm text-muted-foreground">Talent enrollment is separate. Completing this profile does not share a resume or opt you into recruiting.</p>
    </form>
    <Link href="/" className="mt-6 inline-block text-sm underline">Keep browsing for now</Link>
  </main>;
}
