-- ============================================================
-- Uni-Verse Beta Seed Data
-- Run this in the Supabase SQL Editor to populate 17 clubs
-- and 80 events spanning 4 weeks for beta launch.
-- ============================================================

-- Step 1: Insert Clubs
-- Using DO block to capture club IDs for event references
DO $$
DECLARE
  club_csus UUID;
  club_eus UUID;
  club_debate UUID;
  club_invest UUID;
  club_outdoors UUID;
  club_dance UUID;
  club_film UUID;
  club_music UUID;
  club_entrepreneurs UUID;
  club_wistem UUID;
  club_cooking UUID;
  club_photo UUID;
  club_running UUID;
  club_chess UUID;
  club_mun UUID;
  club_bhangra UUID;
  club_gdg UUID;
BEGIN

-- ============ CLUBS ============

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Computer Science Student Society', 'The official student society for CS students at McGill. We host tech talks, hackathons, networking events, and study sessions.', 'mcgillcsus')
RETURNING id INTO club_csus;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Engineering Student Society', 'Representing engineering students across all departments. Events, socials, and professional development.', 'mcgilleurs')
RETURNING id INTO club_eus;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Debate Union', 'McGill''s competitive debate society. Weekly practices, tournaments, and public speaking workshops.', 'mcgilldebate')
RETURNING id INTO club_debate;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Investment Club', 'Learn about financial markets, portfolio management, and careers in finance through workshops and competitions.', 'mcgillinvestment')
RETURNING id INTO club_invest;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Outdoors Club', 'Hiking, camping, skiing, and outdoor adventures for McGill students of all skill levels.', 'mcgilloutdoors')
RETURNING id INTO club_outdoors;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Dance Company', 'A student-run dance company offering classes and performances in contemporary, hip-hop, jazz, and ballet.', 'mcgilldanceco')
RETURNING id INTO club_dance;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Film Society', 'Weekly screenings, filmmaking workshops, and short film festivals for cinema enthusiasts.', 'mcgillfilm')
RETURNING id INTO club_film;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Music Society', 'Open mic nights, concerts, jam sessions, and music appreciation events.', 'mcgillmusicsoc')
RETURNING id INTO club_music;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Entrepreneurs Club', 'Startup workshops, pitch competitions, and networking with Montreal''s tech ecosystem.', 'mcgillentrepreneurs')
RETURNING id INTO club_entrepreneurs;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Women in STEM', 'Empowering women in science, technology, engineering, and mathematics through mentorship and events.', 'mcgillwistem')
RETURNING id INTO club_wistem;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Cooking Club', 'Weekly cooking sessions, potlucks, and culinary adventures exploring cuisines from around the world.', 'mcgillcooking')
RETURNING id INTO club_cooking;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Photography Club', 'Photowalks, editing workshops, exhibitions, and a creative community for photographers.', 'mcgillphoto')
RETURNING id INTO club_photo;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Running Club', 'Group runs, training plans, and race preparation for runners of all levels on Mount Royal and beyond.', 'mcgillrunning')
RETURNING id INTO club_running;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Chess Club', 'Casual games, tournaments, strategy workshops, and chess socials every week.', 'mcgillchess')
RETURNING id INTO club_chess;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Model United Nations', 'Conferences, position paper workshops, and diplomatic simulations for aspiring global leaders.', 'mcgillmun')
RETURNING id INTO club_mun;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('McGill Bhangra', 'High-energy Punjabi dance practices, performances, and cultural celebrations.', 'mcgillbhangra')
RETURNING id INTO club_bhangra;

INSERT INTO clubs (name, description, instagram_handle)
VALUES ('GDG McGill', 'Google Developer Group at McGill. Tech workshops, coding sessions, and developer community events.', 'gdgmcgill')
RETURNING id INTO club_gdg;

-- ============ EVENTS ============
-- 80 events across 4 weeks (Feb 24 - Mar 22, 2026)
-- All 6 categories covered, all status = 'approved'

