# Uni-Verse Platform Strategy

**Date:** 2026-02-22
**Status:** Internal North Star
**Audience:** Founding team & cofounders

---

## 1. The Thesis

Campus event discovery is broken in a way that no existing platform has fixed.

**The fragmentation problem:** Right now, a McGill student who wants to know what's happening on campus tonight has to check Instagram stories from 10+ club accounts (where the algorithm buries 85% of posts), scroll through a declining Facebook events page, skim three email newsletters, and maybe spot a poster in the hallway. The information exists — it's just scattered across channels that weren't built for discovery.

**Why general platforms don't work:** Eventbrite is too heavy — it's built for ticketed, commercial events. A free pizza night in Leacock 132 doesn't belong on Eventbrite, and no club exec is going to set up a payment flow for a study session. Luma is closer, but it's a registration utility, not a discovery network. It solves "how do I manage RSVPs" but not "what should I go to tonight?" Neither platform understands the campus context — that a first-year engineering student interested in AI probably wants to know about both the CS Games info session AND the hackathon next week, even though those are run by different clubs who don't cross-promote.

**Why now:** Instagram's algorithmic feed has gotten worse for small accounts. Clubs report that their posts reach less than 15% of their own followers. Meanwhile, Gen Z is migrating away from Facebook entirely — the legacy platform where campus events used to live. There's a vacuum, and the first product that fills it at McGill captures a generation of students who will expect this tool at every university they attend or work at.

**The core insight:** Campus clubs are not event companies. They're volunteer-run organizations where the "marketing department" is one exhausted VP Events who posts an Instagram story at 11 PM. Any platform that asks them to do more work than Instagram will fail. The winning product makes their existing work more effective, not harder.

---

## 2. The Market

### McGill by the numbers

| Metric | Number |
|--------|--------|
| Total undergraduate + graduate students | ~40,000 |
| Active student clubs and organizations | 250+ |
| Events per semester (estimate) | 1,500–2,000 |
| SSMU-funded clubs | ~200 |
| Students who attend 1+ club event per semester | ~60% (24,000) |
| Students who actively seek out events weekly | ~25% (10,000) |

### The wedge

We're not trying to capture all 40K on day one. The wedge is the 10,000 students who actively look for events each week — they're already doing the work of checking Instagram and email. We just need to be faster and better than their current workflow.

**Phase targets:**

| Phase | Timeline | Students | Clubs |
|-------|----------|----------|-------|
| Beta | Feb–Mar 2026 | 100–500 | 10–20 anchor clubs |
| Launch | Sep 2026 (orientation) | 2,000–5,000 | 50–80 clubs |
| Growth | Jan 2027 | 10,000+ | 150+ clubs |
| Dominance | Sep 2027 | 25,000+ | 200+ clubs |

### Why McGill first

- Dense campus with a single student society (SSMU) that touches all clubs — one partnership unlocks distribution
- Bilingual (EN/FR) forces us to build a product that handles language diversity from day one — competitive advantage when expanding to UdeM, Concordia, UOttawa
- McGill students are early adopters and vocal on social media — organic word-of-mouth potential is high
- Small enough to saturate (40K), large enough to prove the model

### Expansion path

McGill -> Montreal universities (Concordia, UdeM, ETS) -> Canadian universities -> US college campuses. Each new university is a separate instance of the same playbook — the technology, the flywheel, and the go-to-market repeat. This is the Nextdoor model applied to campuses.

---

## 3. The Cold Start Problem

Every marketplace has a chicken-and-egg problem. Ours is:

- **Students won't come** if there are no events to discover
- **Clubs won't post** if there are no students to reach

This is the exact problem that killed every previous campus event app. They either launched empty (no events, no reason to open the app) or asked clubs to do work upfront with no proof of audience (no adoption).

### Our solution: Bootstrap with scraping, then graduate

**The key insight:** We don't need clubs to cooperate at launch. Their events are already public — on Instagram, Facebook, and posters. We scrape first, prove value second, then give clubs a reason to post directly.

