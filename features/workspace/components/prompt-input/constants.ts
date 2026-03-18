export interface SlashCommand {
  name: string;
  description: string;
}

export interface FlatModel {
  provider: string;
  modelId: string;
  modelName: string;
}

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export const THINKING_LEVELS: { level: ThinkingLevel; label: string; description: string }[] = [
  { level: 'off', label: 'Off', description: 'No extended thinking' },
  { level: 'minimal', label: 'Minimal', description: 'Barely any reasoning' },
  { level: 'low', label: 'Low', description: 'Quick, concise responses' },
  { level: 'medium', label: 'Medium', description: 'Balanced depth and speed' },
  { level: 'high', label: 'High', description: 'Thorough, detailed responses' },
  { level: 'xhigh', label: 'Max', description: 'Maximum reasoning depth' },
];

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'file' | 'text';
  uri?: string;
  size?: number;
  preview?: string;
}

export const LARGE_PASTE_THRESHOLD = 500;