-- ─────────── WEEK 1: Feb 24 – Mar 1 ───────────

INSERT INTO events (title, description, start_date, end_date, location, club_id, tags, status, source) VALUES
('Intro to Machine Learning Workshop', 'A beginner-friendly workshop covering the fundamentals of machine learning, including supervised learning, neural networks, and hands-on exercises with Python and scikit-learn.', '2026-02-24 14:00:00-05', '2026-02-24 16:00:00-05', 'Trottier Building, Room 2120', club_csus, ARRAY['academic'], 'approved', 'admin'),

('Engineering Career Fair', 'Meet recruiters from top engineering firms including Bombardier, WSP, and SNC-Lavalin. Bring your resume and dress business casual.', '2026-02-24 10:00:00-05', '2026-02-24 16:00:00-05', 'McConnell Engineering Building, Lobby', club_eus, ARRAY['career'], 'approved', 'admin'),

('Public Speaking 101', 'Workshop on overcoming stage fright, structuring arguments, and delivering persuasive speeches. Open to all experience levels.', '2026-02-24 18:00:00-05', '2026-02-24 20:00:00-05', 'Leacock Building, Room 232', club_debate, ARRAY['academic'], 'approved', 'admin'),

('Morning Run: Mount Royal Loop', 'Join us for a 5K group run up Mount Royal. All paces welcome. Meet at the Roddick Gates.', '2026-02-25 07:00:00-05', '2026-02-25 08:30:00-05', 'Roddick Gates, McGill Campus', club_running, ARRAY['sports'], 'approved', 'admin'),

('Stock Pitch Competition Info Session', 'Learn about our annual stock pitch competition. Teams of 3-4 will analyze and present investment theses to a panel of finance professionals.', '2026-02-25 17:30:00-05', '2026-02-25 19:00:00-05', 'Bronfman Building, Room 151', club_invest, ARRAY['career'], 'approved', 'admin'),

('Yoga & Mindfulness Session', 'Unwind with a guided yoga and meditation session. Mats provided. Perfect for stressed students during midterm season.', '2026-02-25 12:00:00-05', '2026-02-25 13:00:00-05', 'McGill Athletics, Fieldhouse Studio', club_outdoors, ARRAY['wellness'], 'approved', 'admin'),

('Contemporary Dance Workshop', 'Explore contemporary dance techniques with our guest choreographer. No experience needed, just bring comfortable clothing.', '2026-02-26 18:00:00-05', '2026-02-26 20:00:00-05', 'Player''s Theatre, 3480 McTavish', club_dance, ARRAY['cultural'], 'approved', 'admin'),

('Movie Night: Everything Everywhere All at Once', 'Free screening followed by a moderated discussion on multiverse narratives in modern cinema. Popcorn provided.', '2026-02-26 19:00:00-05', '2026-02-26 22:00:00-05', 'Leacock Building, Room 132', club_film, ARRAY['cultural'], 'approved', 'admin'),

('Open Mic Night', 'Perform or enjoy live music, poetry, and comedy from McGill''s talented student community. Sign up at the door.', '2026-02-26 20:00:00-05', '2026-02-26 23:00:00-05', 'Thomson House, 3650 McTavish', club_music, ARRAY['social'], 'approved', 'admin'),

('Build Your First Web App with Next.js', 'Hands-on workshop where you''ll build and deploy a full-stack web application using Next.js, React, and Supabase.', '2026-02-27 14:00:00-05', '2026-02-27 17:00:00-05', 'Trottier Building, Room 3120', club_gdg, ARRAY['academic'], 'approved', 'admin'),

('Startup Pitch Night', '5 student-founded startups pitch to a panel of local VCs and angel investors. Network with Montreal''s startup scene afterwards.', '2026-02-27 18:00:00-05', '2026-02-27 21:00:00-05', 'Dobson Centre for Entrepreneurship', club_entrepreneurs, ARRAY['career'], 'approved', 'admin'),

