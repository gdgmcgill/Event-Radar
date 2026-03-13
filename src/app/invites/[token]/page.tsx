import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Users, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accept Invitation | UNI-VERSE",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

function ErrorCard({
  icon: Icon,
  title,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="max-w-md w-full border-none shadow-lg">
        <CardContent className="p-8 text-center space-y-4">
          <Icon className="h-12 w-12 mx-auto text-destructive/70" />
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
          <Link href="/">
            <Button variant="outline" className="mt-2">
              Go Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/?signin=required&next=/invites/${token}`);
  }

  // Look up invitation with club details
  const { data: invitation, error: inviteError } = await supabase
    .from("club_invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  // Token not found or already accepted
  if (inviteError || !invitation) {
    return (
      <ErrorCard
        icon={XCircle}
        title="Invalid Invitation"
        message="This invitation is no longer valid. It may have already been used or does not exist."
      />
    );
  }

  // Check expiration
  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <ErrorCard
        icon={AlertTriangle}
        title="Invitation Expired"
        message="This invitation has expired. Please ask the club owner to send a new one."
      />
    );
  }

  // Check email match (case-insensitive)
  if (
    user.email?.toLowerCase() !== invitation.invitee_email.toLowerCase()
  ) {
    return (
      <ErrorCard
        icon={XCircle}
        title="Wrong Account"
        message="This invitation was sent to a different email address. Please sign in with the correct account."
      />
    );
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from("club_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("club_id", invitation.club_id)
    .maybeSingle();

  if (existingMember) {
    return (
      <ErrorCard
        icon={AlertTriangle}
        title="Already a Member"
        message="You are already a member of this club."
      />
    );
  }

  // Fetch club details for display
  const { data: club } = await supabase
    .from("clubs")
    .select("id, name, logo_url")
    .eq("id", invitation.club_id)
    .single();

  if (!club) {
    return (
      <ErrorCard
        icon={XCircle}
        title="Club Not Found"
        message="The club associated with this invitation could not be found."
      />
    );
  }

  // Valid invitation -- auto-accept: insert member and mark invite as accepted
  const [memberResult, updateResult] = await Promise.all([
    supabase.from("club_members").insert({
      user_id: user.id,
      club_id: invitation.club_id,
      role: "organizer",
    }),
    supabase
      .from("club_invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id),
  ]);

  if (memberResult.error || updateResult.error) {
    return (
      <ErrorCard
        icon={XCircle}
        title="Something Went Wrong"
        message="We could not complete your invitation acceptance. Please try again or contact the club owner."
      />
    );
  }

  // Success
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="max-w-md w-full border-none shadow-lg">
        <CardContent className="p-8 text-center space-y-6">
          {/* Club Logo */}
          <div className="flex justify-center">
            {club.logo_url ? (
              <Image
                src={club.logo_url}
                alt={`${club.name} logo`}
                width={80}
                height={80}
                className="rounded-xl object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-secondary/30 flex items-center justify-center">
                <Users className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}
          </div>

          <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />

          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">
              Welcome to {club.name}!
            </h1>
            <p className="text-muted-foreground">
              You have been added as an organizer. You can now manage events and
              invite other members.
            </p>
          </div>

          <Link href={`/my-clubs/${club.id}`}>
            <Button className="bg-[#ED1B2F] hover:bg-[#ED1B2F]/90 text-white mt-2">
              Go to Club Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
