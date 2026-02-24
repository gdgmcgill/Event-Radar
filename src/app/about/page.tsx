import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search,
  Bookmark,
  Sparkles,
  CalendarCheck,
  Mail,
  ArrowRight,
  Heart,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative w-full pt-20 pb-24 md:pt-28 md:pb-32 overflow-hidden bg-secondary/30">
        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6 leading-[1.1]">
            About <span className="text-primary">Uni-Verse</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
            Uni-Verse is a campus event discovery platform built for McGill
            University. We bring together event listings from clubs and
            organizations across campus into one easy-to-use hub, so you never
            miss what&apos;s happening around you.
          </p>
        </div>

        {/* Decorative background (matches home page) */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-[30%] -left-[10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[100px]" />
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 -mt-12 relative z-20">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight text-center mb-10">
          Key Features
        </h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">
                Discover Events
              </h3>
              <p className="text-sm text-muted-foreground">
                Browse and search events by category, date, or keyword. Filter
                through academic talks, social gatherings, sports, and more.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Bookmark className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">
                Save Favorites
              </h3>
              <p className="text-sm text-muted-foreground">
                Bookmark the events you care about and access them anytime from
                your personal saved events list.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">
                Personalized Recommendations
              </h3>
              <p className="text-sm text-muted-foreground">
                Get event suggestions tailored to your interests based on the
                events you save and engage with.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarCheck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">RSVP to Events</h3>
              <p className="text-sm text-muted-foreground">
                Let organizers know you&apos;re coming. RSVP to events directly
                on the platform and keep track of your plans.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Getting Started Section */}
      <section className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-8 md:p-12 text-center space-y-6">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Get Started
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Sign in with your McGill email (
            <span className="font-medium text-foreground">@mcgill.ca</span> or{" "}
            <span className="font-medium text-foreground">
              @mail.mcgill.ca
            </span>
            ) to unlock saving events, personalized recommendations, RSVPs, and
            more.
          </p>
          <div>
            <Button asChild size="lg" className="gap-2">
              <Link href="/">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Attribution Section */}
      <section className="container mx-auto px-4 pb-16 pt-4 max-w-3xl">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            Built with <Heart className="h-3.5 w-3.5 text-primary" /> by{" "}
            <span className="font-semibold text-foreground">GDG McGill</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Made for students, by students at McGill University.
          </p>
        </div>
      </section>
    </div>
  );
}