('Women in Tech Panel', 'Hear from women leaders at Google, Microsoft, and Shopify about their career journeys, challenges, and advice for aspiring technologists.', '2026-02-27 17:00:00-05', '2026-02-27 19:00:00-05', 'McConnell Engineering, Room 204', club_wistem, ARRAY['career'], 'approved', 'admin'),

('Thai Cooking Night', 'Learn to make Pad Thai and Green Curry from scratch. All ingredients provided. Vegetarian options available.', '2026-02-27 18:30:00-05', '2026-02-27 20:30:00-05', 'Presbyterian College Kitchen', club_cooking, ARRAY['social'], 'approved', 'admin'),

('Golden Hour Photowalk', 'Capture the magic of golden hour light on campus and around the McGill Ghetto. Bring any camera or smartphone.', '2026-02-28 16:00:00-05', '2026-02-28 18:00:00-05', 'Meet at Arts Building Steps', club_photo, ARRAY['cultural'], 'approved', 'admin'),

('Chess Tournament: Winter Open', 'Swiss-system tournament open to all skill levels. Prizes for top 3 finishers. FIDE-rated games available.', '2026-02-28 13:00:00-05', '2026-02-28 18:00:00-05', 'Brown Building, Room 2001', club_chess, ARRAY['social'], 'approved', 'admin'),

('Mental Health Awareness Workshop', 'Learn about stress management, burnout prevention, and McGill mental health resources. Led by trained peer support volunteers.', '2026-02-28 14:00:00-05', '2026-02-28 15:30:00-05', 'Brown Building, Room 3001', club_wistem, ARRAY['wellness'], 'approved', 'admin'),

('MUN Practice Debate: Climate Policy', 'Simulate a UN General Assembly debate on international climate policy. Great practice for upcoming conferences.', '2026-03-01 10:00:00-05', '2026-03-01 13:00:00-05', 'Leacock Building, Room 26', club_mun, ARRAY['academic'], 'approved', 'admin'),

('Bhangra Beginners Workshop', 'Learn the basics of Bhangra dance in this high-energy, beginner-friendly workshop. No dance experience required!', '2026-03-01 14:00:00-05', '2026-03-01 16:00:00-05', 'Currie Gym, Dance Studio', club_bhangra, ARRAY['cultural'], 'approved', 'admin'),

('Weekend Trail Run: Parc Jean-Drapeau', 'Moderate 8K trail run through Parc Jean-Drapeau with post-run stretching. Transportation arranged from campus.', '2026-03-01 09:00:00-05', '2026-03-01 12:00:00-05', 'Meet at Roddick Gates', club_running, ARRAY['sports'], 'approved', 'admin'),

('Ski Trip: Mont-Tremblant', 'Full-day ski trip to Mont-Tremblant. Bus transportation included. Lift tickets at group discount. Equipment rental available.', '2026-03-01 06:00:00-05', '2026-03-01 20:00:00-05', 'Departure: Milton Gates', club_outdoors, ARRAY['sports'], 'approved', 'admin');

-- ─────────── WEEK 2: Mar 2 – Mar 8 ───────────

INSERT INTO events (title, description, start_date, end_date, location, club_id, tags, status, source) VALUES
('Data Structures Study Group', 'Collaborative study session for COMP 251. Work through problem sets, share strategies, and prepare for the midterm.', '2026-03-02 15:00:00-05', '2026-03-02 18:00:00-05', 'Schulich Library, Group Study Room A', club_csus, ARRAY['academic'], 'approved', 'admin'),

('Resume Workshop for Engineers', 'Get your resume reviewed by industry professionals. Learn what recruiters look for and how to stand out. Bring a printed copy.', '2026-03-02 16:00:00-05', '2026-03-02 18:00:00-05', 'Macdonald Engineering, Room 267', club_eus, ARRAY['career'], 'approved', 'admin'),

