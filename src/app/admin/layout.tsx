/**
 * Admin layout - Protected layout for admin pages
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isAdmin } from "@/lib/supabase/admin";
import { LayoutDashboard, FileQuestion, Settings } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user is admin, redirect if not
  const userIsAdmin = await isAdmin();
  
  if (!userIsAdmin) {
    redirect('/');
  }



  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage events and platform settings</p>
      </div>

      {/* Admin Navigation */}
      <nav className="mb-8 border-b">
        <div className="flex space-x-4">
          <Link href="/admin">
            <Button variant="ghost" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/admin/pending">
            <Button variant="ghost" className="flex items-center gap-2">
              <FileQuestion className="h-4 w-4" />
              Pending Events
            </Button>
          </Link>
          {/* TODO: Add more admin links */}
        </div>
      </nav>

      {children}
    </div>
  );
}





