import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Users, Search } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-4xl font-extrabold tracking-tight mb-4">
        About <span className="text-primary">Uni-Verse</span>
      </h1>

      <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
        Uni-Verse is your go-to platform for discovering events happening on the
        McGill University campus. From workshops and hackathons to social
        gatherings and cultural nights, we make it easy to find what&apos;s
        happening around you.
      </p>

      <div className="grid gap-6 sm:grid-cols-3 mb-12">
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <Search className="h-8 w-8 mx-auto text-primary" />
            <h3 className="font-semibold">Discover</h3>
            <p className="text-sm text-muted-foreground">
              Browse and search events by category, date, or keyword.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <Calendar className="h-8 w-8 mx-auto text-primary" />
            <h3 className="font-semibold">Stay Organized</h3>
            <p className="text-sm text-muted-foreground">
              Save events and get reminders so you never miss out.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <Users className="h-8 w-8 mx-auto text-primary" />
            <h3 className="font-semibold">Connect</h3>
            <p className="text-sm text-muted-foreground">
              Find events that match your interests and meet new people.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 text-muted-foreground leading-relaxed">
        <p>
          Built by students, for students. Uni-Verse brings together event
          listings from clubs and organizations across McGill into one
          easy-to-use platform. Sign in with your McGill email to save events,
          get personalized recommendations, and more.
        </p>
        <p>
          Have questions or want your club listed? Reach out to us through your
          club administrator or the McGill student portal.
        </p>
      </div>
    </div>
  );
}