```
PHASE 1: SCRAPE          PHASE 2: PROVE          PHASE 3: TRANSITION
──────────────           ──────────────           ───────────────────
Instagram posts ──→      "45 students saved       Clubs claim profiles
  ↓                       your event on            and post directly
Classifier ──→            Uni-Verse"                ↓
  ↓                        ↓                      Scraping reduced
Pending queue ──→        Clubs see the value        ↓
  ↓                        ↓                      Scraping eliminated
Admin approves ──→       "Claim your profile         ↓
  ↓                       for analytics"           Self-sustaining
Students discover                                  platform
```

**Phase 1 — Scrape (Weeks 1–4):**
We already built the classifier (`src/lib/classifier.ts` — 7-signal heuristic, 31 tests passing) and the pipeline architecture. Apify scrapes 20–30 club Instagram accounts daily. Posts run through the classifier to extract structured event data (title, date, time, location, tags). Events land in the admin pending queue for human review. Students see approved events immediately.

Cost: ~$49/mo Apify + admin review time. Acceptable for bootstrapping.

**Phase 2 — Prove (Weeks 4–8):**
After a few weeks of scraping, we approach club execs with their own data: "We've been indexing your events. 45 McGill students saved your last event on Uni-Verse. 12 set reminders. Want to see who they are? Claim your profile."

This is the crux of the entire strategy — the data we collect while scraping becomes the sales pitch for organic adoption.

**Phase 3 — Transition (Months 3–6):**
Clubs that claim their profiles get access to analytics, direct posting (auto-approved, no admin queue), and post-event feedback. We track the `source` field on every event (`'manual'` vs `'instagram'`). When a club consistently posts directly, we remove them from the scraper. When 80%+ of active clubs are posting directly, we shut down scraping entirely.

---

## 4. The Flywheel

The flywheel is what turns Uni-Verse from a scraping tool into a self-sustaining platform. Every element reinforces the others:

```
                    MORE STUDENTS
                         │
                         ▼
              ┌─────────────────────┐
              │  Better recommendations  │
              │  (more data = better ML) │
              └──────────┬──────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                              ▼
   MORE SAVES &                    HIGHER TURNOUT
   INTERACTIONS                    AT EVENTS
          │                              │
          ▼                              ▼
   ┌─────────────┐              ┌──────────────┐
   │  Richer user │              │  Clubs see    │
   │  profiles    │              │  ROI — more   │
   │  (interest   │              │  people came  │
   │   vectors)   │              │  because of   │
   └──────┬──────┘              │  Uni-Verse    │
          │                      └──────┬───────┘
          ▼                              ▼
   Better matching ◄──────────── MORE CLUBS POST
   between students                DIRECTLY
   and events                         │
          │                            ▼
          └──────────► MORE EVENTS ON PLATFORM
```

### The five stages of the flywheel

**Stage 1 — Supply-side bootstrapping (scraping)**
We fill the platform with events from Instagram. Students have a reason to open the app. The recommendation engine starts learning from their interest tags and saves.

**Stage 2 — Demand-side proof (data as sales pitch)**
Every student save, RSVP, and reminder is a data point we can show to clubs. "Your event reached X students who actually wanted to see it, not the 15% Instagram showed it to."

**Stage 3 — Supply-side conversion (clubs switch to direct posting)**
Clubs claim profiles, post directly, get auto-approval. Their events reach more students because the recommendation engine puts events in front of users who explicitly asked for that type of content. This is targeted distribution that Instagram cannot offer.

**Stage 4 — Feedback loop activation (post-event analytics)**
After events end, we send surveys to attendees. Clubs get feedback they've never had before: "How did you hear about this event? Would you come again? What would you change?" This data is gold for club execs planning next semester.

**Stage 5 — Source-of-truth flip (Uni-Verse first, Instagram second)**
Instead of clubs posting on Instagram and us scraping, clubs post on Uni-Verse first and we auto-generate Instagram-ready graphics from their event data. Uni-Verse becomes the canonical source. Instagram becomes the distribution channel, not the origin.

---

## 5. Why Clubs Will Switch

Club execs are overworked volunteers. They won't switch platforms out of goodwill — they need concrete value that Instagram can't provide. Here's what we offer:

### 5.1 Targeted distribution (the recommendation engine)

