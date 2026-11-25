import type { AssistantDefinition } from './register';
import { franchiseTools } from './franchiseTools';
import { libraryTools } from './libraryTools';

export const assistantTools: AssistantDefinition[] = [...libraryTools, ...franchiseTools];
