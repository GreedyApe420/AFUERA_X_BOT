import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import logger from './utils/logger.js';
import { initOpenAI, generateResponse } from './lib/openaiClient.js';
import {
  initXApi,
  fetchRecentTweets,
  replyToTweet,
  fetchReplies
} from './lib/xApi.js';
import Bottleneck from 'bottleneck';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const MAX_REPLIES_PER_TWEET = 1;
const ACCOUNTS_PATH = path.resolve('./accounts.txt');
const REPLIED_PATH = path.resolve('./replied.json');
const EMOJIS = ['🔥', '👀', '😂', '💀', '🥶', '🚫', '🫠', '🤡'];

// === Chargement ou initialisation des tweets déjà traités ===
let repliedTo = new Set();
if (fs.existsSync(REPLIED_PATH)) {
  try {
    repliedTo = new Set(JSON.parse(fs.readFileSync(REPLIED_PATH, 'utf8')));
  } catch {
    repliedTo = new Set();
  }
}
function saveReplied() {
  fs.writeFileSync(REPLIED_PATH, JSON.stringify([...repliedTo], null, 2));
}

// === Vérification ENV ===
if (!process.env.X_ACCESS_TOKEN || !process.env.X_SELF_USER_ID) {
  logger.error('❌ Token Twitter ou ID manquant dans .env');
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  logger.error('❌ Clé API OpenAI manquante dans .env');
  process.exit(1);
}

// === Initialisations ===
initOpenAI(process.env.OPENAI_API_KEY);
initXApi({
  accessToken: process.env.X_ACCESS_TOKEN,
  selfUserId: process.env.X_SELF_USER_ID
});

// === Limiteurs ===
const tweetLimiter = new Bottleneck.Group({ minTime: 120_000 });
const postLimiter = new Bottleneck({
  minTime: 360_000,
  maxConcurrent: 1,
  highWater: 1,
  strategy: Bottleneck.strategy.OVERFLOW
});

const lastSeen = new Map();
let nextAllowedTime = 0;
let totalRepliesSent = 0;
let totalGetCalls = 0;
let totalPostCalls = 0;

// === Chargement des comptes ===
const handles = fs.existsSync(ACCOUNTS_PATH)
  ? fs.readFileSync(ACCOUNTS_PATH, 'utf8')
      .split(/\r?\n/)
      .map(h => h.trim().replace(/^@/, ''))
      .filter(Boolean)
  : [];

if (!handles.length) {
  logger.error('⚠️ Aucun handle trouvé dans accounts.txt');
  process.exit(1);
}

logger.info(`✅ Booting bot for ${handles.length} handle(s)…`);

// === Polling principal ===
setInterval(async () => {
  const now = Date.now();
  if (now < nextAllowedTime) {
    const wait = Math.ceil((nextAllowedTime - now) / 1000);
    logger.warn(`⏳ Waiting for rate-limit reset (${wait}s)`);
    return;
  }

  for (const handle of handles) {
    tweetLimiter.key(handle).schedule(async () => {
      try {
        logger.debug(`🔎 Polling @${handle}`);
        totalGetCalls++;
        const tweets = await fetchRecentTweets(handle, lastSeen.get(handle));
        logApiUsage();

        if (!tweets.length) return;

        await sleepFixed(10_000);
        lastSeen.set(handle, tweets[0].id);

        for (const tweet of tweets.reverse()) {
          await handleTweet(tweet);
          await sleepFixed(60_000);
        }
      } catch (err) {
        handleRateLimit(err, 'Polling');
      }
    });
  }
}, POLL_INTERVAL_MS);

// === Traitement d’un tweet ===
async function handleTweet(tweet) {
  try {
    if (repliedTo.has(tweet.id)) return;
    logger.info(`🆕 New tweet from @${tweet.author_username}: ${tweet.id}`);

    if (Math.random() < 0.7) {
      logger.debug(`⏭ Tweet ignoré pour limiter les appels`);
      return;
    }

    const joke = await generateResponse(`Fais une punchline drôle, sarcastique et courte en français en réaction à ce tweet : "${tweet.text}"`);
    const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    const message = `AFUERA 🪓 ${joke.trim()} ${emoji}`;

    await sleepRandom();
    await postLimiter.schedule(() => replyToTweet(message, tweet.id));
    repliedTo.add(tweet.id);
    saveReplied();
    totalRepliesSent++;
    totalPostCalls++;
    logger.info(`📤 Replied — Total sent: ${totalRepliesSent}`);
    logApiUsage();

    const replies = await tweetLimiter.key(tweet.author_username).schedule(() => {
      totalGetCalls++;
      return fetchReplies(tweet.id, MAX_REPLIES_PER_TWEET);
    });
    logApiUsage();

    for (const reply of replies.slice(0, MAX_REPLIES_PER_TWEET)) {
      if (repliedTo.has(reply.id)) continue;
      if (reply.author_id === process.env.X_SELF_USER_ID) continue;
      if (reply.conversation_id === tweet.id || repliedTo.has(reply.conversation_id)) continue;

      logger.debug(`💬 Reply detected: ${reply.text}`);

      try {
        const ai = await generateResponse(reply.text);
        await sleepRandom();
        await postLimiter.schedule(() => replyToTweet(ai, reply.id));
        repliedTo.add(reply.id);
        saveReplied();
        totalRepliesSent++;
        totalPostCalls++;
        logger.info(`🤖 Replied to comment — Total sent: ${totalRepliesSent}`);
        logApiUsage();
      } catch (err) {
        logger.warn(`⚠️ AI/reply error on ${reply.id}: ${JSON.stringify(err.response?.data || err.message)}`);
      }
    }
  } catch (err) {
    handleRateLimit(err, 'handleTweet');
  }
}

// === Gestion des rate-limits ===
function handleRateLimit(err, context = 'unknown') {
  const resetAt = err?.response?.headers?.['x-rate-limit-reset'];
  if (err?.response?.status === 429 && resetAt) {
    const waitUntil = parseInt(resetAt, 10) * 1000;
    nextAllowedTime = waitUntil;
    const waitSec = Math.ceil((waitUntil - Date.now()) / 1000);
    const readable = new Date(waitUntil).toLocaleTimeString();
    logger.warn(`⛔️ Rate limit hit in ${context}. Pausing for ${waitSec}s (until ${readable})…`);
  } else {
    logger.error(`❌ ${context} error: ${JSON.stringify(err.response?.data || err.message)}`);
  }
}

// === Fonctions utilitaires ===
function sleepRandom(min = 1000, max = 3000) {
  return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min)) + min));
}
function sleepFixed(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function logApiUsage() {
  logger.info(`📊 API usage — GET: ${totalGetCalls} / POST: ${totalPostCalls}`);
}
