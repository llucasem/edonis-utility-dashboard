/**
 * Script de autorización Gmail (OAuth 2.0) — uso único
 *
 * Cómo funciona:
 *   1. Este script genera una URL de autorización
 *   2. Manda esa URL a Edonis por WhatsApp
 *   3. Edonis hace login con su cuenta de Google
 *   4. Su navegador mostrará un error (normal) pero la URL tendrá un código
 *   5. Edonis te manda esa URL completa
 *   6. La pegas aquí en la terminal y el script hace el resto
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const readline = require('readline');

// ── Leer credenciales ──────────────────────────────────────────────────────────
const credsPath = path.join(process.cwd(), 'Secret Key.com.json');

if (!fs.existsSync(credsPath)) {
  console.error('\n❌  No se encontró el archivo de credenciales.\n');
  process.exit(1);
}

const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
const { client_id, client_secret } = creds.installed || creds.web;

// ── Configuración ──────────────────────────────────────────────────────────────
const REDIRECT_URI = 'http://localhost';
const SCOPE        = 'https://www.googleapis.com/auth/gmail.readonly';

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(client_id)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

// ── Mostrar URL para mandar a Edonis ───────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  PASO 1 — Manda esta URL a Edonis por WhatsApp:');
console.log('══════════════════════════════════════════════════════════════\n');
console.log(authUrl);
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  PASO 2 — Cuando Edonis haga login, su navegador mostrará');
console.log('  un error de conexión. Eso es NORMAL.');
console.log('  Dile que copie la URL completa que ve en la barra del');
console.log('  navegador y te la mande.');
console.log('  Esa URL empieza por: http://localhost/?code=...');
console.log('══════════════════════════════════════════════════════════════\n');

// ── Esperar que el usuario pegue la URL de respuesta ──────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('  PASO 3 — Pega aquí la URL que te mandó Edonis y pulsa Enter:\n\n  > ', (input) => {
  rl.close();

  let code;
  try {
    const url = new URL(input.trim());
    code = url.searchParams.get('code');
  } catch {
    // Quizás pegaron solo el código directamente
    code = input.trim();
  }

  if (!code) {
    console.error('\n❌  No se encontró el código en la URL. Inténtalo de nuevo.\n');
    process.exit(1);
  }

  console.log('\n⏳  Intercambiando código por token...\n');

  // ── Intercambiar código por tokens ─────────────────────────────────────────
  const postData = new URLSearchParams({
    code,
    client_id,
    client_secret,
    redirect_uri: REDIRECT_URI,
    grant_type:   'authorization_code',
  }).toString();

  const options = {
    hostname: 'oauth2.googleapis.com',
    path:     '/token',
    method:   'POST',
    headers:  {
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const tokenReq = https.request(options, (tokenRes) => {
    let data = '';
    tokenRes.on('data', chunk => { data += chunk; });
    tokenRes.on('end', () => {
      const tokens = JSON.parse(data);

      if (tokens.error) {
        console.error(`\n❌  Error: ${tokens.error_description}\n`);
        if (tokens.error === 'invalid_grant') {
          console.error('    El código ya fue usado o expiró (duran 10 minutos).');
          console.error('    Vuelve a ejecutar el script y repite el proceso.\n');
        }
        return;
      }

      if (!tokens.refresh_token) {
        console.error('\n❌  No se recibió refresh_token.');
        console.error('    Edonis ya había autorizado antes esta app.');
        console.error('    Solución: dile que vaya a https://myaccount.google.com/permissions');
        console.error('    y revoque el acceso a la app. Luego repetimos.\n');
        return;
      }

      console.log('\n✅  ¡Autorización completada! Añade esto al .env.local:\n');
      console.log('══════════════════════════════════════════════════════════════');
      console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log(`GMAIL_USER=email-de-edonis@sudominio.com`);
      console.log('══════════════════════════════════════════════════════════════');
      console.log('\n⚠️   Cambia "email-de-edonis@sudominio.com" por su email real.\n');
    });
  });

  tokenReq.on('error', (e) => console.error('Error de red:', e.message));
  tokenReq.write(postData);
  tokenReq.end();
});
