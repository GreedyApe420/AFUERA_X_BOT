import crypto from 'crypto';
import open from 'open';
import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs';
import axios from 'axios';

dotenv.config();

const CLIENT_ID = process.env.X_CLIENT_ID;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/callback';
const SCOPES = 'tweet.read tweet.write users.read follows.write offline.access';

// 🔐 Génération PKCE
function base64URLEncode(buffer) {
  return buffer.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generatePKCE() {
  const verifier = base64URLEncode(crypto.randomBytes(32));
  const challenge = base64URLEncode(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

const { verifier, challenge } = generatePKCE();

// 🔗 Génération de l’URL d’autorisation
const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('state', 'afuera_bot');
authUrl.searchParams.set('code_challenge', challenge);
authUrl.searchParams.set('code_challenge_method', 'S256');

console.log(`➡️ Ouvre cette URL :\n${authUrl.href}\n`);
open(authUrl.href);

// 🔁 Serveur pour capter le redirect
http.createServer(async (req, res) => {
  if (!req.url.startsWith('/callback')) return;

  const url = new URL(`http://localhost:3000${req.url}`);
  const code = url.searchParams.get('code');

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('✅ Autorisation réussie, vous pouvez fermer cette fenêtre.');

  try {
    const response = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: verifier
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token } = response.data;

    const envContent = fs.readFileSync('.env', 'utf8')
      .replace(/^X_ACCESS_TOKEN=.*$/m, '')
      .replace(/^X_REFRESH_TOKEN=.*$/m, '')
      .trim() + `\nX_ACCESS_TOKEN=${access_token}\nX_REFRESH_TOKEN=${refresh_token}\n`;

    fs.writeFileSync('.env', envContent);
    console.log('✅ Tokens sauvegardés dans .env');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur :', err.response?.data || err.message);
    process.exit(1);
  }
}).listen(3000, () => {
  console.log('⏳ Serveur lancé sur http://localhost:3000/callback');
});
