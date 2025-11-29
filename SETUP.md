# StyleGenie AI Try-On - Setup Guide

## 🎯 Overview

This app works in **TWO environments**:
1. **Local Development** - Test on your machine
2. **Vercel Production** - Share online demo link

---

## 📋 Prerequisites

- Node.js 18+ installed
- Vercel CLI installed: `npm i -g vercel`
- API Keys (see below)

---

## 🔑 Step 1: Environment Variables

### Create `.env.local` file in project root:

```env
# Required - Google Gemini API Key
API_KEY=your_gemini_api_key_here

# Required - Replicate API Token (for face swap)
REPLICATE_API_TOKEN=your_replicate_api_token_here

# Optional - Supabase (app works without it)
# SUPABASE_URL=your_supabase_url
# SUPABASE_ANON_KEY=your_supabase_key
```

**Important:** `.env.local` is gitignored - it won't be pushed to GitHub.

---

## 🏠 Step 2: Local Development

### Option A: Full Stack (Recommended - API routes work)

```bash
# Run both frontend + backend together
npm run dev:full
# OR
vercel dev
```

**Access:** `http://localhost:3000`

**Features:**
- ✅ Frontend works
- ✅ API routes work (`/api/swap-init`, `/api/swap-status`)
- ✅ Face swap works
- ✅ All features enabled

### Option B: Frontend Only (Quick testing)

```bash
# Run only frontend
npm run dev
```

**Access:** `http://localhost:5173`

**Features:**
- ✅ Frontend works
- ⚠️ API routes won't work (404 errors)
- ⚠️ Face swap will be skipped (graceful fallback)
- ✅ Other features work

---

## 🚀 Step 3: Deploy to Vercel (For Online Demo)

### 3.1 Push to GitHub

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 3.2 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository: `vangaalg/stylo2`
4. **Add Environment Variables** (Settings → Environment Variables):
   - `API_KEY` = Your Gemini API key
   - `REPLICATE_API_TOKEN` = Your Replicate API token
   - `SUPABASE_URL` = (Optional)
   - `SUPABASE_ANON_KEY` = (Optional)
5. Click **"Deploy"**

### 3.3 Your App Will Be Live At:

```
https://stylo2.vercel.app
```

**Features:**
- ✅ Everything works
- ✅ API routes work
- ✅ Face swap works
- ✅ Shareable demo link

---

## 📁 Project Structure

```
├── api/                    # Vercel serverless functions
│   ├── swap-init.ts       # Start face swap
│   └── swap-status.ts    # Check face swap status
├── components/            # React components
├── services/             # API services
│   ├── geminiService.ts  # Gemini AI integration
│   └── replicateService.ts # Replicate face swap
├── .env.local            # Local environment variables (gitignored)
├── vercel.json           # Vercel configuration
└── vite.config.ts        # Vite configuration
```

---

## 🔧 Troubleshooting

### Issue: Face swap not working locally

**Solution:** Use `npm run dev:full` instead of `npm run dev`

### Issue: Environment variables not loading

**Solution:** 
- Make sure `.env.local` is in project root
- Restart dev server after changing `.env.local`
- Check variable names match exactly

### Issue: Build fails on Vercel

**Solution:**
- Check environment variables are set in Vercel dashboard
- Check build logs in Vercel for errors
- Make sure all dependencies are in `package.json`

### Issue: API routes return 404

**Solution:**
- Local: Use `vercel dev` not `npm run dev`
- Production: Check `vercel.json` configuration

---

## ✅ Testing Checklist

### Local Testing:
- [ ] App loads at `http://localhost:3000` (or 5173)
- [ ] Can upload face photo
- [ ] Can upload clothing photo
- [ ] Age/Height inputs appear
- [ ] Images generate (may take 1-3 minutes)
- [ ] Face swap works (if using `vercel dev`)

### Production Testing:
- [ ] App loads at Vercel URL
- [ ] All features work
- [ ] Face swap works
- [ ] Can share link with others

---

## 🎉 You're All Set!

- **Local:** Test with `npm run dev:full`
- **Production:** Deploy to Vercel and share your demo link!

