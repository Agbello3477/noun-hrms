#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (.env.production / .env)
const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
dotenv.config();

function cleanDbUrl(url) {
  if (!url) return '';
  let str = url.trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str;
}

const dbUrl = cleanDbUrl(process.env.DATABASE_URL);
const directUrl = cleanDbUrl(process.env.DIRECT_URL) || dbUrl;

const env = {
  ...process.env,
  DATABASE_URL: dbUrl,
  DIRECT_URL: directUrl
};

// Attempt Prisma DB Push with exponential backoff retries for cloud/serverless connections
async function runDbSyncWithRetry(maxRetries = 3) {
  const syncDbUrl = directUrl || dbUrl;
  if (!syncDbUrl) {
    console.log('[STARTUP] No DATABASE_URL or DIRECT_URL configured. Skipping database push.');
    return;
  }

  const syncEnv = {
    ...env,
    DATABASE_URL: syncDbUrl
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[STARTUP] Synchronizing Prisma schema to database (Attempt ${attempt}/${maxRetries})...`);
      execSync('npx prisma db push --accept-data-loss', {
        env: syncEnv,
        stdio: 'inherit',
        timeout: 45000 // 45s timeout per attempt
      });
      console.log('[STARTUP] ✅ Database schema synchronized successfully.');
      return;
    } catch (err) {
      console.warn(`[STARTUP] ⚠️ Database push attempt ${attempt} encountered an issue: ${err.message}`);
      if (attempt < maxRetries) {
        const delayMs = attempt * 3000;
        console.log(`[STARTUP] Waiting ${delayMs / 1000}s for database endpoint before retry...`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        console.warn('[STARTUP] ⚠️ Proceeding to boot web server. Runtime connection pool will connect upon first request.');
      }
    }
  }
}

async function startServer() {
  await runDbSyncWithRetry();

  console.log('[STARTUP] 🚀 Launching Express Web Server (node dist/index.js)...');
  const serverProcess = spawn('node', ['dist/index.js'], {
    env,
    stdio: 'inherit'
  });

  const forwardSignal = (signal) => {
    try {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill(signal);
      }
    } catch (e) {}
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  serverProcess.on('exit', (code, signal) => {
    console.log(`[STARTUP] Server process exited with code ${code}, signal ${signal}`);
    process.exit(code || 0);
  });
}

startServer();