('Debate Bootcamp Day 1', 'Intensive debate training: argumentation theory, cross-examination techniques, and rebuttal strategies.', '2026-03-03 10:00:00-05', '2026-03-03 16:00:00-05', 'Leacock Building, Room 232', club_debate, ARRAY['academic'], 'approved', 'admin'),

('Interval Training: Track Session', 'Speed workout at the Percival Molson Stadium track. Warm-up, 8x400m intervals, cool-down. All fitness levels.', '2026-03-03 17:00:00-05', '2026-03-03 18:30:00-05', 'Percival Molson Stadium', club_running, ARRAY['sports'], 'approved', 'admin'),

('Financial Modeling Workshop', 'Learn to build DCF models and LBO models from scratch in Excel. Essential skills for finance recruiting.', '2026-03-03 18:00:00-05', '2026-03-03 20:30:00-05', 'Bronfman Building, Room 340', club_invest, ARRAY['career'], 'approved', 'admin'),

('Pilates & Stretch', 'Low-impact Pilates class focused on core strength and flexibility. Perfect midweek de-stress session.', '2026-03-04 12:00:00-05', '2026-03-04 13:00:00-05', 'McGill Athletics, Fieldhouse Studio', club_outdoors, ARRAY['wellness'], 'approved', 'admin'),

('Hip-Hop Dance Masterclass', 'Guest choreographer from Montreal''s dance scene teaches hip-hop fundamentals and a short routine.', '2026-03-04 19:00:00-05', '2026-03-04 21:00:00-05', 'Player''s Theatre, 3480 McTavish', club_dance, ARRAY['cultural'], 'approved', 'admin'),

('Documentary Night: Free Solo', 'Screening of the Oscar-winning documentary about Alex Honnold''s free solo climb of El Capitan.', '2026-03-04 19:30:00-05', '2026-03-04 22:00:00-05', 'Leacock Building, Room 132', club_film, ARRAY['social'], 'approved', 'admin'),

('Acoustic Jam Session', 'Bring your instrument for a casual jam session. Guitarists, vocalists, percussionists — everyone welcome.', '2026-03-04 20:00:00-05', '2026-03-04 22:30:00-05', 'Shatner Building, Ballroom', club_music, ARRAY['social'], 'approved', 'admin'),

('Cloud Computing with Google Cloud', 'Introduction to GCP: Compute Engine, Cloud Functions, and Firestore. Get free credits to experiment.', '2026-03-05 14:00:00-05', '2026-03-05 16:30:00-05', 'Trottier Building, Room 2120', club_gdg, ARRAY['academic'], 'approved', 'admin'),

('How to Validate Your Startup Idea', 'Workshop on customer discovery, MVPs, and lean startup methodology. Bring your ideas for live feedback.', '2026-03-05 18:00:00-05', '2026-03-05 20:00:00-05', 'Dobson Centre for Entrepreneurship', club_entrepreneurs, ARRAY['career'], 'approved', 'admin'),

('Networking Dinner: Women in Finance', 'Intimate dinner with women working in investment banking, asset management, and fintech in Montreal.', '2026-03-05 18:30:00-05', '2026-03-05 21:00:00-05', 'Faculty Club, 3450 McTavish', club_wistem, ARRAY['career'], 'approved', 'admin'),

('Sushi Making Workshop', 'Learn to roll maki, nigiri, and inside-out rolls. All ingredients and equipment provided. Take home your creations!', '2026-03-05 18:00:00-05', '2026-03-05 20:30:00-05', 'Presbyterian College Kitchen', club_cooking, ARRAY['social'], 'approved', 'admin'),

('Night Photography Workshop', 'Master long exposures, light trails, and night portraits on campus. Tripods available to borrow.', '2026-03-06 19:00:00-05', '2026-03-06 21:30:00-05', 'Meet at Roddick Gates', club_photo, ARRAY['cultural'], 'approved', 'admin'),

