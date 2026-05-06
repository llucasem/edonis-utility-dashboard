/**
 * Generate the QuickBooks authorization URL (no input expected).
 * Run with: node scripts/qb-auth-url.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = join(__dirname, '..', '.env.local');
const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const CLIENT_ID    = env['QB_CLIENT_ID'];
const REDIRECT_URI = env['QB_REDIRECT_URI'] || 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl';
const QB_ENV       = (env['QB_ENV'] || 'production').toLowerCase();

if (!CLIENT_ID) {
  console.error('❌  QB_CLIENT_ID missing in .env.local');
  process.exit(1);
}

const SCOPE = 'com.intuit.quickbooks.accounting';
const STATE = Math.random().toString(36).substring(2);

const url =
  'https://appcenter.intuit.com/connect/oauth2' +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&state=${STATE}`;

console.log(`Environment:  ${QB_ENV.toUpperCase()}`);
console.log(`Client ID:    ${CLIENT_ID.slice(0, 12)}…  (${CLIENT_ID.length} chars)`);
console.log(`Redirect:     ${REDIRECT_URI}`);
console.log('');
console.log('AUTHORIZATION URL (give this to Edonis):');
console.log('');
console.log(url);
