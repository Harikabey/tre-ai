import { useState, useEffect } from 'react';
import { ArrowLeft, Check, Bot, Sun, Moon, Monitor, Volume2, Globe, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { personalities, Personality } from '@/types/personality';
import { voiceOptions, VoiceOption, VOICE_SETTINGS_KEY } from '@/types/voice';
import { languages, Language, LANGUAGE_KEY } from '@/types/language';
import { useTheme } from '@/hooks/useTheme';
import { useVoice } from '@/hooks/useVoice';

const PERSONALITY_KEY = 'ai_chatbot_personality';

type ThemeOption = {
  id: 'light' | 'dark' | 'system';
  name: string;
  description: string;
  icon: typeof Sun;
};

const themeOptions: ThemeOption[] = [
  {
    id: 'light',
    name: 'Açık Mod',
    description: 'Aydınlık tema',
    icon: Sun,
  },
  {
    id: 'dark',
    name: 'Koyu Mod',
    description: 'Karanlık tema',
    icon: Moon,
  },
  {
    id: 'system',
    name: 'Sistem',
    description: 'Cihaz ayarlarını takip et',
    icon: Monitor,
  },
];

const Settings = () => {
  const [selectedPersonality, setSelectedPersonality] = useState<string>('friendly');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('tr');
  const [languageSearch, setLanguageSearch] = useState('');
  const { theme, setTheme } = useTheme();
  const { selectedVoiceId, updateVoice, playText, isLoading } = useVoice();

  useEffect(() => {
    const stored = localStorage.getItem(PERSONALITY_KEY);
    if (stored) setSelectedPersonality(stored);
    const storedLang = localStorage.getItem(LANGUAGE_KEY);
    if (storedLang) setSelectedLanguage(storedLang);
  }, []);

  const handleSelectPersonality = (id: string) => {
    setSelectedPersonality(id);
    localStorage.setItem(PERSONALITY_KEY, id);
  };

  const handleSelectLanguage = (code: string) => {
    setSelectedLanguage(code);
    localStorage.setItem(LANGUAGE_KEY, code);
  };

  const filteredLanguages = languages.filter(l =>
    l.name.toLowerCase().includes(languageSearch.toLowerCase()) ||
    l.nativeName.toLowerCase().includes(languageSearch.toLowerCase()) ||
    l.code.toLowerCase().includes(languageSearch.toLowerCase())
  );

  const handleSelectVoice = (voiceId: string) => {
    updateVoice(voiceId);
  };

  const testVoice = (voice: VoiceOption) => {
    playText(`Merhaba, ben ${voice.name}. Size nasıl yardımcı olabilirim?`, voice.id);
  };

  return (
    <div className="min-h-screen bg-background bg-grid">
      <div className="fixed inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="relative z-10 max-w-3xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ayarlar</h1>
            <p className="text-muted-foreground text-sm">Uygulamayı özelleştirin</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Theme Selection */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-primary" />
                Tema
              </CardTitle>
              <CardDescription>
                Uygulama görünümünü seçin
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              {themeOptions.map((option) => (
                <ThemeCard
                  key={option.id}
                  option={option}
                  isSelected={theme === option.id}
                  onSelect={() => setTheme(option.id)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Voice Selection */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-primary" />
                Ses Seçimi
              </CardTitle>
              <CardDescription>
                Bot cevaplarını sesli okutmak için bir ses seçin
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {voiceOptions.map((voice) => (
                <VoiceCard
                  key={voice.id}
                  voice={voice}
                  isSelected={selectedVoiceId === voice.id}
                  onSelect={() => handleSelectVoice(voice.id)}
                  onTest={() => testVoice(voice)}
                  isLoading={isLoading}
                />
              ))}
            </CardContent>
          </Card>

          {/* Language Selection */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Yanıt Dili
              </CardTitle>
              <CardDescription>
                Botun hangi dilde yanıt vereceğini seçin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Dil ara..."
                    value={languageSearch}
                    onChange={(e) => setLanguageSearch(e.target.value)}
                    className="pl-9 bg-input/50 border-border/50"
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 max-h-64 overflow-y-auto pr-1">
                {filteredLanguages.map((lang) => (
                  <LanguageCard
                    key={lang.code}
                    language={lang}
                    isSelected={selectedLanguage === lang.code}
                    onSelect={() => handleSelectLanguage(lang.code)}
                  />
                ))}
                {filteredLanguages.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-full text-center py-4">Sonuç bulunamadı</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Personality Selection */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Bot Kişiliği
              </CardTitle>
              <CardDescription>
                Botun size nasıl yanıt vereceğini belirleyin
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {personalities.map((personality) => (
                <PersonalityCard
                  key={personality.id}
                  personality={personality}
                  isSelected={selectedPersonality === personality.id}
                  onSelect={() => handleSelectPersonality(personality.id)}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

interface ThemeCardProps {
  option: ThemeOption;
  isSelected: boolean;
  onSelect: () => void;
}

const ThemeCard = ({ option, isSelected, onSelect }: ThemeCardProps) => {
  const Icon = option.icon;
  
  return (
    <button
      onClick={onSelect}
      className={`p-3 sm:p-4 rounded-lg border transition-all duration-200 text-center flex flex-col items-center gap-2 ${
        isSelected
          ? 'border-primary bg-primary/10 glow-primary'
          : 'border-border/50 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50'
      }`}
    >
      <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
      <div className="font-medium text-foreground text-xs sm:text-sm">{option.name}</div>
      <div className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{option.description}</div>
      {isSelected && (
        <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-primary flex items-center justify-center mt-1">
          <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary-foreground" />
        </div>
      )}
    </button>
  );
};

interface VoiceCardProps {
  voice: VoiceOption;
  isSelected: boolean;
  onSelect: () => void;
  onTest: () => void;
  isLoading: boolean;
}

const VoiceCard = ({ voice, isSelected, onSelect, onTest, isLoading }: VoiceCardProps) => {
  return (
    <div
      className={`p-3 sm:p-4 rounded-lg border transition-all duration-200 ${
        isSelected
          ? 'border-primary bg-primary/10 glow-primary'
          : 'border-border/50 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onSelect}
          className="flex-1 text-left flex items-center gap-3"
        >
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
            voice.gender === 'female' ? 'bg-pink-500/20 text-pink-500' : 'bg-blue-500/20 text-blue-500'
          }`}>
            <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground text-sm">{voice.name}</div>
            <div className="text-xs text-muted-foreground truncate">{voice.description}</div>
          </div>
        </button>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onTest();
            }}
            disabled={isLoading}
            className="text-xs h-7 px-2"
          >
            Test
          </Button>
          {isSelected && (
            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface PersonalityCardProps {
  personality: Personality;
  isSelected: boolean;
  onSelect: () => void;
}

const PersonalityCard = ({ personality, isSelected, onSelect }: PersonalityCardProps) => {
  return (
    <button
      onClick={onSelect}
      className={`w-full p-3 sm:p-4 rounded-lg border transition-all duration-200 text-left flex items-center gap-3 sm:gap-4 ${
        isSelected
          ? 'border-primary bg-primary/10 glow-primary'
          : 'border-border/50 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50'
      }`}
    >
      <span className="text-2xl sm:text-3xl">{personality.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground text-sm sm:text-base">{personality.name}</div>
        <div className="text-xs sm:text-sm text-muted-foreground truncate">
          {personality.description}
        </div>
      </div>
      {isSelected && (
        <div className="flex-shrink-0 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3 w-3 sm:h-4 sm:w-4 text-primary-foreground" />
        </div>
      )}
    </button>
  );
};


interface LanguageCardProps {
  language: Language;
  isSelected: boolean;
  onSelect: () => void;
}

const LanguageCard = ({ language, isSelected, onSelect }: LanguageCardProps) => {
  return (
    <button
      onClick={onSelect}
      className={`p-2 sm:p-3 rounded-lg border transition-all duration-200 text-left flex items-center gap-2 ${
        isSelected
          ? 'border-primary bg-primary/10 glow-primary'
          : 'border-border/50 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground text-xs sm:text-sm">{language.name}</div>
        <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{language.nativeName}</div>
      </div>
      {isSelected && (
        <div className="flex-shrink-0 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      )}
    </button>
  );
};

export default Settings;
