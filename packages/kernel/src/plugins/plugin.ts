import type { Tool } from '../hands/tool';

export interface BobbyPlugin {
  name: string;
  tools: Tool[];
}
