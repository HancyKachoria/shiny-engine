# Cursor 2.0 Frontend Dashboard

A modern, dark-mode dashboard for the Unified Deployment Orchestrator.

## Tech Stack

- **Vite** - Fast build tool and dev server
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework

## Features

- 🔍 **Repository Analysis** - Paste a GitHub URL and analyze the project type
- 📋 **Deployment Plan** - View what will be deployed (Neon, Railway, Vercel)
- 🚀 **Full Trinity Deployment** - Deploy to all three platforms with real-time progress
- 📊 **Live Deployment Logs** - See step-by-step deployment progress

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── DeploymentPlan.tsx    # Shows deployment plan cards
│   └── DeploymentLog.tsx     # Real-time deployment progress
├── services/
│   └── mockApi.ts            # Mock API service (replace with real API)
├── App.tsx                   # Main dashboard component
├── main.tsx                  # Entry point
└── index.css                 # Global styles with Tailwind
```

## Mock API

The frontend currently uses a mock API service (`src/services/mockApi.ts`) that simulates:
- Repository analysis
- Deployment planning
- Full trinity deployment with progress updates

To connect to the real backend, replace the mock API calls with actual HTTP requests to your Node.js backend.

## Design

The dashboard features a dark mode aesthetic inspired by Vercel and Linear:
- Dark background (`#0a0a0a`)
- Subtle borders and surfaces
- Smooth transitions and hover effects
- Clean, minimal typography