Instagram shows a club's post to ~15% of followers, selected by an opaque algorithm optimized for engagement, not relevance. Uni-Verse puts a "Cultural + Food" tagged event directly in front of every student who selected "Cultural" and "Food" as interests.

Our recommendation engine (`src/app/api/recommendations/route.ts`) uses a hybrid scoring formula:
```
totalScore = 0.45 * contentScore + 0.40 * collaborativeScore + 0.15 * popularityScore
```

This means a niche club with 50 followers on Instagram but highly relevant events can reach hundreds of students who actually want to attend. For small clubs, Uni-Verse is a better marketing channel than Instagram from day one.

### 5.2 Reminder-driven turnout

Our user research found that 53% of students mentally note events but forget to attend. Instagram has no reminder mechanism for event posts — you see it in your feed, you think "that's cool," and then it's gone.

Uni-Verse sends automatic email reminders 24 hours and 1 hour before any saved event. This directly converts "interested" into "attended." For clubs, this means higher turnout from the same number of impressions — a metric they care deeply about.

The reminder infrastructure already exists (`src/app/api/cron/send-reminders/route.ts`).

### 5.3 Post-event feedback (the killer feature)

This is the feature no competitor offers and the one that will lock clubs in.

After an event ends, we automatically email attendees a short survey: "How was [Event Name]? Rate 1–5. Would you attend again? Any feedback for the organizers?" Results go to the club dashboard.