('Blitz Chess Night', 'Fast-paced 5-minute chess games in a casual, social atmosphere. Prizes for the top blitz player.', '2026-03-06 19:00:00-05', '2026-03-06 22:00:00-05', 'Brown Building, Room 2001', club_chess, ARRAY['social'], 'approved', 'admin'),

('Sleep Hygiene & Wellness Talk', 'A talk by a McGill Health Sciences researcher on sleep science, practical tips for better rest, and managing academic stress.', '2026-03-06 15:00:00-05', '2026-03-06 16:30:00-05', 'Stewart Biology, Room S1/4', club_wistem, ARRAY['wellness'], 'approved', 'admin'),

('McMUN Mini Conference', 'Half-day Model UN simulation with three committees. Perfect for beginners wanting to try MUN before a full conference.', '2026-03-07 09:00:00-05', '2026-03-07 14:00:00-05', 'Leacock Building, Rooms 26, 110, 132', club_mun, ARRAY['academic'], 'approved', 'admin'),

('Bhangra Performance: Holi Special', 'Celebrate Holi with a special Bhangra performance followed by a colorful outdoor celebration on the lower field.', '2026-03-07 15:00:00-05', '2026-03-07 18:00:00-05', 'Lower Field, McGill Campus', club_bhangra, ARRAY['cultural'], 'approved', 'admin'),

('5K Fun Run: St. Patrick''s Edition', 'Festive 5K run through downtown Montreal. Wear green! Post-run refreshments at Thomson House.', '2026-03-08 10:00:00-05', '2026-03-08 12:00:00-05', 'Meet at Roddick Gates', club_running, ARRAY['sports'], 'approved', 'admin'),

('Rock Climbing Social', 'Indoor rock climbing session at Allez Up. Gear rental included. Great for beginners and experienced climbers alike.', '2026-03-08 13:00:00-05', '2026-03-08 16:00:00-05', 'Allez Up Climbing Gym', club_outdoors, ARRAY['sports'], 'approved', 'admin');

-- ─────────── WEEK 3: Mar 9 – Mar 15 ───────────

INSERT INTO events (title, description, start_date, end_date, location, club_id, tags, status, source) VALUES
('Algorithms Problem Solving Session', 'Work through dynamic programming and graph algorithm problems. Ideal prep for COMP 252 and coding interviews.', '2026-03-09 14:00:00-05', '2026-03-09 17:00:00-05', 'Trottier Building, Room 3120', club_csus, ARRAY['academic'], 'approved', 'admin'),

('Engineering Design Competition', 'Teams of 4 have 6 hours to design and prototype a solution to a real-world engineering challenge. Prizes for top 3 teams.', '2026-03-09 09:00:00-05', '2026-03-09 17:00:00-05', 'Macdonald Engineering, Design Lab', club_eus, ARRAY['academic'], 'approved', 'admin'),

('Parliamentary Debate Tournament', 'British Parliamentary style tournament. 4 rounds of debate with experienced judges. Open to all skill levels.', '2026-03-10 09:00:00-05', '2026-03-10 18:00:00-05', 'Leacock Building, Various Rooms', club_debate, ARRAY['academic'], 'approved', 'admin'),

('Tempo Run: Canal Lachine', 'Moderate-pace 10K along the Lachine Canal. Beautiful route with post-run coffee at a local cafe.', '2026-03-10 07:00:00-05', '2026-03-10 09:00:00-05', 'Meet at Atwater Market', club_running, ARRAY['sports'], 'approved', 'admin'),

('ETF Investing for Beginners', 'Learn the basics of ETF investing, portfolio allocation, and how to start investing as a student with limited capital.', '2026-03-10 17:30:00-05', '2026-03-10 19:00:00-05', 'Bronfman Building, Room 151', club_invest, ARRAY['career'], 'approved', 'admin'),

('Meditation & Breathwork', 'Guided breathwork techniques and meditation practices for stress reduction. No experience necessary.', '2026-03-11 12:00:00-05', '2026-03-11 13:00:00-05', 'Birks Heritage Chapel', club_outdoors, ARRAY['wellness'], 'approved', 'admin'),

