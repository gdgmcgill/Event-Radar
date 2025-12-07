"use client";

import { useUser } from "@/hooks/useUser";
import { SignInButton } from "@/components/auth/SignInButton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function UserProfilePage() {
  const { user, loading, error } = useUser();

  if (loading) {
    return (
      <div className="container px-4 py-8 text-xl text-center">
        Loading your profile...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container px-4 py-8 text-center">
        <p className="text-muted-foreground mb-4">
          Sign in to view your profile
        </p>
        <SignInButton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container px-4 py-8 text-red-500">
        Couldn't load profile. Please try again.
      </div>
    );
  }

  const profile = {
    name: user.full_name,
    email: user.email,
    interests: user.interest_tags,
  };

  return (
    <div className="container px-4 py-8 flex flex-col lg:flex-row gap-12">
      <div className="flex flex-col items-center gap-8 lg:w-1/3">
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20
                       sm:w-24 sm:h-24
                       md:w-28 md:h-28
                       lg:w-32 lg:h-32
                       rounded-full bg-muted"
          />
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold">
              {profile.name ?? "Full Name"}
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              {profile.email ?? "Email"}
            </p>
          </div>
        </div>

        <div className="flex gap-12">
          <Button variant="default">Edit profile</Button>
          <Button variant="secondary">Edit avatar</Button>
        </div>
        <div className="flex items-center justify-between border-t pt-6 mt-6">
          <label className="text-sm font-medium text-gray-700 pr-8">
            Enable email notifications
          </label>
          <Switch />
        </div>
      </div>

      <div className="flex flex-col flex-1 gap-10">
        <div className="space-y-6 w-full max-w-xl mx-auto">
          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-1">Full name</label>
            <input
              type="text"
              defaultValue={profile.name ?? "name"}
              className="bg-gray-100 border border-gray-300 rounded-md p-2 w-full"
              disabled
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-1">Email</label>
            <input
              type="text"
              defaultValue={profile.email ?? "email"}
              className="bg-gray-100 border border-gray-300 rounded-md p-2 w-full"
              disabled
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-1">Password</label>
            <input
              type="text"
              defaultValue={""}
              className="bg-gray-100 border border-gray-300 rounded-md p-2 w-full"
              disabled
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-700 mb-1">Interests</label>
            <p className="">{profile.interests}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