Club execs currently have zero feedback mechanism. They run an event, 40 people show up (or don't), and they have no idea why. Did people enjoy it? Was the venue too small? Should they do it again? Right now, they guess. With Uni-Verse, they know.

**What needs building:** Post-event survey table, automated email trigger after event end time, club analytics dashboard. This is the highest-priority gap (see Section 9).

### 5.4 The "post once, distribute everywhere" flip

The ultimate value prop: clubs post on Uni-Verse, and we auto-generate an Instagram-ready 1080x1080 graphic with their event details, formatted with their club branding. They download the image and post it to Instagram in seconds.

This flips the workflow from "Instagram is primary, Uni-Verse is secondary" to "Uni-Verse is the source of truth, Instagram is a distribution channel." When clubs start creating events on Uni-Verse first, we've won.

Our PRD already plans "shareable event cards for Instagram stories" and "I'm going to [event] story templates" for the Growth phase. This is the foundation for the flip.

### 5.5 The 2-minute rule

The PRD's core assumption: clubs will only submit events if it takes less than 2 minutes. Our current `/create-event` form is heavier than Instagram (title, description, date, time, location, tags, contact email, optional image).

**The fix:** Let clubs upload their poster + write a caption. Then reuse the classifier we already built for the scraping pipeline to auto-extract date, time, location, and tags from the caption. Same AI, different input source. Posting on Uni-Verse becomes as easy as posting on Instagram.

---

## 6. Go-to-Market Playbook

### 6.1 The SSMU partnership (soft, not mandated)

SSMU (Student Society of McGill University) oversees ~200 funded clubs. A hard mandate ("all funded clubs must post on Uni-Verse") creates resentment. Instead, we pursue soft integration:

- **SSMU newsletter integration:** SSMU pulls its weekly event highlights directly from Uni-Verse. Clubs that post on Uni-Verse get free promotion in the newsletter. Clubs that don't, don't.
- **Funding application perk:** "Events posted on Uni-Verse with post-event analytics are considered more favorably in SSMU funding reviews." Not a requirement — a nudge.
- **Co-branding:** Uni-Verse sponsors SSMU orientation week events. Logo on posters, info booth at activities night. Every first-year downloads the app in their first week.

### 6.2 The anchor club strategy

We don't need 250 clubs. We need 10 that matter.

**Target list for beta (10 anchor clubs):**
- SSMU (student government — the kingmaker)
- EUS (Engineering Undergraduate Society)
- AUS (Arts Undergraduate Society)
- SUS (Science Undergraduate Society)
- McGill Outdoors Club (largest social club)
- CSUS (Computer Science Undergraduate Society)
- McGill Investment Club
- McGill Debate Society
- McGill Cultural clubs (2–3 representing diversity)

These 10 clubs collectively run 30–40% of campus events. If they're on Uni-Verse, students have a reason to check the app.

**Approach:** Personal outreach to VP Events of each club. Not an email — a coffee meeting. Show them the prototype, show them the recommendation engine, show them the analytics dashboard mockup. Ask them to be founding partners. Give them "early access" status and a "Featured Club" badge on the platform.

### 6.3 The shadow profile → claim workflow

During the scraping phase:
1. We auto-create "shadow" profiles in the `clubs` table using scraped `instagram_handle` and `logo_url`
2. Events are linked to these shadow profiles via `club_id`
3. When we approach a club, we show them their shadow profile: "You already have 12 events and 89 student saves on Uni-Verse. Claim your profile to unlock analytics."
4. Claiming requires a McGill email from the club exec, verified against the `organizer_requests` flow (already designed in the user roles doc)
5. Once claimed, the club gets `club_organizer` role, auto-approved events, and the analytics dashboard

The database schema already supports this — `clubs` table, `club_members` table, `organizer_requests` table, and the `source` field on events.

### 6.4 Orientation week blitz (September 2026)

Orientation week is our Super Bowl. 8,000+ first-years arrive, overwhelmed with options, desperate to find their community. Our playbook:

- **Activities Night booth:** Demo the app, QR code for instant signup. "Find events made for YOU" messaging.
- **Pre-loaded with orientation events:** Scrape or manually add all orientation week events before students arrive. Day one, the app is full.
- **"What's happening right now" feature:** Real-time feed of events happening in the next 2 hours. This is the killer use case during orientation week when there are 20+ events per day.
- **SSMU co-promotion:** If the partnership lands, SSMU promotes Uni-Verse in all orientation materials.

Target: 2,000 signups in orientation week alone.

### 6.5 Campus ambassador program

5–10 student ambassadors across faculties. Not paid — incentivized with "Founding Member" status, direct input on product roadmap, and resume value ("grew campus platform to X users"). Their job: get their faculty's clubs on Uni-Verse and promote at faculty events.

---

## 7. The Moat

If this works, what stops someone from cloning it?

### 7.1 Data gravity

Every student interaction — interest tags selected, events saved, reminders set, surveys answered — enriches the recommendation engine. Our hybrid scoring model (content + collaborative + popularity) gets better with each user. A competitor launching at McGill starts with zero interaction data. We have months or years of behavioral data powering personalized recommendations they can't replicate without building the same user base from scratch.

The recommendation engine is the moat. Not the code (it's ~200 lines of TypeScript) — the data feeding it.

### 7.2 Club relationship lock-in

Once a club claims their profile, sets up their dashboard, and starts receiving post-event analytics, switching to a competitor means losing their historical data, their follower base on Uni-Verse, and the feedback loop they've built with attendees.

The organizer request flow, club member management, and analytics dashboard (planned) create switching costs that grow over time.

### 7.3 Network effects

Each new student makes the platform more valuable for clubs (larger audience). Each new club makes it more valuable for students (more events to discover). This is a classic two-sided network effect that compounds.

At critical mass (~50% of active clubs, ~25% of students), Uni-Verse becomes the default. "Did you check Uni-Verse?" becomes the campus equivalent of "Did you check Google Maps?"

### 7.4 McGill-specific UX

Azure AD authentication via McGill's tenant. Campus building names in the location autocomplete. McGill branding colors. Interest tags mapped to McGill faculty categories. These aren't features a generic platform can replicate without dedicating engineering resources to one university — which they won't do.

### 7.5 First-mover advantage

The PRD correctly identifies this: "Lock in exclusive club partnerships" before a competitor can. In a market of 250 clubs, the first platform to onboard the top 50 wins. Clubs won't maintain profiles on two competing platforms. The second entrant faces a supply-side disadvantage from day one.

---

## 8. What We've Built (Architecture Mapped to Strategy)

### Ready for launch

| Component | File(s) | Strategic role |
|-----------|---------|---------------|
| Hybrid recommendation engine | `src/app/api/recommendations/route.ts` | Core flywheel — targeted distribution |
| Event classifier (7-signal heuristic) | `src/lib/classifier.ts`, `classifier-pipeline.ts` | Scraping pipeline + future "post & auto-extract" UX |
| 31 classifier unit tests | `src/lib/classifier.test.ts` | Confidence in classifier accuracy |
| Event browsing, filtering, search | `src/app/page.tsx`, components | Student-facing core experience |
| Save events + RSVP | `saved_events`, `rsvps` tables | Engagement signals for recommendations + club analytics |
| Admin dashboard (events, clubs) | `src/app/admin/` | Content moderation during scraping phase |
| User onboarding with interest tags | `src/app/onboarding/` | Cold-start solution for recommendations |
| McGill authentication (Azure AD) | Supabase Auth config | Campus-specific lock-in |
| Email reminder cron | `src/app/api/cron/send-reminders/` | Turnout-driving feature |
| Source tracking on events | `source` column, migration 008 | Transition metrics |
| User roles system (designed) | `docs/plans/2026-02-22-user-roles-design.md` | Club organizer permissions, claim workflow |

### Architecture decisions already made

- **One recommendation engine** (TypeScript hybrid), not three. Python two-tower and Flask cosine archived.
- **Regex classifier** over LLM — zero external dependencies, fast, testable, sufficient for 40–100 posts/week.
- **Submission-first MVP** with scraping in Phase 2 — ships faster, validates club adoption.
- **Luma-style unified app** — no separate admin portal. Contextual nav based on user roles.

---

## 9. The Gaps (Ordered by Strategic Priority)

### P0 — Must build before the flywheel works

**1. Club self-service portal & analytics dashboard**
Clubs need to see their event reach, save counts, and audience demographics. Without this, we have no "prove value" pitch. This is the single most important gap.

What to show clubs:
- Total saves and RSVPs per event
- Audience breakdown by interest tags ("70% of people who saved your event are interested in 'Academic' and 'Career'")
- Trend over time (saves per event, month over month)
- Comparison to platform average ("Your events get 2.3x more saves than average")

**2. Club claim/verification workflow**
The `organizer_requests` table and `club_members` system are designed but not implemented. This is the mechanism that converts shadow profiles into active club accounts. Without it, clubs can't self-serve.

**3. Streamlined event creation (2-minute rule)**
Reuse the classifier to auto-extract event details from a caption + poster upload. This is the UX that makes posting on Uni-Verse as easy as Instagram.

### P1 — Builds the lock-in

**4. Post-event survey system**
New database table for event reviews/ratings. Automated email sent to attendees after event end time. Results displayed in club dashboard. This is the killer feature that no competitor has.

Schema needed:
```
event_reviews: id, event_id, user_id, rating (1-5), feedback (text), created_at
```

Trigger: Cron job checks for events that ended in the last 24 hours, sends survey email to all users who saved or RSVP'd.

**5. Instagram graphic generator**
HTML-to-canvas utility that formats event data (title, date, location, club logo) into a downloadable 1080x1080 image. This is what flips Uni-Verse from destination to source-of-truth.

### P2 — Accelerates growth

**6. "What's happening now" real-time feed**
Events happening in the next 2 hours, sorted by proximity and relevance. Killer feature for orientation week and daily campus life.

**7. Push notifications**
Email reminders are v1. Push notifications (via PWA or native app) are v2. Higher engagement, lower friction than email.

**8. Shareable event cards for Instagram stories**
"I'm going to [Event Name]" story templates. Viral growth mechanism — each share is a free impression to the sharer's followers.

---

## 10. Metrics That Matter

### The transition dashboard

These metrics tell us whether the flywheel is spinning:

| Metric | MVP target | Launch target | Growth target |
|--------|-----------|--------------|--------------|
| Weekly active students | 100 | 2,000 | 10,000 |
| Events per week (total) | 10 | 50 | 200 |
| Events per week (manual / direct) | 2 | 30 | 180 |
| Events per week (scraped) | 8 | 20 | 20 → 0 |
| Manual-to-scraped ratio | 20% | 60% | 90%+ |
| Clubs posting directly | 2 | 30 | 100+ |
| Clubs onboarded (claimed profiles) | 5 | 50 | 150+ |
| Avg saves per event | 5 | 15 | 30 |
| Reminder → attendance conversion | — | 40% | 50% |
| Post-event survey response rate | — | 20% | 30% |

### The "stop scraping" threshold

We can stop scraping a specific club when:
- They have claimed their profile (`club_members` row exists)
- They have posted 3+ events directly in the last 30 days (`source = 'manual'` AND `club_id` match)
- Their last scraped event is older than their last manual event

We can shut down the scraper entirely when:
- 80%+ of events in the last 30 days have `source = 'manual'`
- 90%+ of active clubs (posted in last 60 days) have claimed profiles
- Total manual events per week > 50

### User activation funnel

```
Sign up (McGill email) ──→ Complete onboarding (pick 3+ tags) ──→ Save first event
        100%                          70% target                      40% target
                                                                         │
View recommendations ──→ Set first reminder ──→ Attend event ──→ Answer survey
     60% target              30% target           20% target       15% target
```

### Club adoption funnel

```
Shadow profile created (scraped) ──→ Club exec contacted ──→ Profile claimed
              100%                         50%                    30%
                                                                    │
First direct event posted ──→ 3+ events posted ──→ Scraping removed for this club
           25%                      20%                    20%
```

---

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Instagram blocks scraping / ToS action** | Medium | High | Scraping is a bridge, not a dependency. Club self-submission is the primary long-term source. If blocked early, accelerate direct outreach to anchor clubs. |
| **Admin approval bottleneck (orientation week)** | High | Medium | Auto-approve events from verified club organizers. Sort pending queue by classifier confidence score. Recruit 3–5 admin reviewers before orientation. |
| **Clubs don't claim profiles** | Medium | High | This is existential. Mitigate with: in-person outreach (not email), show real data, make claiming instant (one-click with McGill email). If first 10 clubs don't convert, reassess value prop. |
| **Students don't return after signup** | Medium | High | Recommendations must surface genuinely useful events. Email reminders bring users back. Push notifications in v2. If D7 retention < 20%, the recommendation engine needs tuning. |
| **Exam dead periods (Dec, Apr)** | High | Low | Events drop to near-zero. Platform looks dead. Mitigate with: exam-related events (study groups, library hours), "what happened this semester" recap, pre-load next semester preview. |
| **Competing platform launches** | Low | High | First-mover + exclusive club partnerships are the defense. Build network effects fast — once 50+ clubs are active, a competitor can't catch up on the supply side. |
| **Apify cost escalation** | Low | Medium | Start with 20 accounts ($49/mo). Scraping is temporary — costs drop to zero as clubs transition to direct posting. |
| **Team bandwidth (student volunteers)** | High | Medium | Keep architecture simple (one language, one deployment). Avoid over-engineering. The devil's advocate review correctly called out complexity — stay lean. |
| **Recommendation engine cold start** | Medium | Low | Already solved: hybrid scoring with content-based fallback. Users with interest tags but zero saves still get recommendations. |

---

## Appendix: The Competitive Landscape

| Platform | What it does | Why it fails for campus |
|----------|-------------|----------------------|
| **Instagram** | Club posts reach ~15% of followers. No discovery. No reminders. No analytics. | Not a discovery tool. Algorithm optimized for engagement, not event relevance. |
| **Facebook Events** | Declining Gen Z usage. McGill clubs barely maintain Facebook pages. | Platform is dying for this demographic. |
| **Eventbrite** | Ticketing and registration for commercial events. | Too heavy. Free campus events don't need checkout flows. |
| **Luma** | Clean RSVP and registration for curated events. | Registration utility, not discovery. No recommendations, no campus context. |
| **University websites** | Static event calendars maintained by admin staff. | Outdated within hours. No personalization. Ugly UX. |
| **Email newsletters** | SSMU and faculty weekly digests. | Information overload. No filtering. No personalization. |
| **GroupMe / Discord** | Club-specific group chats with event announcements. | Siloed. You only see events from groups you've already joined. Discovery of new clubs is impossible. |
| **Uni-Verse** | Aggregated, personalized, reminder-driven campus event discovery with club analytics. | We're building the thing that should exist. |
