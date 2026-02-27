import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface PageProps {
  params: Promise<{ token: string }>;
}

function InviteErrorPage({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {icon}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>
        <Link href="/">
          <Button variant="outline" className="w-full">
            Go to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default async function InviteAcceptancePage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  // Step 1: Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to home with signin prompt, preserving the invite URL for after login
    redirect(`/?next=/invites/${token}`);
  }

  // Step 2: Look up the invitation by token
  // RLS "Invitees can view their own invitations" policy requires email match
  // If the email doesn't match, the query returns null (RLS filters it out)
  const { data: invite } = await supabase
    .from("club_invitations")
    .select("id, club_id, invitee_email, status, expires_at")
    .eq("token", token)
    .single();

  // Step 3: Handle "not found" — could be invalid token OR email mismatch (RLS filtered)
  if (!invite) {
    return (
      <InviteErrorPage
        icon={<XCircle className="h-12 w-12 text-destructive" />}
        title="Invitation not found"
        message="This invitation link is invalid, or it was sent to a different email address. Make sure you are signed in with the email address the invitation was sent to."
      />
    );
  }

  // Step 4: Check if already accepted/revoked/expired status
  if (invite.status !== "pending") {
    const statusMessages: Record<string, string> = {
      accepted: "This invitation has already been accepted.",
      revoked: "This invitation has been revoked by the club owner.",
      expired: "This invitation has expired.",
    };
    return (
      <InviteErrorPage
        icon={<AlertTriangle className="h-12 w-12 text-amber-500" />}
        title="Invitation unavailable"
        message={statusMessages[invite.status] ?? "This invitation is no longer valid."}
      />
    );
  }

  // Step 5: Check expiry
  if (new Date(invite.expires_at) < new Date()) {
    return (
      <InviteErrorPage
        icon={<AlertTriangle className="h-12 w-12 text-amber-500" />}
        title="Invitation expired"
        message="This invitation has expired. Ask the club owner to send a new one."
      />
    );
  }

  // Step 6: Check if user is already a member (prevents duplicate key error)
  const { data: existingMember } = await supabase
    .from("club_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("club_id", invite.club_id)
    .single();

  if (existingMember) {
    // Already a member — just redirect to the club dashboard
    redirect(`/my-clubs/${invite.club_id}?tab=overview`);
  }

  // Step 7: Insert into club_members as organizer
  const { error: memberError } = await supabase
    .from("club_members")
    .insert({
      club_id: invite.club_id,
      user_id: user.id,
      role: "organizer",
    });

  if (memberError) {
    console.error("Error accepting invitation:", memberError);
    return (
      <InviteErrorPage
        icon={<XCircle className="h-12 w-12 text-destructive" />}
        title="Something went wrong"
        message="We could not add you to the club. Please try again or contact the club owner."
      />
    );
  }

  // Step 8: Mark invitation as accepted
  // RLS "Invitees can accept their own invitations" policy allows this
  await supabase
    .from("club_invitations")
    .update({ status: "accepted" })
    .eq("id", invite.id);

  // Step 9: Fetch club name for the success message
  const { data: club } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", invite.club_id)
    .single();

  // Step 10: Show success page with link to dashboard
  // Using a success page instead of immediate redirect so the user sees confirmation
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            You&apos;re in!
          </h1>
          <p className="text-muted-foreground">
            You have been added as an organizer for{" "}
            <span className="font-semibold text-foreground">
              {club?.name ?? "the club"}
            </span>
            .
          </p>
        </div>
        <Link href={`/my-clubs/${invite.club_id}?tab=overview`}>
          <Button className="w-full">Go to Club Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
