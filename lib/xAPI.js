import axios from 'axios';
import Bottleneck from 'bottleneck';
import logger from '../utils/logger.js';

let client;
let SOURCE_USER_ID;

let accessToken = process.env.X_ACCESS_TOKEN;
const refreshToken = process.env.X_REFRESH_TOKEN;
const clientId = process.env.X_CLIENT_ID;

const limiter = new Bottleneck({ minTime: 1200 }); // limite strict
const userCache = new Map();

export function initXApi({ accessToken: token, selfUserId }) {
  if (!token || !selfUserId) {
    throw new Error('❌ X_ACCESS_TOKEN ou X_SELF_USER_ID manquant dans initXApi()');
  }

  accessToken = token;
  SOURCE_USER_ID = selfUserId;

  client = createClient(accessToken);
}

function createClient(token) {
  return axios.create({
    baseURL: 'https://api.twitter.com/2',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
}

async function refreshAccessToken() {
  if (!refreshToken || !clientId) {
    logger.error('❌ Impossible de rafraîchir le token : X_REFRESH_TOKEN ou X_CLIENT_ID manquant');
    throw new Error('Missing refresh token config');
  }

  try {
    const res = await axios.post('https://api.twitter.com/2/oauth2/token', new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    accessToken = res.data.access_token;
    client = createClient(accessToken);
    logger.info('🔁 Nouveau token d’accès obtenu via refresh_token');

    return accessToken;
  } catch (err) {
    logger.error(`❌ Erreur de refresh_token: ${err.response?.data?.error_description || err.message}`);
    throw err;
  }
}

async function requestWithRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err?.response?.status === 401 && refreshToken) {
      logger.warn('🔐 Token expiré, tentative de rafraîchissement...');
      await refreshAccessToken();
      return await fn(); // retry
    }
    throw err;
  }
}

const get = (url, params = {}) =>
  limiter.schedule(() =>
    requestWithRetry(() => client.get(url, { params }).then(r => r.data))
      .catch(handleHttpError)
  );

const post = (url, data = {}) =>
  limiter.schedule(() =>
    requestWithRetry(() => client.post(url, data).then(r => r.data))
      .catch(handleHttpError)
  );

function handleHttpError(err) {
  const status = err?.response?.status || 0;
  const data = err?.response?.data || err.message;
  logger.error(`❌ HTTP ${status}: ${JSON.stringify(data)}`);
  throw err;
}

export async function getUserId(username) {
  if (userCache.has(username)) return userCache.get(username);
  const { data } = await get(`/users/by/username/${username}`, {
    'user.fields': 'id'
  });
  userCache.set(username, data.id);
  return data.id;
}

export async function followUser(username) {
  const id = await getUserId(username);
  await post(`/users/${SOURCE_USER_ID}/following`, {
    target_user_id: id
  });
  logger.info(`✅ Followed @${username}`);
}

export async function fetchRecentTweets(username, sinceId) {
  const id = await getUserId(username);
  const params = {
    exclude: 'replies,retweets',
    'tweet.fields': 'author_id,created_at,conversation_id',
    max_results: 5
  };
  if (sinceId) params.since_id = sinceId;

  const { data } = await get(`/users/${id}/tweets`, params);
  return (data || []).map(t => ({
    id: t.id,
    text: t.text,
    author_id: t.author_id,
    author_username: username,
    conversation_id: t.conversation_id
  }));
}

export async function replyToTweet(text, inReplyToId) {
  await post('/tweets', {
    text,
    reply: { in_reply_to_tweet_id: inReplyToId }
  });
  logger.debug(`💬 Replied to tweet ${inReplyToId}`);
}

export async function fetchReplies(tweetId, max = 20) {
  const safeMax = Math.max(10, Math.min(100, max));
  const params = {
    query: `conversation_id:${tweetId} is:reply`,
    max_results: safeMax,
    'tweet.fields': 'author_id,created_at,conversation_id'
  };

  const { data } = await get('/tweets/search/recent', params);
  return data || [];
}
