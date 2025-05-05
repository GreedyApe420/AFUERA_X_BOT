import { OpenAI } from 'openai';
import Bottleneck from 'bottleneck';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const PREPROMPT = fs.readFileSync(path.resolve(__dirname, '../preprompt.txt'), 'utf8').trim();

let openai = null;

export function initOpenAI(apiKey) {
  openai = new OpenAI({ apiKey });
}

const limiter = new Bottleneck({ minTime: 350 });

export async function generateResponse(userContent) {
  if (!openai) throw new Error('OpenAI client not initialized');
  return limiter.schedule(async () => {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // vous pouver changer le model ici
      messages: [
        { role: 'system', content: PREPROMPT },
        { role: 'user', content: userContent }
      ],
      max_tokens: 80
    });
    const text = completion.choices[0].message.content.trim();
    logger.debug('OpenAI generated response');
    return text;
  });
}