('Spring Dance Showcase Rehearsal (Open)', 'Watch the Dance Company rehearse for the Spring Showcase. Give feedback and see behind-the-scenes preparation.', '2026-03-11 18:00:00-05', '2026-03-11 20:30:00-05', 'Moyse Hall, Arts Building', club_dance, ARRAY['cultural'], 'approved', 'admin'),

('Short Film Festival: Student Works', 'Screening of 12 student-made short films followed by a Q&A with the filmmakers. Vote for your favourite!', '2026-03-11 18:30:00-05', '2026-03-11 21:30:00-05', 'Leacock Building, Room 132', club_film, ARRAY['cultural'], 'approved', 'admin'),

('Songwriting Workshop', 'Learn songwriting basics: melody, lyrics, chord progressions. Collaborate with other musicians to create an original song.', '2026-03-11 19:00:00-05', '2026-03-11 21:00:00-05', 'Shatner Building, Ballroom', club_music, ARRAY['cultural'], 'approved', 'admin'),

('Flutter Mobile App Workshop', 'Build a cross-platform mobile app with Flutter and Dart. Covers UI design, state management, and Firebase integration.', '2026-03-12 14:00:00-05', '2026-03-12 17:00:00-05', 'Trottier Building, Room 2120', club_gdg, ARRAY['academic'], 'approved', 'admin'),

('Founder Fireside Chat', 'Hear from the founder of a Montreal unicorn startup about building a company from a dorm room to a $1B valuation.', '2026-03-12 18:00:00-05', '2026-03-12 19:30:00-05', 'Dobson Centre for Entrepreneurship', club_entrepreneurs, ARRAY['career'], 'approved', 'admin'),

('Grad School Application Workshop', 'Tips on personal statements, selecting programs, securing recommendations, and funding for graduate studies.', '2026-03-12 16:00:00-05', '2026-03-12 17:30:00-05', 'Thomson House, 3650 McTavish', club_wistem, ARRAY['career'], 'approved', 'admin'),

('Italian Pasta Night', 'Make fresh pasta from scratch — fettuccine, ravioli, and a classic Bolognese. All skill levels welcome.', '2026-03-12 18:30:00-05', '2026-03-12 21:00:00-05', 'Presbyterian College Kitchen', club_cooking, ARRAY['social'], 'approved', 'admin'),

('Photo Exhibition: Campus Through Our Lens', 'Opening reception for the Photography Club''s annual exhibition showcasing the best shots of McGill campus.', '2026-03-13 17:00:00-05', '2026-03-13 20:00:00-05', 'Visual Arts Building Gallery', club_photo, ARRAY['cultural'], 'approved', 'admin'),

('Simultaneous Chess Exhibition', 'Challenge our club president in a simultaneous exhibition. Can you beat a rated 2100 player? Spectators welcome.', '2026-03-13 18:00:00-05', '2026-03-13 21:00:00-05', 'Brown Building, Room 2001', club_chess, ARRAY['social'], 'approved', 'admin'),

('Nutrition & Meal Prep for Students', 'A dietitian shares budget-friendly meal prep strategies, quick recipes, and nutrition tips for busy students.', '2026-03-13 14:00:00-05', '2026-03-13 15:30:00-05', 'McConnell Engineering, Room 204', club_cooking, ARRAY['wellness'], 'approved', 'admin'),

('Crisis Simulation: Security Council', 'Advanced MUN simulation of a UN Security Council crisis scenario. Fast-paced, high-stakes diplomacy.', '2026-03-14 10:00:00-05', '2026-03-14 16:00:00-05', 'Leacock Building, Room 26', club_mun, ARRAY['academic'], 'approved', 'admin'),

('Bhangra x Bollywood Fusion Workshop', 'Learn a fusion routine combining Bhangra and Bollywood dance styles. High energy, great cardio!', '2026-03-14 15:00:00-05', '2026-03-14 17:00:00-05', 'Currie Gym, Dance Studio', club_bhangra, ARRAY['cultural'], 'approved', 'admin'),

