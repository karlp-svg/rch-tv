========================================
  RCH TV - DEPLOYMENT (Vercel + Supabase)
========================================

Project location: D:\karl\Apps\app-rch-tv\PROGRAM
Hosting:  Vercel (app)  +  Supabase (database + photo storage)

== WHY THIS SETUP ==
- Vercel: free Next.js hosting, SSL, custom domain
- Supabase: free PostgreSQL (500MB) + 1GB file storage
- Photos are stored in Supabase Storage (not the database),
  so the database stays tiny and you get lots of headroom.

========================================
  STEP 1 — Create Supabase project
========================================
1. Go to supabase.com and sign up (free)
2. Click "New Project"
   - Name: rch-tv
   - Set a database password (SAVE IT somewhere)
   - Pick a region close to your venue
3. Wait ~2 minutes for it to provision

== Get your DATABASE_URL ==
4. In Supabase: Project Settings (gear icon) → Database
5. Under "Connection string" choose "URI"
6. Copy it. It looks like:
   postgresql://postgres.[ref]:[password]@aws-....pooler.supabase.com:6543/postgres
7. Replace [password] with the database password from step 2

== Create the storage bucket ==
8. In Supabase: Storage (left menu) → "New bucket"
   - Name: rch-tv-photos
   - Public bucket: YES (toggle ON)
   - Click "Save"

== Get your storage keys ==
9. Project Settings → API
10. Copy these two values:
    - "Project URL"                  (SUPABASE_URL)
    - "service_role" secret key      (SUPABASE_SERVICE_ROLE_KEY)
    (Click "Reveal" to see the service_role key)

========================================
  STEP 2 — Push database schema
========================================
Run:   deploy-push-schema.bat
Paste your DATABASE_URL when prompted.
This creates all the tables in Supabase.

========================================
  STEP 3 — Push code to GitHub
========================================
Run:   deploy-github-setup.bat
(You must create an empty "rch-tv" repo on github.com first)

========================================
  STEP 4 — Deploy on Vercel
========================================
1. Go to vercel.com and sign in with GitHub
2. Click "Add New" → "Project"
3. Import the "rch-tv" repository
4. BEFORE clicking Deploy, expand "Environment Variables"
   and add these FOUR variables:

   DATABASE_URL              = (your Supabase URI from Step 1.7)
   SUPABASE_URL              = (Project URL from Step 1.10)
   SUPABASE_SERVICE_ROLE_KEY = (service_role key from Step 1.10)
   SUPABASE_BUCKET           = rch-tv-photos

5. Click "Deploy"
6. Wait ~2 minutes

========================================
  STEP 5 — You are live!
========================================
Vercel gives you a URL like: https://rch-tv.vercel.app

  Public app:  https://rch-tv.vercel.app
  DJ Console:  https://rch-tv.vercel.app/dj
  TV Source:   https://rch-tv.vercel.app/tv

== Custom domain (optional) ==
Vercel → Project → Settings → Domains → Add your domain

== OBS setup ==
1. Add a Browser Source
2. URL: https://rch-tv.vercel.app/tv
3. Size: 1920 x 1080
4. Tick "Shutdown source when not visible"

== Upload Instagram followers ==
DJ Console → "Upload Dump" → select your IG export JSON

========================================
  NOTES
========================================
- If SUPABASE env vars are missing, the app still works but
  stores photos as base64 in the database (uses more space).
  Adding the Supabase vars is strongly recommended.
- The database schema push (Step 2) must succeed before the
  app can read/write data.
- Fonts are all free for commercial use (Gochi Hand etc.).
