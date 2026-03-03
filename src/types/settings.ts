export interface AppSettings {
  openrouterApiKey: string
  aiModel: string  // default: 'anthropic/claude-opus-4'
  userPrompt: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  openrouterApiKey: '',
  aiModel: 'anthropic/claude-opus-4',
  userPrompt: '',
}