('Half Marathon Training Run', 'Long run of 15K along the waterfront. Practice for the Montreal Half Marathon. Hydration provided at checkpoints.', '2026-03-15 08:00:00-05', '2026-03-15 10:30:00-05', 'Meet at Old Port Clock Tower', club_running, ARRAY['sports'], 'approved', 'admin'),

('Snowshoeing at Mont-Saint-Bruno', 'Guided snowshoe hike through the beautiful trails of Mont-Saint-Bruno. Transportation from campus included.', '2026-03-15 09:00:00-05', '2026-03-15 16:00:00-05', 'Departure: Milton Gates', club_outdoors, ARRAY['sports'], 'approved', 'admin');

-- ─────────── WEEK 4: Mar 16 – Mar 22 ───────────

INSERT INTO events (title, description, start_date, end_date, location, club_id, tags, status, source) VALUES
('HackMcGill Mini Hackathon', '12-hour mini hackathon. Build anything — web, mobile, AI, hardware. Teams of 1-4. Prizes, food, and mentorship provided.', '2026-03-16 09:00:00-05', '2026-03-16 21:00:00-05', 'Trottier Building, All Floors', club_csus, ARRAY['academic'], 'approved', 'admin'),

('Capstone Project Showcase', 'Final-year engineering students present their capstone projects. See innovative solutions to real-world problems.', '2026-03-16 13:00:00-05', '2026-03-16 17:00:00-05', 'McConnell Engineering, Lobby & Room 204', club_eus, ARRAY['academic'], 'approved', 'admin'),

('Debate Social & Games Night', 'Wind down with board games, trivia, and casual debates. Snacks and drinks provided. No debate experience needed!', '2026-03-17 19:00:00-05', '2026-03-17 22:00:00-05', 'Thomson House, 3650 McTavish', club_debate, ARRAY['social'], 'approved', 'admin'),

('Easy Recovery Run', 'Light 4K recovery jog through the McGill campus and surrounding streets. Focus on form and relaxation.', '2026-03-17 07:00:00-05', '2026-03-17 08:00:00-05', 'Roddick Gates, McGill Campus', club_running, ARRAY['sports'], 'approved', 'admin'),

('Mock Trading Competition', 'Real-time simulated trading competition. Navigate market events and manage a virtual portfolio. Top traders win prizes.', '2026-03-17 18:00:00-05', '2026-03-17 21:00:00-05', 'Bronfman Building, Computer Lab', club_invest, ARRAY['career'], 'approved', 'admin'),

('Sound Bath & Relaxation', 'Immersive sound bath experience with singing bowls, gongs, and ambient sounds. Deep relaxation for mind and body.', '2026-03-18 18:00:00-05', '2026-03-18 19:30:00-05', 'Birks Heritage Chapel', club_outdoors, ARRAY['wellness'], 'approved', 'admin'),

('Spring Dance Showcase', 'The McGill Dance Company''s annual spring showcase featuring contemporary, hip-hop, jazz, and ballet performances.', '2026-03-18 19:30:00-05', '2026-03-18 22:00:00-05', 'Moyse Hall, Arts Building', club_dance, ARRAY['cultural'], 'approved', 'admin'),

('Director''s Cut: Criterion Collection Night', 'Screening of a Criterion Collection classic (voted by members). Film history context and post-screening analysis.', '2026-03-18 19:00:00-05', '2026-03-18 22:00:00-05', 'Leacock Building, Room 132', club_film, ARRAY['cultural'], 'approved', 'admin'),

('Battle of the Bands', 'Student bands compete for the title of McGill''s Best Band. Three judges, audience voting, and a grand prize of studio recording time.', '2026-03-18 20:00:00-05', '2026-03-18 23:30:00-05', 'Shatner Building, Ballroom', club_music, ARRAY['social'], 'approved', 'admin'),

