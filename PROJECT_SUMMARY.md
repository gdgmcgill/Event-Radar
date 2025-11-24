# Uni-Verse Project Summary

## 📋 Project Overview

**Uni-Verse** is a campus event discovery platform for McGill University built with Next.js 14, TypeScript, Tailwind CSS, and Supabase. The codebase is structured as a foundation with placeholder components and clear TODO comments for implementation.

---

## 🗂️ Complete File Structure

```
Event-Radar/
├── Configuration Files
│   ├── package.json                    # Dependencies & scripts
│   ├── tsconfig.json                   # TypeScript config (strict mode)
│   ├── tailwind.config.ts              # Tailwind + McGill colors
│   ├── next.config.js                  # Next.js configuration
│   ├── postcss.config.js               # PostCSS config
│   ├── components.json                 # shadcn/ui configuration
│   ├── .env.example                    # Environment variables template
│   ├── .gitignore                      # Git ignore rules
│   ├── .eslintrc.json                  # ESLint configuration
│   └── .prettierrc                     # Prettier configuration
│
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── layout.tsx                  # Root layout with Header/Footer
│   │   ├── page.tsx                    # Home page (event browsing)
│   │   ├── loading.tsx                 # Global loading component
│   │   ├── not-found.tsx               # 404 page
│   │   ├── globals.css                 # Global styles + Tailwind
│   │   │
│   │   ├── events/
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Event detail page
│   │   │
│   │   ├── my-events/
│   │   │   └── page.tsx                # Saved events page
│   │   │
│   │   ├── admin/
│   │   │   ├── layout.tsx              # Admin layout (protected)
│   │   │   ├── page.tsx                # Admin dashboard
│   │   │   └── pending/
│   │   │       └── page.tsx            # Pending events queue
│   │   │
│   │   ├── api/                        # API Routes
│   │   │   ├── events/
│   │   │   │   ├── route.ts            # GET /api/events
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts        # GET /api/events/:id
│   │   │   │       └── save/
│   │   │   │           └── route.ts    # POST /api/events/:id/save
│   │   │   ├── recommendations/
│   │   │   │   └── route.ts             # GET /api/recommendations
│   │   │   └── admin/
│   │   │       └── events/
│   │   │           └── route.ts        # POST /api/admin/events
│   │   │
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts             # OAuth callback handler
│   │
│   ├── components/
│   │   ├── ui/                         # shadcn/ui components
│   │   │   ├── button.tsx              # Button component
│   │   │   ├── card.tsx                # Card components
│   │   │   ├── input.tsx               # Input component
│   │   │   ├── select.tsx              # Select component
│   │   │   ├── badge.tsx               # Badge component
│   │   │   └── skeleton.tsx            # Loading skeleton
│   │   │
│   │   ├── layout/
│   │   │   ├── Header.tsx              # Main navigation header
│   │   │   └── Footer.tsx              # Footer component
│   │   │
│   │   ├── events/
│   │   │   ├── EventCard.tsx           # Event card component
│   │   │   ├── EventGrid.tsx           # Grid layout for events
│   │   │   ├── EventFilters.tsx        # Filter bar component
│   │   │   ├── EventSearch.tsx         # Search component
│   │   │   └── EventCardSkeleton.tsx   # Loading skeleton
│   │   │
│   │   └── auth/
│   │       └── SignInButton.tsx        # McGill OAuth button
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # Browser Supabase client
│   │   │   ├── server.ts               # Server Supabase client
│   │   │   └── types.ts                # Database types (placeholder)
│   │   ├── utils.ts                    # Utility functions
│   │   └── constants.ts                # App constants
│   │
│   ├── types/
│   │   └── index.ts                    # TypeScript interfaces
│   │
│   └── hooks/
│       ├── useEvents.ts                # Event fetching hook
│       └── useUser.ts                 # User session hook
│
└── public/
    └── placeholder-event.png           # Fallback event image
```

---

## 📄 Pages & Routes

### Public Pages

#### 1. **Home Page** (`/`)
- **File**: `src/app/page.tsx`
- **Type**: Client Component
- **Features**:
  - Event browsing with grid layout
  - Search functionality
  - Filter by tags/categories
  - Calendar view toggle (TODO)
- **Components Used**:
  - `EventSearch`
  - `EventFilters`
  - `EventGrid`
- **TODO**: Implement event fetching, state management, calendar view

#### 2. **Event Detail Page** (`/events/[id]`)
- **File**: `src/app/events/[id]/page.tsx`
- **Type**: Server Component
- **Features**:
  - Display full event details
  - Event image, description, date/time, location
  - Club information
  - Save button
  - Related events (TODO)
- **TODO**: Implement event fetching by ID, save functionality, related events

