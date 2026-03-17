# Mobile Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the app for mobile users across 5 areas (hero, calendar, clubs dashboard, settings) without changing desktop UI.

**Architecture:** All changes are CSS/responsive-only, gated behind Tailwind breakpoints (`sm`, `md`, `lg`). The calendar gets a separate mobile render path (below `lg`) using the Apple Calendar pattern — compact date grid with dots + event list below. Clubs dashboard gets a fixed bottom tab bar on mobile.

**Tech Stack:** Next.js 16, Tailwind CSS, Lucide React icons, existing Supabase data hooks.

**Spec:** `docs/superpowers/specs/2026-03-16-mobile-optimization-design.md`

---

## Chunk 1: Hero & Profile Settings

### Task 1: Fix Hero Buttons — Stack on Mobile

**Files:**
- Modify: `src/components/ui/HeroSlide.tsx:29-71`

- [ ] **Step 1: Update hero container for mobile**

Change line 30 — reduce min-height on mobile:
```tsx
<div className="relative w-full h-[85vh] min-h-[400px] sm:min-h-[500px] flex-[0_0_100%]">
```

- [ ] **Step 2: Update bottom content padding**

Change line 38 — reduce padding on mobile:
```tsx
<div className="absolute bottom-0 left-0 p-4 sm:p-6 md:p-10 lg:p-12 w-full lg:w-3/4 pb-20 sm:pb-28 md:pb-36">
```

- [ ] **Step 3: Update title sizing**

Change line 43 — smaller base, add `md` step:
```tsx
<h2 className="text-white text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-black leading-[0.9] tracking-tighter mb-6 sm:mb-8 drop-shadow-2xl">
```

- [ ] **Step 4: Update description margin**

Change line 47 — reduce bottom margin on mobile:
```tsx
<p className="text-white/90 text-base sm:text-lg lg:text-2xl font-medium max-w-2xl mb-6 sm:mb-10 leading-relaxed drop-shadow-lg line-clamp-3">
```

- [ ] **Step 5: Stack buttons vertically on mobile**

Change line 51 — flex column on mobile, row on sm+:
```tsx
<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
```

- [ ] **Step 6: Update primary button classes**

Change line 53-57 — full-width on mobile, smaller padding:
```tsx
<button
  onClick={onPrimary}
  className="w-full sm:w-auto px-6 sm:px-8 md:px-10 py-3.5 sm:py-4 md:py-5 bg-primary text-white text-base sm:text-lg md:text-xl font-bold rounded-2xl hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-3 cursor-pointer"
>
```

- [ ] **Step 7: Update secondary button classes**

Change line 59-61 — full-width on mobile, matching sizing:
```tsx
<button
  onClick={onSecondary}
  className="w-full sm:w-auto px-6 sm:px-6 md:px-8 py-3.5 sm:py-4 md:py-5 bg-white/20 dark:bg-white/10 backdrop-blur-xl text-white font-bold border border-white/30 dark:border-white/15 rounded-2xl hover:bg-white/30 dark:hover:bg-white/20 transition-all flex items-center justify-center gap-3 cursor-pointer shadow-lg"
>
```

- [ ] **Step 8: Verify desktop unchanged**

