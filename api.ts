import { Hono } from '@hono/hono';
import { cors } from '@hono/hono/cors';
import { type CliResult, runCli } from './cli.ts'; // Import core logic

// Define expected structure for the POST request body
interface CreatePrPayload
{
  githubOrg: string;
  repoName: string;
  baseBranch: string;
  prTitle: string;
  prBody?: string; // Optional
  prLabels?: string; // Optional, comma-separated
  proposedChanges: Record<string, unknown>; // Required, but can be empty object {}
  dryRun?: boolean; // Optional
}

// --- Constants & Config ---
const PR_MAKER_PORT = Number(Deno.env.get('PR_MAKER_PORT') || '8000');
const PR_MAKER_GITHUB_TOKEN = Deno.env.get('PR_MAKER_GITHUB_TOKEN');
const PR_MAKER_CORS_DEFAULT_ORGIN = Deno.env.get('PR_MAKER_CORS_DEFAULT_ORGIN') || 'https://default.origin.axhxrx.com';
const PR_MAKER_CORS_ORIGIN_ENDS_WITH = Deno.env.get('PR_MAKER_CORS_ORIGIN_ENDS_WITH') || '.axhxrx.com';

// const HONO_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
// const HONO_RATE_LIMIT_MAX_REQUESTS = 20;

// --- Hono App Setup ---
const app = new Hono();

// --- Middleware ---
app.use(
  '/*',
  cors({
    origin: (origin, _c) =>
    {
      const isLocalHost = origin.startsWith('http://localhost')
        || origin.startsWith('http://127.0.0.1')
        || origin.startsWith('http://0.0.0.0')
        || origin.startsWith('http://::1');

      const isAllowedRemoteHost = origin.endsWith(PR_MAKER_CORS_DEFAULT_ORGIN)
        || origin.endsWith(PR_MAKER_CORS_ORIGIN_ENDS_WITH);

      return isLocalHost || isAllowedRemoteHost
        ? origin
        : PR_MAKER_CORS_DEFAULT_ORGIN;
    },
  }),
);
// // 1. Rate Limiter (per IP)
// const limiter = rateLimiter({
//   windowMs: HONO_RATE_LIMIT_WINDOW_MS,
//   limit: HONO_RATE_LIMIT_MAX_REQUESTS,
//   standardHeaders: 'draft-6', // Recommended RateLimit header standard
//   keyGenerator: (c) =>
//   {
//     // Use IP address for rate limiting
//     const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || c.env?.remoteAddr?.hostname || 'unknown';
//     // console.log(`Rate limiting key: ${ip}`); // Debugging
//     return ip;
//   },
//   message: (c) =>
//   {
//     return c.json({ success: false, error: 'Too many requests, please try again later.' }, 429);
//   },
// });
// app.use('*', limiter); // Apply to all routes

// 2. Basic Error Handling
app.onError((err, c) =>
{
  console.error(`[Hono Error] ${err}`, err.stack);
  return c.json({ success: false, error: 'Internal Server Error' }, 500);
});

// --- Routes ---