#### 3. **My Events Page** (`/my-events`)
- **File**: `src/app/my-events/page.tsx`
- **Type**: Client Component
- **Features**:
  - Display user's saved events
  - Sign-in prompt for guests
  - Filter and sort saved events (TODO)
- **TODO**: Implement saved events fetching, filtering, removal

### Admin Pages

#### 4. **Admin Dashboard** (`/admin`)
- **File**: `src/app/admin/page.tsx`
- **Type**: Server Component
- **Features**:
  - Statistics cards (total events, pending, approved, users)
  - Recent events table (TODO)
  - Quick actions (TODO)
- **TODO**: Implement statistics fetching, recent events, quick actions

#### 5. **Pending Events Queue** (`/admin/pending`)
- **File**: `src/app/admin/pending/page.tsx`
- **Type**: Client Component
- **Features**:
  - List of pending events awaiting approval
  - Approve/Reject buttons
  - View event details
- **TODO**: Implement pending events fetching, approve/reject logic

#### 6. **Admin Layout** (`/admin/*`)
- **File**: `src/app/admin/layout.tsx`
- **Type**: Server Component
- **Features**:
  - Protected layout for admin pages
  - Admin navigation menu
  - Admin authentication check (TODO)
- **TODO**: Implement admin role verification

### Utility Pages

#### 7. **404 Not Found** (`/not-found`)
- **File**: `src/app/not-found.tsx`
- **Type**: Server Component
- **Features**: Custom 404 page with home link

#### 8. **Loading State** (`/loading`)
- **File**: `src/app/loading.tsx`
- **Type**: Server Component
- **Features**: Global loading skeleton

---

## 🔌 API Routes

### Events API

#### 1. **GET /api/events**
- **File**: `src/app/api/events/route.ts`
- **Purpose**: Fetch events with optional filters
- **Query Parameters** (TODO):
  - `tags`: Comma-separated list of tags
  - `search`: Search query
  - `dateFrom`: Start date filter
  - `dateTo`: End date filter
  - `clubId`: Filter by club
  - `page`: Pagination page number
  - `limit`: Items per page
- **TODO**: Implement Supabase query with filters, pagination, sorting

#### 2. **GET /api/events/[id]**
- **File**: `src/app/api/events/[id]/route.ts`
- **Purpose**: Fetch a single event by ID
- **TODO**: Implement event fetching with relations (club, etc.)

#### 3. **POST /api/events/[id]/save**
- **File**: `src/app/api/events/[id]/save/route.ts`
- **Purpose**: Save or unsave an event for the current user
- **Authentication**: Required
- **TODO**: Implement save/unsave logic, check existing saves

### Recommendations API

#### 4. **GET /api/recommendations**
- **File**: `src/app/api/recommendations/route.ts`
- **Purpose**: Get personalized event recommendations
- **Authentication**: Required
- **TODO**: Implement recommendation algorithm based on:
  - User interest tags
  - Past saved events
  - Date proximity
  - Tag matches

### Admin API

#### 5. **POST /api/admin/events**
- **File**: `src/app/api/admin/events/route.ts`
- **Purpose**: Create or update events (admin only)
- **Authentication**: Required (admin role)
- **Methods**: POST (create), PUT (update), DELETE (delete)
- **TODO**: Implement admin validation, event creation/update/deletion

### Auth API

#### 6. **GET /auth/callback**
- **File**: `src/app/auth/callback/route.ts`
- **Purpose**: Handle OAuth callback
- **TODO**: Implement OAuth callback processing, email validation, user profile creation

---

## 🧩 Components

### UI Components (shadcn/ui)

1. **Button** (`src/components/ui/button.tsx`)
   - Variants: default, destructive, outline, secondary, ghost, link
   - Sizes: default, sm, lg, icon
   - Fully implemented

2. **Card** (`src/components/ui/card.tsx`)
   - Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
   - Fully implemented

3. **Input** (`src/components/ui/input.tsx`)
   - Text input component
   - Fully implemented

4. **Select** (`src/components/ui/select.tsx`)
   - Dropdown select component
   - Fully implemented

5. **Badge** (`src/components/ui/badge.tsx`)
   - Badge component for tags/labels
   - Fully implemented

6. **Skeleton** (`src/components/ui/skeleton.tsx`)
   - Loading skeleton component
   - Fully implemented

### Layout Components

7. **Header** (`src/components/layout/Header.tsx`)
   - Main navigation with logo
   - Desktop and mobile menu (mobile TODO)
   - User menu (TODO)
   - Sign in button
   - **TODO**: Mobile menu drawer, active link highlighting, user dropdown

8. **Footer** (`src/components/layout/Footer.tsx`)
   - Footer with links and contact info
   - **TODO**: Add more links, social media, contact information

### Event Components