Run: `npm run build`
Expected: Build succeeds. Visually verify at 1024px+ that hero layout is unchanged. At 375px, buttons should stack vertically, title should be smaller.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/HeroSlide.tsx
git commit -m "fix(mobile): stack hero buttons vertically, reduce title size on mobile"
```

---

### Task 2: Profile Settings — Mobile Touch Targets & Layout

**Files:**
- Modify: `src/app/profile/ProfileClient.tsx`

- [ ] **Step 1: Reduce hero height on mobile**

Find the hero container (line ~276):
```tsx
<div className="relative w-full h-[38vh] min-h-[300px]">
```
Change to:
```tsx
<div className="relative w-full h-[30vh] sm:h-[38vh] min-h-[220px] sm:min-h-[300px]">
```

- [ ] **Step 2: Improve settings nav pill touch targets**

Find the settings nav buttons (line ~723-730). Update the button className:
```tsx
<button key={section.id} onClick={() => setSettingsSection(section.id)} className={cn(
  "flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200",
  isActive ? "bg-primary text-white shadow-md shadow-primary/10" : "text-muted-foreground hover:bg-primary/5 hover:text-primary dark:hover:bg-primary/10"
)}>
```
(Changed `py-2.5` to `py-3 min-h-[44px]`)

- [ ] **Step 3: Reduce avatar size in settings on mobile**

Find the avatar in settings profile section (line ~741):
```tsx
<div onClick={avatar.openFilePicker} className="relative w-24 h-24 rounded-2xl overflow-hidden cursor-pointer group ring-2 ring-primary/10">
```
Change to:
```tsx
<div onClick={avatar.openFilePicker} className="relative w-16 h-16 sm:w-24 sm:h-24 rounded-2xl overflow-hidden cursor-pointer group ring-2 ring-primary/10">
```

- [ ] **Step 4: Reduce banner upload height on mobile**

Find the banner upload area (line ~780):
```tsx
className="relative w-full h-36 rounded-xl overflow-hidden cursor-pointer group border border-dashed border-border hover:border-primary/50 transition-colors"
```
Change to:
```tsx
className="relative w-full h-28 sm:h-36 rounded-xl overflow-hidden cursor-pointer group border border-dashed border-border hover:border-primary/50 transition-colors"
```

- [ ] **Step 5: Make save button full-width on mobile with shadow**

Find the `SaveBar` component (~line 971). Update the `<Button>` at line 979:

From:
```tsx
<Button onClick={onSave} disabled={disabled || saving} className="gap-2 min-w-[140px]">
```
To:
```tsx
<Button onClick={onSave} disabled={disabled || saving} className="gap-2 min-w-[140px] w-full sm:w-auto shadow-lg shadow-primary/20">
```

- [ ] **Step 6: Add min-h touch targets to profile view stats grid**

Find the stats grid in the profile view tab (~line 415-427). Update the stat cell className to ensure 44px touch targets:

From:
```tsx
<div key={stat.label} className="group relative flex flex-col items-center justify-center py-4 rounded-xl
```
To:
```tsx
<div key={stat.label} className="group relative flex flex-col items-center justify-center py-4 min-h-[44px] rounded-xl
```

- [ ] **Step 7: Verify desktop unchanged**

Run: `npm run build`
Expected: Build succeeds. At 1024px+, profile page is identical. At 375px, hero is shorter, nav pills have proper touch targets, avatar is smaller in settings.

- [ ] **Step 8: Commit**

```bash
git add src/app/profile/ProfileClient.tsx
git commit -m "fix(mobile): optimize profile settings for mobile touch targets and spacing"
```

---

## Chunk 2: Calendar Mobile Views

### Task 3: Calendar Month View — Apple Native Style on Mobile

**Files:**
- Modify: `src/app/calendar/page.tsx`

This is the largest change. The existing `renderDayCell` function (line ~870-970) renders full event cards inside cells. On mobile, we need a compact view with just numbers and dots.

- [ ] **Step 1: Add a mobile-specific render function for day cells**

Add a new function `renderMobileDayCell` before the existing `renderDayCell` function (~line 870). This renders just the date number + colored dots:

```tsx
const renderMobileDayCell = (date: Date, isCurrentMonth: boolean) => {
  const key = dateKey(date);
  const isToday = key === todayStr;
  const isSelected = key === selectedStr;
  const dayEvents = eventsByDate.get(key) || [];

  // Get unique category dots (max 3)
  const categoryDots = Array.from(
    new Set(dayEvents.flatMap((e) => e.tags?.slice(0, 1) || ["academic"]))
  ).slice(0, 3);

  return (
    <button
      key={key}
      onClick={() => handleDayClick(date)}
      aria-label={
        dayEvents.length > 0
          ? `${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}`
          : date.toLocaleDateString("en-US", { month: "long", day: "numeric" })
      }
      className={cn(
        "flex flex-col items-center justify-center py-2 cursor-pointer transition-colors rounded-lg",
        !isCurrentMonth && "opacity-30",
        isSelected && !isToday && "bg-primary/10",
      )}
    >
      <span
        className={cn(
          "text-[15px] font-medium w-8 h-8 flex items-center justify-center rounded-full",
          isToday && "bg-primary text-primary-foreground font-semibold",
          isSelected && !isToday && "text-primary font-semibold",
          !isCurrentMonth && "text-muted-foreground",
        )}
      >
        {date.getDate()}
      </span>
      {dayEvents.length > 0 && (
        <div className="flex gap-[3px] mt-1" aria-hidden="true">
          {categoryDots.map((tag) => (
            <span
              key={tag}
              className={cn(
                "size-[5px] rounded-full",
                DOT_COLORS[tag] || "bg-primary"
              )}
            />
          ))}
        </div>
      )}
    </button>
  );
};
```

- [ ] **Step 2: Add mobile event list component for selected day**

Add a function `renderMobileEventList` after `renderMobileDayCell`:

```tsx
const renderMobileEventList = () => {
  const dayLabel = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mt-4 border-t border-border pt-4 px-1">
      <h3 className="text-sm font-bold text-foreground mb-3">{dayLabel}</h3>
      {selectedDayEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CalendarOff className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No events on this day</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {selectedDayEvents.map((event) => {
            const strip = getStripColors(event.tags);
            const time = formatTimeFromISO(event.start_date);
            return (
              <button
                key={event.id}
                onClick={() => handleEventClick(event)}
                className="flex items-stretch gap-3 p-3 bg-card rounded-xl border border-border hover:bg-secondary/50 transition-colors cursor-pointer text-left w-full"
              >
                <div
                  className={cn(
                    "w-1 rounded-full shrink-0",
                    strip.bg.replace("/20", "")
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {event.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {time}
                    {event.end_date &&
                      ` – ${formatTimeFromISO(event.end_date)}`}
                  </p>
                  {event.location && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Update month view to use mobile rendering below lg**

Find the month view section (line ~1144-1178). Replace the entire `{calendarView === "Month" && !error && (` block with a version that conditionally renders mobile or desktop:

```tsx
{calendarView === "Month" && !error && (
  <div
    ref={gridRef}
    tabIndex={0}
    onKeyDown={handleGridKeyDown}
    className="px-4 sm:px-6 lg:px-8 pb-8 flex-1 min-h-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl"
  >
    {/* Desktop: existing grid */}
    <div className="hidden lg:block">
      <div className="grid grid-cols-7 gap-[1px] bg-border rounded-xl overflow-hidden border border-border">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(
          (day) => (
            <div
              key={day}
              className="bg-secondary p-3 text-right text-muted-foreground text-xs font-semibold tracking-wider uppercase"
            >
              {day}
            </div>
          )
        )}
        {loading && events.length === 0
          ? Array.from({ length: monthGrid.length }).map((_, i) => (
              <div
                key={`skel-${i}`}
                className="bg-background min-h-[100px] p-2"
              >
                <Skeleton className="h-5 w-5 rounded-full mb-2 ml-auto" />
                <Skeleton className="h-4 w-3/4 rounded ml-auto" />
              </div>
            ))
          : monthGrid.map(({ date, isCurrentMonth }) =>
              renderDayCell(date, isCurrentMonth, false)
            )}
      </div>
    </div>

    {/* Mobile: compact Apple-style grid */}
    <div className="lg:hidden">
      <div className="grid grid-cols-7 text-center mb-2">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
          <div
            key={`${day}-${i}`}
            className="text-[11px] font-semibold text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {loading && events.length === 0
          ? Array.from({ length: monthGrid.length }).map((_, i) => (
              <div key={`mskel-${i}`} className="flex flex-col items-center py-2">
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            ))
          : monthGrid.map(({ date, isCurrentMonth }) =>
              renderMobileDayCell(date, isCurrentMonth)
            )}
      </div>
      {renderMobileEventList()}
    </div>
  </div>
)}
```

- [ ] **Step 4: Update navigation buttons for larger touch targets on mobile**

Find the nav buttons (line ~1083-1108). Update the prev/next button classes (use `lg:` breakpoint to match the calendar mobile/desktop split):
```tsx
className="flex items-center justify-center size-9 lg:size-8 rounded-md bg-secondary hover:bg-secondary/80 border border-border text-foreground transition-colors"
```
And the Today button:
```tsx
className="flex items-center justify-center px-3 h-9 lg:h-8 rounded-md bg-secondary hover:bg-secondary/80 border border-border text-foreground text-sm font-medium transition-colors"
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/calendar/page.tsx
git commit -m "feat(mobile): add Apple-style compact month view for mobile calendar"
```

---

### Task 4: Calendar Week View — Apple Style on Mobile

**Files:**
- Modify: `src/app/calendar/page.tsx`

- [ ] **Step 1: Update week view to use mobile rendering below lg**

Find the week view section (line ~1181-1220). Replace with conditional mobile/desktop rendering:

```tsx
{calendarView === "Week" && !error && (
  <div
    ref={gridRef}
    tabIndex={0}
    onKeyDown={handleGridKeyDown}
    className="px-4 sm:px-6 lg:px-8 pb-8 flex-1 min-h-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl"
  >
    {/* Desktop: existing grid */}
    <div className="hidden lg:block">
      <div className="grid grid-cols-7 gap-[1px] bg-border rounded-xl overflow-hidden border border-border">
        {weekDays.map((d) => {
          const isToday = dateKey(d) === todayStr;
          return (
            <div
              key={dateKey(d)}
              className={cn(
                "bg-secondary p-3 text-center text-xs font-semibold tracking-wider uppercase",
                isToday ? "text-primary" : "text-muted-foreground"
              )}
            >
              {d.toLocaleDateString("en-US", { weekday: "short" })}
            </div>
          );
        })}
        {loading && events.length === 0
          ? weekDays.map((_, i) => (
              <div
                key={`wskel-${i}`}
                className="bg-background min-h-[180px] p-2"
              >
                <Skeleton className="h-5 w-5 rounded-full mb-2 ml-auto" />
                <Skeleton className="h-4 w-full rounded mb-1" />
                <Skeleton className="h-4 w-3/4 rounded" />
              </div>
            ))
          : weekDays.map((d) => renderDayCell(d, true, true))}
      </div>
    </div>

    {/* Mobile: pill-style week strip */}
    <div className="lg:hidden">
      <div className="grid grid-cols-7 gap-1 mb-4">
        {weekDays.map((d) => {
          const key = dateKey(d);
          const isToday = key === todayStr;
          const isSelected = key === selectedStr;
          const dayEvents = eventsByDate.get(key) || [];
          const categoryDots = Array.from(
            new Set(dayEvents.flatMap((e) => e.tags?.slice(0, 1) || ["academic"]))
          ).slice(0, 3);

          return (
            <button
              key={key}
              onClick={() => handleDayClick(d)}
              aria-label={
                dayEvents.length > 0
                  ? `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}`
                  : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
              }
              className={cn(
                "flex flex-col items-center py-2 px-1 rounded-2xl transition-colors cursor-pointer min-w-[44px]",
                isToday && isSelected && "bg-primary text-primary-foreground",
                isToday && !isSelected && "bg-primary/10",
                isSelected && !isToday && "bg-primary text-primary-foreground",
                !isToday && !isSelected && "bg-secondary/50",
              )}
            >
              <span className={cn(
                "text-[11px] font-semibold uppercase",
                (isToday && isSelected) || (isSelected && !isToday) ? "opacity-80" : "text-muted-foreground",
              )}>
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
              <span className={cn(
                "text-lg font-bold mt-0.5",
                !isToday && !isSelected && "text-foreground",
              )}>
                {d.getDate()}
              </span>
              {dayEvents.length > 0 && (
                <div className="flex gap-[3px] mt-1" aria-hidden="true">
                  {categoryDots.map((tag) => (
                    <span
                      key={tag}
                      className={cn(
                        "size-[5px] rounded-full",
                        (isSelected || isToday) && (isSelected) ? "bg-primary-foreground" : (DOT_COLORS[tag] || "bg-primary")
                      )}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {renderMobileEventList()}
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds. At 375px, week view shows pill-style day cells with event list below. At 1024px+, existing week grid is unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/app/calendar/page.tsx
git commit -m "feat(mobile): add Apple-style compact week view for mobile calendar"
```

---

## Chunk 3: Clubs Dashboard Bottom Tab Bar

### Task 5: Clubs Dashboard — Mobile Bottom Tab Bar

**Files:**
- Modify: `src/components/clubs/ClubDashboard.tsx:125-310`

- [ ] **Step 1: Replace mobile horizontal nav with bottom tab bar**

Find the mobile navigation section (line ~192-211). Replace it entirely:

```tsx
{/* Mobile Bottom Tab Bar */}
<nav
  className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border flex justify-around items-start pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
  role="tablist"
>
  {visibleNavItems.map((item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        role="tab"
        aria-selected={isActive}
        className={cn(
          "flex flex-col items-center gap-1 min-w-[64px] py-1 transition-colors cursor-pointer",
          isActive ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Icon className="h-[22px] w-[22px]" />
        <span className="text-[10px] font-semibold">{item.label}</span>
      </button>
    );
  })}
</nav>
```

- [ ] **Step 2: Add bottom padding to main content on mobile**

Find the content area div (line ~283):
```tsx
<div className="p-4 md:p-8">
```
Change to:
```tsx
<div className="p-4 md:p-8 pb-24 md:pb-8">
```

- [ ] **Step 3: Verify stats grid (no change needed)**

The stats grid in `ClubOverviewTab.tsx` line 161 already uses `grid-cols-2 md:grid-cols-4` — mobile already shows 2 columns. No change needed here. Skip this step.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds. At 375px, bottom tab bar appears fixed at bottom. At 768px+, desktop sidebar is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/clubs/ClubDashboard.tsx src/components/clubs/ClubOverviewTab.tsx
git commit -m "feat(mobile): add bottom tab bar for clubs dashboard on mobile"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No new errors introduced.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean production build.

- [ ] **Step 3: Run tests**

Run: `npx jest --passWithNoTests`
Expected: All existing tests pass.

- [ ] **Step 4: Visual verification checklist**

At 375px viewport:
- [ ] Hero buttons stack vertically, text is readable
- [ ] Calendar month view shows compact number grid with dots
- [ ] Calendar week view shows pill-style day strip
- [ ] Tapping a calendar day shows event list below
- [ ] Empty day shows "No events on this day" message
- [ ] Clubs dashboard has bottom tab bar
- [ ] Profile hero is shorter, settings pills have proper touch targets

At 1024px+ viewport:
- [ ] Hero is identical to before
- [ ] Calendar shows full grid with event text in cells
- [ ] Clubs dashboard has sidebar navigation
- [ ] Profile page is unchanged

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add src/components/ui/HeroSlide.tsx src/app/calendar/page.tsx src/components/clubs/ClubDashboard.tsx src/app/profile/ProfileClient.tsx
git commit -m "chore: mobile optimization cleanup and verification"
```
