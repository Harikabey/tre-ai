import { useState, useEffect } from 'react';
import { ArrowLeft, Check, Bot, Sun, Moon, Monitor } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { personalities, Personality } from '@/types/personality';
import { useTheme } from '@/hooks/useTheme';

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
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const stored = localStorage.getItem(PERSONALITY_KEY);
    if (stored) {
      setSelectedPersonality(stored);
    }
  }, []);

  const handleSelectPersonality = (id: string) => {
    setSelectedPersonality(id);
    localStorage.setItem(PERSONALITY_KEY, id);
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
      className={`p-4 rounded-lg border transition-all duration-200 text-center flex flex-col items-center gap-2 ${
        isSelected
          ? 'border-primary bg-primary/10 glow-primary'
          : 'border-border/50 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50'
      }`}
    >
      <Icon className={`h-6 w-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
      <div className="font-medium text-foreground text-sm">{option.name}</div>
      <div className="text-xs text-muted-foreground">{option.description}</div>
      {isSelected && (
        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center mt-1">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
    </button>
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
      className={`w-full p-4 rounded-lg border transition-all duration-200 text-left flex items-center gap-4 ${
        isSelected
          ? 'border-primary bg-primary/10 glow-primary'
          : 'border-border/50 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50'
      }`}
    >
      <span className="text-3xl">{personality.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground">{personality.name}</div>
        <div className="text-sm text-muted-foreground truncate">
          {personality.description}
        </div>
      </div>
      {isSelected && (
        <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </button>
  );
};

export default Settings;