app.post('/create-pr', async (c) =>
{
  console.log(`[${new Date().toISOString()}] Received POST /create-pr`);

  // Check for GitHub Token (Server Configuration)
  if (!PR_MAKER_GITHUB_TOKEN)
  {
    console.error('FATAL: GITHUB_TOKEN environment variable is not set.');
    return c.json({ success: false, error: 'Server configuration error: Missing GitHub token.' }, 500);
  }

  let payload: CreatePrPayload; // Use the specific interface type
  try
  {
    payload = await c.req.json(); // Parse as default 'any' first
  }
  catch (_e)
  { // Prefix unused variable with _
    return c.json({ success: false, error: 'Invalid JSON payload.' }, 400);
  }

  console.log('Received Payload:', JSON.stringify(payload)); // Log received payload

  // --- Payload Validation (Revised for type safety) ---
  const errors: string[] = [];

  if (!payload.githubOrg || typeof payload.githubOrg !== 'string')
  {
    errors.push('Missing or invalid required field: githubOrg (must be a non-empty string)');
  }
  if (!payload.repoName || typeof payload.repoName !== 'string')
  {
    errors.push('Missing or invalid required field: repoName (must be a non-empty string)');
  }
  if (!payload.baseBranch || typeof payload.baseBranch !== 'string')
  {
    errors.push('Missing or invalid required field: baseBranch (must be a non-empty string)');
  }
  if (!payload.prTitle || typeof payload.prTitle !== 'string')
  {
    errors.push('Missing or invalid required field: prTitle (must be a non-empty string)');
  }
  if (!payload.proposedChanges || typeof payload.proposedChanges !== 'object'
    || payload.proposedChanges === null)
  {
    errors.push('Missing or invalid required field: proposedChanges (must be an object)');
  }
  // Optional fields validation (type check if present)
  if (payload.prBody !== undefined && typeof payload.prBody !== 'string')
  {
    errors.push('Invalid optional field: prBody (must be a string if provided)');
  }
  if (payload.prLabels !== undefined && typeof payload.prLabels !== 'string')
  {
    errors.push('Invalid optional field: prLabels (must be a string if provided)');
  }
  if (payload.dryRun !== undefined && typeof payload.dryRun !== 'boolean')
  {
    errors.push('Invalid optional field: dryRun (must be a boolean if provided)');
  }

  if (errors.length > 0)
  {
    return c.json({ success: false, error: `Validation failed: ${errors.join('; ')}` }, 400);
  }

  // --- Prepare Args for runCli ---
  const argsOverride: string[] = [
    '--yes', // Automatically confirm prompts
    '--githubToken',
    PR_MAKER_GITHUB_TOKEN, // Pass token securely
    '--githubOrg',
    payload.githubOrg,
    '--repoName',
    payload.repoName,
    '--baseBranch',
    payload.baseBranch,
    '--prTitle',
    payload.prTitle,
  ];

  if (payload.prBody && typeof payload.prBody === 'string')
  {
    argsOverride.push('--prBody', payload.prBody);
  }
  if (payload.prLabels && typeof payload.prLabels === 'string')
  {
    argsOverride.push('--prLabels', payload.prLabels);
  }
  if (payload.dryRun === true)
  {
    argsOverride.push('--dryRun');
  }

  // --- Execute Core Logic ---
  console.log('Calling runCli with args:', argsOverride.filter(arg => arg !== PR_MAKER_GITHUB_TOKEN)); // Don't log token
  try
  {
    const result: CliResult = await runCli(argsOverride, payload.proposedChanges);

    if (result.exitCode === 0)
    {
      console.log('runCli finished successfully. PR URL:', result.prUrl);
      return c.json({ success: true, prUrl: result.prUrl }, 200);
    }
    else
    {
      console.error('runCli failed:', result.error);
      // Use the error message from runCli if available
      const errorMessage = result.error || 'Failed to create pull request due to an internal error.';
      return c.json({ success: false, error: errorMessage }, 500);
    }
  }
  catch (error)
  {
    console.error('Unexpected error calling runCli:', error);
    return c.json({ success: false, error: 'An unexpected error occurred while processing the request.' }, 500);
  }
});

// Health check endpoint
app.get('/', (c) => c.text('PR Maker API is running!'));

// --- Start Server ---
// Read cert and key for HTTPS
let cert: string;
let key: string;
try
{
  cert = await Deno.readTextFile('./cert.pem');
  key = await Deno.readTextFile('./key.pem');
}
catch (error)
{
  console.error(`
    SSL setup error: This project requires a certificate and key to run in HTTPS mode. 
    
    The files 'cert.pem' and 'key.pem' must exist in the current directory. 
    
    A command something like the following might be able to generate them, but this depends, so do your own research:

    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes -subj "/CN=localhost"

    `);
  console.error(`Failed to read certificate or key: ${error}`);
  Deno.exit(1);
}

console.log(`PR Maker API server starting on https://localhost:${PR_MAKER_PORT}`);
console.log(
  `PR Maker API server allowing CORS for origins ending with ${PR_MAKER_CORS_ORIGIN_ENDS_WITH} (and localhost and equivalent, which are always allowed)`,
);

Deno.serve({
  port: PR_MAKER_PORT,
  cert: cert, // Add cert option
  key: key, // Add key option
}, app.fetch);
