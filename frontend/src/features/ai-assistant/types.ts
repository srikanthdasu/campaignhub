export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  _count: { messages: number };
}

export interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

export const QUICK_PROMPTS = [
  'Create a content plan for next week',
  'Generate captions for a product launch',
  'What is the best time to post?',
  'Analyze last month’s performance',
];
