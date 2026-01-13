# Backend API Server

Express.js API server for the Unified Deployment Orchestrator.

## Endpoints

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
Analyzes a GitHub repository and returns project blueprint.

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
  "indicators": ["Dockerfile", "package.json: express"],
  "metadata": {
    "framework": "express",
    "runtime": "node",
    "packageManager": "npm"
  }
}
```

### `POST /api/deploy`
Deploys using Server-Sent Events (SSE) for real-time progress updates.

**Request:**
```json
{
  "githubUrl": "https://github.com/owner/repo",
  "projectName": "My Project",
  "serviceName": "My Service",
  "fullTrinity": true,
  "dryRun": false
}
```

**Response:** Server-Sent Events stream

**Event Types:**
- `progress` - Deployment progress updates
- `complete` - Deployment completed successfully
- `error` - Deployment failed

**Progress Event Data:**
```json
{
  "step": 4,
  "total": 11,
  "message": "Creating Neon database project...",
  "platform": "neon",
  "timestamp": 1705060800000
}
```

**Complete Event Data:**
```json
{
  "success": true,
  "deployments": {
    "neon": {
      "projectId": "...",
      "databaseUrl": "postgresql://..."
    },
    "railway": {
      "projectId": "...",
      "serviceId": "...",
      "url": "https://..."
    },
    "vercel": {
      "projectId": "...",
      "projectUrl": "https://..."
    }
  }
}
```

## Environment Variables

Required in `.env` file:

```env
# API Keys
RAILWAY_API_KEY=your_railway_api_key
NEON_API_KEY=your_neon_api_key
VERCEL_TOKEN=your_vercel_token

# Server Configuration
PORT=3000
FRONTEND_URL=http://localhost:5173
```

## Running the Server

```bash
# Development mode (with watch)
npm run server:dev

# Production mode
npm run build
npm run server
```

## CORS

CORS is enabled for the frontend URL specified in `FRONTEND_URL` environment variable (default: `http://localhost:5173`).