9. **EventCard** (`src/components/events/EventCard.tsx`)
   - Displays event preview
   - Image, title, description, date/time, location, club
   - Save button (TODO: implement save logic)
   - Tag badges
   - **TODO**: Implement save functionality, hover effects

10. **EventGrid** (`src/components/events/EventGrid.tsx`)
    - Grid layout for multiple events
    - Loading and empty states
    - Responsive grid (1/2/3 columns)
    - Fully implemented

11. **EventFilters** (`src/components/events/EventFilters.tsx`)
    - Tag filter buttons
    - Active filters display
    - Clear filters button
    - **TODO**: Date range picker, club filter, filter logic

12. **EventSearch** (`src/components/events/EventSearch.tsx`)
    - Search input with icon
    - **TODO**: Implement debouncing, search suggestions

13. **EventCardSkeleton** (`src/components/events/EventCardSkeleton.tsx`)
    - Loading skeleton for event cards
    - Fully implemented

### Auth Components

14. **SignInButton** (`src/components/auth/SignInButton.tsx`)
    - McGill OAuth sign-in button
    - **TODO**: Implement Supabase OAuth flow, email validation

---

## 🎣 React Hooks

### 1. **useEvents** (`src/hooks/useEvents.ts`)
- **Purpose**: Fetch and manage events
- **Returns**: `{ events, loading, error, refetch }`
- **TODO**: Implement event fetching with filters, pagination, caching

### 2. **useUser** (`src/hooks/useUser.ts`)
- **Purpose**: Manage user session and authentication
- **Returns**: `{ user, loading, error, signOut }`
- **TODO**: Implement user session fetching, auth state listener

---

## 📚 Type Definitions

### Types (`src/types/index.ts`)

1. **EventTag** (Enum)
   - `ACADEMIC`, `SOCIAL`, `SPORTS`, `CAREER`, `CULTURAL`, `WELLNESS`

2. **Event** (Interface)
   - `id`, `title`, `description`, `event_date`, `event_time`, `location`
   - `club_id`, `tags[]`, `image_url`, `status`, `approved_by`, `approved_at`
   - Relations: `club?`, `saved_by_users?`

3. **Club** (Interface)
   - `id`, `name`, `instagram_handle`, `logo_url`, `description`

4. **User** (Interface)
   - `id`, `email`, `full_name`, `interest_tags[]`

5. **SavedEvent** (Interface)
   - `id`, `user_id`, `event_id`, `created_at`
   - Relations: `event?`, `user?`

6. **EventFilter** (Interface)
   - `tags?`, `dateRange?`, `searchQuery?`, `clubId?`

---

## 🛠️ Utility Files

### 1. **utils.ts** (`src/lib/utils.ts`)
- `cn()` - Merge Tailwind classes
- `formatDate()` - Format ISO date to readable string
- `formatTime()` - Format time to 12-hour format
- `formatDateTime()` - Combine date and time
- `isMcGillEmail()` - Validate McGill email domain
- **Status**: Fully implemented

### 2. **constants.ts** (`src/lib/constants.ts`)
- `EVENT_TAGS` - Array of all event tags
- `EVENT_CATEGORIES` - Tag labels, colors, icons
- `API_ENDPOINTS` - API endpoint constants
- `MCGILL_COLORS` - Brand colors
- **Status**: Fully implemented

### 3. **Supabase Clients**
- **client.ts**: Browser client for client components
- **server.ts**: Server client for API routes and Server Components
- **types.ts**: Database type definitions (placeholder - needs generation)
- **Status**: Structure complete, needs database connection

---

## ⚙️ Configuration Files

### 1. **package.json**
- **Dependencies**:
  - Next.js 14.2.0
  - React 18.3.0
  - TypeScript 5.4.0
  - Supabase (@supabase/supabase-js, @supabase/ssr)
  - Tailwind CSS + plugins
  - shadcn/ui dependencies (clsx, tailwind-merge, class-variance-authority, @radix-ui/react-slot)
  - Lucide React (icons)
  - date-fns (date formatting)
- **Scripts**: `dev`, `build`, `start`, `lint`

### 2. **tsconfig.json**
- Strict mode enabled
- Path aliases: `@/*` → `./src/*`
- Next.js plugin configured

