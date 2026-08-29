// No Anthropic API key is configured in this environment (see AGENCY setup / Phase 4 build
// notes), so every AI text feature routes through these heuristics instead of a real Claude
// call. Each function returns the same shape a real call would — swapping in `@anthropic-ai/sdk`
// later means replacing a function body here, not touching callers, DTOs, or the frontend.

const STOPWORDS = new Set([
  'a', 'an', 'the', 'for', 'and', 'or', 'of', 'to', 'in', 'on', 'with', 'is', 'are', 'our',
  'your', 'we', 'you', 'this', 'that', 'it', 'at', 'be', 'as', 'by',
]);

function keywords(input: string, max = 4): string[] {
  const words = input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
    if (out.length >= max) break;
  }
  return out;
}

function toTitleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function simulateAssistantReply(question: string): string {
  const q = question.toLowerCase();
  const topic = keywords(question, 3).join(' ') || 'your request';

  if (q.includes('content plan') || q.includes('plan for')) {
    return [
      `Here's a 7-day content plan for ${topic}:`,
      '',
      'Day 1: Teaser post introducing the theme',
      'Day 2: Product/service highlight',
      'Day 3: Behind-the-scenes or lifestyle post',
      'Day 4: Customer story or testimonial',
      'Day 5: Offer or discount callout',
      'Day 6: Educational or how-to post',
      'Day 7: Recap + call to action',
      '',
      'Add this to the Content Planner and I can draft captions for each day.',
    ].join('\n');
  }

  if (q.includes('caption') || q.includes('hashtag')) {
    return [
      `A few caption directions for ${topic}:`,
      '',
      '1. Direct — lead with the offer or benefit in the first line.',
      '2. Playful — open with a question or a relatable moment.',
      '3. Story-driven — one line of context, then the payoff.',
      '',
      'Open AI Captions to generate full variants with hashtags for a specific platform.',
    ].join('\n');
  }

  if (q.includes('best time') || q.includes('schedule') || q.includes('post time')) {
    return [
      'Based on typical engagement patterns for this account type:',
      '',
      'Instagram: Tue–Thu, 11am–1pm or 7–9pm',
      'Facebook: Wed–Fri, 1–3pm',
      'LinkedIn: Tue–Thu, 8–10am',
      'X: Weekdays, 9–11am',
      '',
      'Once real analytics are connected these will be based on this client\'s actual audience activity.',
    ].join('\n');
  }

  if (q.includes('analy') || q.includes('performance') || q.includes('insight')) {
    return [
      `Here's a quick read on ${topic}:`,
      '',
      'Engagement trends upward when posts include a clear call to action.',
      'Carousel and video formats are outperforming single images this period.',
      'Consider consolidating posting times around the peak windows to build momentum.',
      '',
      'Full analytics with real numbers live in the Analytics module.',
    ].join('\n');
  }

  return [
    `Here's what I'd suggest for "${question.trim()}":`,
    '',
    `1. Clarify the goal — what should someone do after seeing this ${topic} content?`,
    '2. Pick one platform to lead with, then adapt for the rest.',
    '3. Draft 2–3 variants and let the team pick a favorite in Approvals.',
    '',
    'Ask me to turn this into a content plan, captions, or a posting schedule and I\'ll generate one.',
  ].join('\n');
}

export function simulateVideoScript(idea: string): string {
  const kws = keywords(idea, 3).join(' ') || 'your idea';
  return [
    `Scene 1 — Opening Title: Introducing ${kws}.`,
    'Scene 2 — Product/Service Showcase: Close-up shots highlighting key details.',
    `Scene 3 — Lifestyle Shot: ${toTitleCase(kws)} in a real, everyday setting.`,
    'Scene 4 — Call to Action: Clear next step for the viewer.',
  ].join('\n');
}

export interface SimulatedScene {
  title: string;
  description: string;
  durationSec: number;
}

export function simulateVideoScenes(idea: string): SimulatedScene[] {
  const kws = keywords(idea, 3).join(' ') || 'your idea';
  return [
    { title: 'Opening Title', description: `Introducing ${kws}.`, durationSec: 4 },
    { title: 'Product Showcase', description: 'Close-up shots of key details.', durationSec: 6 },
    { title: 'Lifestyle Shot', description: `${toTitleCase(kws)} in everyday use.`, durationSec: 5 },
    { title: 'Call to Action', description: 'Clear next step for the viewer.', durationSec: 4 },
  ];
}

export function simulateStrategyOutput(title: string, goal: string, contextNote?: string): string {
  const kws = keywords(`${title} ${goal}`, 3).join(' ') || 'this initiative';
  return [
    `Strategy recommendation for ${title || kws}:`,
    '',
    `Objective: ${goal || 'Not specified — treating this as a general growth strategy.'}`,
    contextNote ? `Context considered: ${contextNote}` : null,
    '',
    'Recommended actions:',
    `1. Concentrate the next 2 weeks of content around ${kws}, testing 2 formats per week.`,
    '2. Prioritize the platform with the strongest existing engagement before expanding to others.',
    '3. Set one measurable KPI (reach, saves, or conversions) and review weekly.',
    '4. Route the first draft through Approvals before wider rollout.',
    '',
    'This recommendation only used the context explicitly provided above — no other client data was accessed.',
  ]
    .filter((line) => line !== null)
    .join('\n');
}
