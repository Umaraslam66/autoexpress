# AutoXpress Deployment Guide - Railway

## 🚀 Quick Deploy to Railway

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub (use your https://github.com/Umaraslam66/autoexpress repo)
3. Verify your email

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose `Umaraslam66/autoexpress`
4. Railway will auto-detect the configuration

### Step 3: Add Database Services
Railway will deploy your app, but you need to add databases:

#### Add PostgreSQL:
1. In your project, click "New" → "Database" → "Add PostgreSQL"
2. Railway will automatically set `DATABASE_URL` environment variable
3. Wait for it to provision (1-2 minutes)

#### Add Redis:
1. Click "New" → "Database" → "Add Redis"
2. Railway will automatically set `REDIS_URL` environment variable
3. Wait for it to provision (1-2 minutes)

### Step 4: Add Worker Service
1. Click "New" → "Empty Service"
2. Name it "Worker"
3. Connect to your GitHub repo
4. Set Root Directory: `/`
5. Set Start Command: `npm run start:worker`
6. Add these environment variables (copy from main service):
   - `DATABASE_URL` (from PostgreSQL service)
   - `REDIS_URL` (from Redis service)
   - `SESSION_SECRET`
   - `SCRAPE_MAX_VEHICLES`
   - `SCRAPE_MAX_AUTOXPRESS_PAGES`
   - `SCRAPE_MAX_COMPARABLES_PER_SOURCE`

### Step 5: Configure Environment Variables
Click on your main service → "Variables" and add:

```
DATABASE_URL=<auto-populated by Railway>
REDIS_URL=<auto-populated by Railway>
SESSION_SECRET=your-super-secret-key-change-this-in-production
PORT=8000
SCRAPE_MAX_VEHICLES=50
SCRAPE_MAX_AUTOXPRESS_PAGES=5
SCRAPE_MAX_COMPARABLES_PER_SOURCE=10
AUTOXPRESS_FEED_URL=
```

### Step 6: Run Database Migrations
1. Go to your main service
2. Click "Settings" → "Deploy Trigger"
3. After deployment, go to "Deployments" → Click latest deployment
4. Click "View Logs"
5. Once deployed, open "Terminal" tab
6. Run: `npm run db:push`
7. Run: `npm run db:seed`

### Step 7: Frontend Hosting
The Express API now serves the built Vite frontend from the same Railway web service. In production, `src/config.ts` defaults to same-origin requests, so `VITE_API_URL` is optional unless you intentionally split frontend and backend across different domains.

### Step 8: Enable Public Networking
1. Go to Settings → Networking
2. Click "Generate Domain"
3. Your app will be live at: `https://your-app.railway.app`

## 🔄 Alternative: Deploy Frontend Separately

If you want faster frontend performance:

### Option A: Deploy Frontend to Vercel
1. Create a new Vercel project
2. Connect to your GitHub repo
3. Set Build Command: `npm run build`
4. Set Output Directory: `dist`
5. Add Environment Variable: `VITE_API_URL=https://your-railway-backend.railway.app`

### Option B: Deploy Frontend to Netlify
1. Create a new Netlify site
2. Connect to your GitHub repo
3. Set Build Command: `npm run build`
4. Set Publish Directory: `dist`
5. Add Environment Variable: `VITE_API_URL=https://your-railway-backend.railway.app`

## 📝 Important Notes

### Railway Free Tier Limits:
- $5 credit per month (renews monthly)
- Should be enough for development/demo
- Upgrade to Pro ($20/month) for production

### Services Required:
1. **Main API Server** - Handles HTTP requests
2. **Worker** - Handles background scraping jobs
3. **PostgreSQL** - Database
4. **Redis** - Queue and caching

### Environment Variables Reference:
- `DATABASE_URL` - Auto-populated by Railway PostgreSQL
- `REDIS_URL` - Auto-populated by Railway Redis
- `SESSION_SECRET` - Generate with: `openssl rand -base64 32`
- `PORT` - Railway sets this automatically, use 8000 as fallback
- `SCRAPE_MAX_VEHICLES` - Number of vehicles to scrape (default: 50)
- `SCRAPE_MAX_AUTOXPRESS_PAGES` - Pages to scrape from AutoXpress (default: 5)
- `SCRAPE_MAX_COMPARABLES_PER_SOURCE` - Comparables per competitor site (default: 10)

### Monitoring:
- Check logs in Railway dashboard
- Monitor memory/CPU usage
- Set up alerts for failures

### Troubleshooting:

**Build fails:**
- Check build logs in Railway
- Ensure all dependencies are in `package.json`
- Verify TypeScript compiles locally

**Database connection fails:**
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL service is running
- Run `npm run db:push` to sync schema

**Scraping fails:**
- Check if Playwright is installed (should happen in build step)
- Verify memory limits (Railway default: 512MB, may need upgrade)
- Check scraping logs in worker service

**Worker not processing jobs:**
- Verify `REDIS_URL` is correct in worker service
- Check worker service logs
- Ensure worker service is deployed and running

## 🎯 Post-Deployment Checklist

- [ ] Main API service is running
- [ ] Worker service is running
- [ ] PostgreSQL is provisioned
- [ ] Redis is provisioned
- [ ] Database schema is pushed (`npm run db:push`)
- [ ] Database is seeded (`npm run db:seed`)
- [ ] Environment variables are set
- [ ] Public domain is generated
- [ ] Can access frontend at Railway URL
- [ ] Can login with default credentials
- [ ] Scraping jobs are processing
- [ ] Data is appearing in the dashboard

## 🔐 Default Credentials

After seeding:
- Admin: `admin@autoxpress.ie` / `autoxpress`
- Manager: `pricing@autoxpress.ie` / `autoxpress`

**IMPORTANT:** Change these in production!

## 📞 Support

If you encounter issues:
1. Check Railway logs
2. Verify all environment variables
3. Ensure all services are running
4. Check GitHub repo is up to date