### 3. **tailwind.config.ts**
- Custom colors including McGill red (#ED1B2F)
- shadcn/ui theme configuration
- Typography plugin

### 4. **next.config.js**
- Image optimization for Supabase domains

### 5. **components.json**
- shadcn/ui configuration
- Path aliases for components

---

## 🎯 Implementation TODOs by Category

### Authentication & User Management
- [ ] Implement OAuth flow in `SignInButton.tsx`
- [ ] Implement email domain validation (McGill only)
- [ ] Implement user profile creation in auth callback
- [ ] Implement user session management in `useUser.ts`
- [ ] Implement sign out functionality
- [ ] Add user menu dropdown in Header
- [ ] Implement admin role checking

### Event Fetching & Display
- [ ] Implement event fetching in `useEvents.ts`
- [ ] Implement GET /api/events with filters
- [ ] Implement GET /api/events/[id]
- [ ] Implement event filtering logic
- [ ] Implement search with debouncing
- [ ] Implement pagination
- [ ] Add calendar view toggle
- [ ] Implement related events on detail page

### Save Functionality
- [ ] Implement POST /api/events/[id]/save
- [ ] Implement save/unsave in EventCard
- [ ] Implement saved events fetching in My Events page
- [ ] Add saved events filtering/sorting

### Recommendations
- [ ] Implement GET /api/recommendations
- [ ] Build recommendation algorithm
- [ ] Display recommendations on home page

### Admin Features
- [ ] Implement admin authentication check
- [ ] Implement pending events fetching
- [ ] Implement approve/reject functionality
- [ ] Implement POST /api/admin/events
- [ ] Implement admin statistics fetching
- [ ] Add recent events table to dashboard

### UI/UX Enhancements
- [ ] Implement mobile menu in Header
- [ ] Add active link highlighting
- [ ] Implement date range picker in EventFilters
- [ ] Add club filter dropdown
- [ ] Implement search suggestions
- [ ] Add share functionality to event detail page
- [ ] Add loading states throughout

### Database
- [ ] Generate Supabase types using CLI
- [ ] Set up database schema in Supabase
- [ ] Create RLS (Row Level Security) policies
- [ ] Set up database relationships

---

## 📝 Suggested Ticket Breakdown

### Ticket 1: Database Setup & Types
- Generate Supabase database types
- Set up database schema
- Configure RLS policies
- Update types.ts with generated types

### Ticket 2: Authentication Flow
- Implement OAuth in SignInButton
- Implement auth callback handler
- Implement email validation
- Implement user profile creation
- Test authentication flow

### Ticket 3: Event Fetching API
- Implement GET /api/events with filters
- Implement GET /api/events/[id]
- Add pagination support
- Test API endpoints

### Ticket 4: Event Display & Filtering
- Implement useEvents hook
- Connect EventGrid to API
- Implement EventFilters logic
- Implement EventSearch with debouncing
- Test filtering and search

### Ticket 5: Save Functionality
- Implement POST /api/events/[id]/save
- Implement save button in EventCard
- Implement saved events fetching
- Implement My Events page
- Test save/unsave flow

### Ticket 6: Event Detail Page
- Implement event fetching by ID
- Add related events
- Add share functionality
- Polish UI/UX

### Ticket 7: Recommendations System
- Implement GET /api/recommendations
- Build recommendation algorithm
- Display recommendations
- Test recommendation accuracy

### Ticket 8: Admin Dashboard
- Implement admin authentication check
- Implement statistics fetching
- Implement pending events queue
- Implement approve/reject functionality
- Test admin workflows

### Ticket 9: UI/UX Polish
- Implement mobile menu
- Add loading states
- Add error handling
- Improve responsive design
- Add animations/transitions

### Ticket 10: Testing & Documentation
- Write unit tests
- Write integration tests
- Update README with setup instructions
- Document API endpoints
- Create user guide

---

## 🚀 Getting Started

1. **Install dependencies**: `npm install`
2. **Set up environment**: Copy `.env.example` to `.env.local` and add Supabase keys
3. **Run development server**: `npm run dev`
4. **Open browser**: Navigate to `http://localhost:3000`

---

## 📊 Project Statistics

- **Total Files Created**: ~40+ files
- **Pages**: 8 pages
- **API Routes**: 6 routes
- **Components**: 14 components
- **Hooks**: 2 hooks
- **Type Definitions**: 6 interfaces/enums
- **Configuration Files**: 10 files

---

## ✅ What's Complete

- ✅ Project structure and folder organization
- ✅ All configuration files
- ✅ TypeScript type definitions
- ✅ Component structure with props
- ✅ API route structure
- ✅ Utility functions
- ✅ Constants and configuration
- ✅ Basic styling with Tailwind
- ✅ shadcn/ui components
- ✅ Loading and error states structure

## 🔨 What Needs Implementation

- 🔨 All API route logic (Supabase queries)
- 🔨 Authentication flow
- 🔨 Event fetching and filtering
- 🔨 Save functionality
- 🔨 Recommendations algorithm
- 🔨 Admin features
- 🔨 Database schema and RLS policies
- 🔨 Mobile menu and responsive enhancements

---

**Last Updated**: Project initialization complete
**Next Steps**: Assign tickets to interns and begin implementation