('AI & Ethics Roundtable', 'A moderated discussion on the ethical implications of AI in education, healthcare, and hiring. Featuring McGill faculty panelists.', '2026-03-19 14:00:00-05', '2026-03-19 16:00:00-05', 'Trottier Building, Room 2120', club_gdg, ARRAY['academic'], 'approved', 'admin'),

('Pitch Competition Finals', 'The top 8 startups from our incubator pitch for $5,000 in seed funding. Network with Montreal VCs and angel investors.', '2026-03-19 18:00:00-05', '2026-03-19 21:00:00-05', 'Dobson Centre for Entrepreneurship', club_entrepreneurs, ARRAY['career'], 'approved', 'admin'),

('STEM Mentorship Mixer', 'Connect with upper-year STEM students and recent graduates for mentorship, advice, and career guidance.', '2026-03-19 17:00:00-05', '2026-03-19 19:00:00-05', 'Thomson House, 3650 McTavish', club_wistem, ARRAY['career'], 'approved', 'admin'),

('Mexican Street Food Night', 'Make authentic tacos al pastor, elote, and churros. Learn about the rich culinary traditions of Mexican street food.', '2026-03-19 18:30:00-05', '2026-03-19 21:00:00-05', 'Presbyterian College Kitchen', club_cooking, ARRAY['social'], 'approved', 'admin'),

('Portrait Photography Workshop', 'Master portrait lighting, posing, and composition. Practice shooting portraits of fellow club members.', '2026-03-20 15:00:00-05', '2026-03-20 17:30:00-05', 'Visual Arts Building, Room 102', club_photo, ARRAY['cultural'], 'approved', 'admin'),

('Puzzle Rush Night', 'Timed chess puzzles, lateral thinking challenges, and strategy games. Prizes for the sharpest minds.', '2026-03-20 19:00:00-05', '2026-03-20 21:30:00-05', 'Brown Building, Room 2001', club_chess, ARRAY['social'], 'approved', 'admin'),

('Desk Stretches & Ergonomics Workshop', 'Learn quick stretching routines you can do at your desk, proper ergonomic setup, and posture correction techniques.', '2026-03-20 12:00:00-05', '2026-03-20 13:00:00-05', 'Burnside Hall, Room 306', club_running, ARRAY['wellness'], 'approved', 'admin'),

('General Assembly Simulation', 'Full-day General Assembly simulation focusing on global digital governance. Position papers due one week before.', '2026-03-21 09:00:00-05', '2026-03-21 17:00:00-05', 'Leacock Building, Room 132', club_mun, ARRAY['academic'], 'approved', 'admin'),

('Bhangra End-of-Season Show', 'Our biggest performance of the year! High-energy Bhangra routines, guest performances, and a celebration of South Asian culture.', '2026-03-21 18:00:00-05', '2026-03-21 21:00:00-05', 'Moyse Hall, Arts Building', club_bhangra, ARRAY['cultural'], 'approved', 'admin'),

('Spring 10K Race', 'Official club 10K race through downtown Montreal. Chip timing, finisher medals, and a post-race celebration.', '2026-03-22 08:00:00-05', '2026-03-22 11:00:00-05', 'Start: Parc Jeanne-Mance', club_running, ARRAY['sports'], 'approved', 'admin'),

('End-of-Winter Bonfire Social', 'Celebrate the end of winter with a bonfire, s''mores, hot chocolate, and good company on the lower field.', '2026-03-22 18:00:00-05', '2026-03-22 21:00:00-05', 'Lower Field, McGill Campus', club_outdoors, ARRAY['social'], 'approved', 'admin');

-- ============ DONE ============
-- Total: 17 clubs, 80 events
-- Categories covered: academic, social, sports, career, cultural, wellness
-- All events have status = 'approved'
-- Events span Feb 24 - Mar 22, 2026 (4 weeks)

RAISE NOTICE 'Beta seed data inserted successfully: 17 clubs, 80 events';

END $$;
