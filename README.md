# Uni-Verse

A campus event discovery platform for McGill University. Discover and explore campus events through a centralized calendar, personalized recommendations, and email reminders.

## 🚀 Features

- **Event Discovery**: Browse events by category, date, and location
- **Personalized Recommendations**: Get event suggestions based on your interests
- **Save Events**: Save events for later viewing
- **Event Export**: Download events as CSV or iCal
- **Guest Access**: Browse events without signing in
- **McGill Authentication**: Sign in with McGill email for full features
- **Admin Dashboard**: Manage events and approve submissions

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database & Auth**: Supabase
- **State Management**: React Hooks
- **Icons**: Lucide React
- **Date Formatting**: date-fns

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ and npm
- A Supabase account and project
- Git

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Event-Radar
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://jnlbrvejjjgtjhlajfss.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
uni-verse/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   ├── events/[id]/        # Event detail pages
│   │   ├── my-events/          # Saved events page
│   │   ├── admin/              # Admin dashboard
│   │   ├── api/                # API routes
│   │   └── auth/               # Auth callbacks
│   ├── components/              # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/             # Layout components
│   │   ├── events/             # Event-related components
│   │   └── auth/               # Auth components
│   ├── lib/                    # Utility libraries
│   │   ├── supabase/           # Supabase clients
│   │   ├── utils.ts            # Utility functions
│   │   └── constants.ts        # App constants
│   ├── types/                  # TypeScript types
│   └── hooks/                  # Custom React hooks
├── public/                     # Static assets
├── .env.example                # Environment variables template
└── package.json               # Dependencies
```

## 🗄️ Database Schema

The application uses Supabase with the following main tables:

- **events**: Event information (title, description, date, location, tags, etc.)
- **clubs**: Club/organization information
- **users**: User profiles with interest tags
- **saved_events**: Junction table for user-saved events

## 🔑 Key Files

### Type Definitions
- `src/types/index.ts`: TypeScript interfaces for Event, Club, User, etc.

### Supabase Clients
- `src/lib/supabase/client.ts`: Browser client (use in client components)
- `src/lib/supabase/server.ts`: Server client (use in API routes and Server Components)

### Components
- `src/components/events/EventCard.tsx`: Event card component
- `src/components/events/EventGrid.tsx`: Grid layout for events
- `src/components/layout/Header.tsx`: Main navigation header
- `src/components/ErrorBoundary.tsx`: Reusable UI error boundary

### API Routes
- `src/app/api/events/route.ts`: GET events with filters
- `src/app/api/events/export/route.ts`: Export events as CSV or iCal
- `src/app/api/events/[id]/route.ts`: GET single event
- `src/app/api/events/[id]/save/route.ts`: POST save/unsave event
- `src/app/api/recommendations/route.ts`: GET personalized recommendations
- `src/app/api/admin/events/route.ts`: POST create/update events (admin)

## 🎯 Development Tasks

This codebase is set up as a foundation for development. Key areas that need implementation:

1. **Event Fetching**: Implement API routes to fetch events from Supabase
2. **Authentication**: Set up OAuth flow with McGill email validation
3. **Event Filtering**: Implement search, tag filtering, and date range filtering
4. **Save Functionality**: Implement save/unsave events for authenticated users
5. **Recommendations**: Build recommendation algorithm based on user interests
6. **Admin Features**: Implement event approval/rejection workflow

Each file contains TODO comments indicating what needs to be implemented.

## 📝 Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint
- `npm run test`: Run unit tests

## 🎨 Styling

The project uses Tailwind CSS with shadcn/ui components. Custom colors are defined in `tailwind.config.ts`:

- **McGill Red**: `#ED1B2F`
- **McGill Grey**: `#7f7f7f`

The project allows users to toggle between light/dark theme.
When adding a new UI element, make sure it has [dark theme](https://github.com/gdgmcgill/Event-Radar/wiki/Theming-&-Dark-Mode-%E2%80%94-Guide) 

## 🧯 Error Boundary

Use the reusable `ErrorBoundary` component to prevent a broken UI section from crashing the whole page.

Example:

```tsx
import { ErrorBoundary } from "@/components/ErrorBoundary";

<ErrorBoundary fallbackMessage="We couldn't load events right now.">
  <EventGrid />
</ErrorBoundary>
```

## 🔐 Authentication

Authentication is handled through Supabase Auth. Users must sign in with a McGill email address (`@mail.mcgill.ca` or `@mcgill.ca`).

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)

## 🤝 Contributing

1. Check GitHub issues for available tasks
2. Create a new branch for your feature
3. Implement the feature following the TODO comments
4. Submit a pull request

## 📄 License

See LICENSE file for details.

## 🙋 Support

For questions or issues, please open an issue on GitHub or contact the development team.

---

Built with ❤️ for McGill University
