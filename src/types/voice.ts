export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  gender: 'male' | 'female';
  language: string;
}

export const voiceOptions: VoiceOption[] = [
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    description: 'Yumuşak ve sıcak kadın sesi',
    gender: 'female',
    language: 'tr',
  },
  {
    id: 'FGY2WhTYpPnrIDTdsKH5',
    name: 'Laura',
    description: 'Profesyonel kadın sesi',
    gender: 'female',
    language: 'tr',
  },
  {
    id: 'XrExE9yKIg1WjnnlVkGX',
    name: 'Matilda',
    description: 'Genç ve enerjik kadın sesi',
    gender: 'female',
    language: 'tr',
  },
  {
    id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily',
    description: 'Nazik kadın sesi',
    gender: 'female',
    language: 'tr',
  },
  {
    id: 'CwhRBWXzGAHq8TQ4Fs17',
    name: 'Roger',
    description: 'Güçlü erkek sesi',
    gender: 'male',
    language: 'tr',
  },
  {
    id: 'IKne3meq5aSn9XLyUdCD',
    name: 'Charlie',
    description: 'Samimi erkek sesi',
    gender: 'male',
    language: 'tr',
  },
  {
    id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    description: 'Derin ve etkileyici erkek sesi',
    gender: 'male',
    language: 'tr',
  },
  {
    id: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    description: 'Genç erkek sesi',
    gender: 'male',
    language: 'tr',
  },
  {
    id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    description: 'Profesyonel erkek sesi',
    gender: 'male',
    language: 'tr',
  },
  {
    id: 'nPczCjzI2devNBz1zQrb',
    name: 'Brian',
    description: 'Güvenilir erkek sesi',
    gender: 'male',
    language: 'tr',
  },
];

export const VOICE_SETTINGS_KEY = 'trefriend_voice_id';
