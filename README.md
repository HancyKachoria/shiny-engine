# 🚀 Cursor 2.0 - Unified Deployment Orchestrator

Welcome to **Cursor 2.0**, the intelligent deployment orchestrator that automatically detects your project type and deploys it to the perfect platform. Deploy your full-stack applications to **Neon** (Database), **Railway** (Backend), and **Vercel** (Frontend) with a single command.

![Cursor 2.0](https://img.shields.io/badge/Cursor-2.0-blue?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=for-the-badge&logo=typescript)
![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)

## ✨ Features

- **🔍 Intelligent Discovery**: Automatically detects project type (Frontend/Backend/Database) by analyzing file signatures
- **🚀 Full Trinity Deployment**: Deploys to Neon → Railway → Vercel in perfect sequence
- **🔄 Automatic Rollback**: Cleans up resources if deployment fails (no charges for broken infrastructure)
- **📊 Real-time Progress**: Live deployment updates via Server-Sent Events
- **🎨 Beautiful Dashboard**: Modern dark-mode UI with confetti celebrations
- **📋 Deployment History**: Access your last 5 deployments instantly
- **🎯 Streamlit Optimizer**: Automatic Railway configuration for Streamlit apps

## 🎯 Quick Start

### Prerequisites

Before you begin, make sure you have:

- **Node.js 18+** and npm installed
- **Three API keys** from your accounts:
  1. **Vercel Token** - [Get it here](https://vercel.com/account/tokens)
  2. **Railway API Key** - [Get it here](https://railway.app/account/api)
  3. **Neon API Key** - [Get it here](https://console.neon.tech/app/api)

### Installation

1. **Clone the repository and install dependencies:**

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

2. **Create a `.env` file in the root directory:**

```bash
cp .env.example .env
```

3. **Add your API keys to `.env`:**

```env
# Required API Keys
VERCEL_TOKEN=your_vercel_token_here
RAILWAY_API_KEY=your_railway_api_key_here
NEON_API_KEY=your_neon_api_key_here

# Optional Configuration
PORT=3000
FRONTEND_URL=http://localhost:5173
```

> **💡 Pro Tip**: Never commit your `.env` file! It's already in `.gitignore` for your safety.

### Running the Application

**Launch everything with one command:**

```bash
npm run dev
```

This will start:
- 🖥️ **Backend API Server** on `http://localhost:3000`
- 🎨 **Frontend Dashboard** on `http://localhost:5173`

Both services run with hot-reload enabled, so changes will update automatically!

**Individual services:**

```bash
# Backend only (with auto-reload)
npm run server:dev

# Frontend only
npm run frontend:dev

# CLI tool (for command-line deployments)
npm run cli
```

## 📖 Usage Guide

### Using the Dashboard

1. **Open the dashboard**: Navigate to `http://localhost:5173`
2. **Enter GitHub URL**: Paste your repository URL (e.g., `https://github.com/username/repo`)
3. **Analyze**: Click "Analyze" to detect your project type
4. **Review Plan**: See what will be deployed (Neon, Railway, Vercel)
5. **Deploy**: Click "Deploy Full Trinity" and watch the magic happen!
6. **Celebrate**: Confetti 🎉 when deployment completes successfully
7. **Access History**: Click "History" button to see your recent deployments

### Using the CLI

```bash
# Test discovery (no deployment)
npm run cli test-discovery https://github.com/user/repo.git

# Deploy (dry-run mode - safe testing)
npm run cli deploy https://github.com/user/repo.git "My Project" "My Service" --full-trinity --dry-run

# Real deployment
npm run cli deploy https://github.com/user/repo.git "My Project" "My Service" --full-trinity
```

## 🏗️ How It Works

### Discovery Phase

Cursor 2.0 analyzes your repository by:
- Scanning file signatures (`next.config.js`, `Dockerfile`, `prisma/schema.prisma`, etc.)
- Reading `package.json` for framework dependencies
- Detecting Python apps (including Streamlit)
- Calculating confidence scores for each project type

### Deployment Flow

When you deploy **Full Trinity**:

1. **💚 Neon (Database)**: Creates PostgreSQL database and retrieves `DATABASE_URL`
2. **🚂 Railway (Backend)**: Creates backend service, connects GitHub, and receives `DATABASE_URL`
3. **▲ Vercel (Frontend)**: Creates frontend project, connects GitHub, and receives Railway API URL

All deployments happen sequentially with automatic URL piping between services!

### Automatic Rollback

If any step fails:
- ✅ All created resources are automatically deleted
- ✅ You won't be charged for broken infrastructure
- ✅ Clear error messages explain what went wrong
- ✅ Full cleanup happens in reverse order

## 🎨 Special Features

### Streamlit Optimizer

When a Streamlit app is detected, Railway is automatically configured with:
- `PORT=8501`
- `STREAMLIT_SERVER_PORT=8501`
- `STREAMLIT_SERVER_ADDRESS=0.0.0.0`

This ensures your Streamlit app works perfectly on Railway! 🎯

### Deployment History

- Access your last 5 deployments instantly
- Quick links to all deployed URLs
- Persistent storage (survives browser refresh)
- One-click access to your live applications

## 📁 Project Structure

```
cursor2.0/
├── src/
│   ├── services/          # Core orchestration services
│   │   ├── discovery.ts   # Repository analysis
│   │   ├── orchestrator.ts # Main deployment logic
│   │   ├── neon.ts        # Neon provisioning
│   │   ├── railway.ts     # Railway provisioning
│   │   └── vercel.ts      # Vercel provisioning
│   ├── lib/               # API client wrappers
│   └── types/             # TypeScript definitions
├── server/
│   └── index.ts           # Express API server (SSE support)
├── frontend/
│   └── src/
│       ├── components/    # React components
│       │   ├── Logo.tsx
│       │   ├── DeploymentPlan.tsx
│       │   ├── DeploymentLog.tsx
│       │   └── DeploymentHistory.tsx
│       └── services/      # Frontend API service
└── package.json           # Root configuration
```

## 🔧 API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-12T12:00:00.000Z"
}
```

### `POST /api/analyze`
Analyzes a GitHub repository.

**Request:**
```json
{
  "githubUrl": "https://github.com/owner/repo"
}
```

**Response:**
```json
{
  "type": "backend",
  "confidence": 0.92,
  "indicators": ["Dockerfile", "requirements.txt"],
  "metadata": {
    "framework": "streamlit",
    "runtime": "python",
    "isStreamlit": true
  }
}
```

### `GET /api/deploy`
Deploys with real-time progress via Server-Sent Events.

**Query Parameters:**
- `githubUrl` - Repository URL
- `projectName` - Optional project name
- `serviceName` - Optional service name
- `fullTrinity` - Set to "true" for full deployment
- `dryRun` - Set to "true" for testing

**Events:**
- `progress` - Deployment step updates
- `complete` - Deployment finished successfully
- `error` - Deployment failed (with rollback info)
- `close` - Connection closed

## 🛡️ Security Best Practices

- ✅ API keys stored in `.env` (never committed)
- ✅ CORS protection for API endpoints
- ✅ Automatic resource cleanup on failure
- ✅ No hardcoded credentials
- ✅ Environment variable validation

## 🐛 Troubleshooting

### "API key is invalid" errors

1. Verify your API keys in `.env` are correct
2. Check that keys haven't expired
3. Ensure proper permissions on your accounts
4. Run health checks: The dashboard will verify keys before deployment

### Deployment fails

- Check the error message in the dashboard
- All resources are automatically rolled back
- Review the deployment log for specific step failures
- Try a dry-run first: `--dry-run` flag

### Frontend can't connect to backend

- Ensure both services are running (`npm run dev`)
- Check that backend is on port 3000
- Verify `VITE_API_URL` in `frontend/.env` if customized

## 📚 Additional Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Railway Documentation**: https://docs.railway.app
- **Neon Documentation**: https://neon.tech/docs

## 🤝 Contributing

Contributions are welcome! This is an open-source project built for the developer community.

## 📄 License

ISC

## 🎉 Get Started Now!

1. Install dependencies: `npm install && cd frontend && npm install && cd ..`
2. Set up `.env` with your API keys
3. Run `npm run dev`
4. Deploy your first app! 🚀

---

**Built with ❤️ for developers who love simplicity and power.**
