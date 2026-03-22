import { Github, Linkedin, Globe } from "lucide-react";

interface Contributor {
  name: string;
  role: string;
  avatar?: string;
  github?: string;
  linkedin?: string;
  website?: string;
}

const TEAM: Contributor[] = [
  { name: "Adyan Ullah", role: "VP Projects" },
  { name: "Aaron", role: "AI Team" },
  { name: "Georges", role: "AI Team" },
  { name: "Emma", role: "AI Team" },
  { name: "Daniel", role: "Full-Stack" },
  { name: "Valère", role: "Full Stack" },
  { name: "Julien", role: "Back-End" },
  { name: "Thai", role: "Front-End" },
  { name: "Jerry", role: "Full-Stack" },
  { name: "Yejia", role: "Full-Stack" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ContributorsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <section className="px-6 md:px-10 lg:px-12 pt-16 pb-10 md:pt-24 md:pb-14">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 max-w-12 bg-primary" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              The Team
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground leading-[1.1] mb-6">
            Built by students,
            <br />
            <span className="text-muted-foreground">for students.</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
            UNI-VERSE is a{" "}
            <span className="font-semibold text-foreground">GDG McGill</span>{" "}
            project powered by{" "}
            <span className="font-semibold text-foreground">Apollo Labs</span>.
            Meet the team making campus event discovery better.
          </p>
        </div>
      </section>

      {/* Team Grid */}
      <section className="px-6 md:px-10 lg:px-12 py-10 md:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TEAM.map((member) => (
              <div
                key={member.name}
                className="group relative rounded-2xl border border-black/[0.08] bg-black/[0.03] dark:border-white/[0.08] dark:bg-white/[0.03] backdrop-blur-xl ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.05] p-6 transition-all duration-300 hover:border-primary/20 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-4 mb-4">
                  {/* Avatar */}
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-14 h-14 rounded-full object-cover ring-2 ring-border"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {getInitials(member.name)}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-foreground truncate">
                      {member.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{member.role}</p>
                  </div>
                </div>

                {/* Social links */}
                <div className="flex items-center gap-3 pt-3 border-t border-border/40">
                  {member.github && (
                    <a
                      href={member.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Github className="h-4 w-4" />
                    </a>
                  )}
                  {member.linkedin && (
                    <a
                      href={member.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                  {member.website && (
                    <a
                      href={member.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Globe className="h-4 w-4" />
                    </a>
                  )}
                  {!member.github && !member.linkedin && !member.website && (
                    <span className="text-xs text-muted-foreground/50 italic">
                      Links coming soon
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Join CTA */}
      <section className="px-6 md:px-10 lg:px-12 py-10 md:py-16 pb-20">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            Interested in contributing?{" "}
            <a
              href="https://github.com/gdgmcgill/Event-Radar"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Check out our GitHub
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
