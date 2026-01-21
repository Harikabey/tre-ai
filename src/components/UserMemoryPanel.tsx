import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
  Heart, 
  Sparkles, 
  X, 
  Trash2,
  ChevronDown,
  ChevronUp,
  User,
  Target,
  Star,
  Users,
  Lightbulb,
  TrendingUp
} from 'lucide-react';
import { UserMemory, UserInterest, MoodRecord } from '@/hooks/useUserMemory';

interface UserMemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  memories: UserMemory[];
  interests: UserInterest[];
  recentMoods: MoodRecord[];
  currentMood: { mood: string; suggested_tone: string } | null;
  onDeleteMemory: (id: string) => void;
  onDeleteInterest: (id: string) => void;
}

const memoryTypeIcons: Record<string, React.ReactNode> = {
  fact: <User className="w-3 h-3" />,
  preference: <Heart className="w-3 h-3" />,
  interest: <Star className="w-3 h-3" />,
  habit: <TrendingUp className="w-3 h-3" />,
  relationship: <Users className="w-3 h-3" />,
  goal: <Target className="w-3 h-3" />,
};

const memoryTypeLabels: Record<string, string> = {
  fact: 'Gerçek',
  preference: 'Tercih',
  interest: 'İlgi',
  habit: 'Alışkanlık',
  relationship: 'İlişki',
  goal: 'Hedef',
};

const moodEmojis: Record<string, string> = {
  mutlu: '😊',
  üzgün: '😢',
  kızgın: '😠',
  endişeli: '😰',
  heyecanlı: '🤩',
  sakin: '😌',
  yorgun: '😴',
  stresli: '😤',
  nötr: '😐',
  meraklı: '🤔',
  umutlu: '🌟',
  hayal_kırıklığı: '😞',
};

export const UserMemoryPanel = ({
  isOpen,
  onClose,
  memories,
  interests,
  recentMoods,
  currentMood,
  onDeleteMemory,
  onDeleteInterest,
}: UserMemoryPanelProps) => {
  const [expandedSection, setExpandedSection] = useState<'memories' | 'interests' | 'moods' | null>('memories');

  if (!isOpen) return null;

  const toggleSection = (section: 'memories' | 'interests' | 'moods') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-card border-l border-border/50 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">TreFriend Hafızası</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Current Mood */}
      {currentMood && (
        <div className="p-3 mx-3 mt-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{moodEmojis[currentMood.mood] || '🤖'}</span>
            <div>
              <p className="text-sm font-medium">Şu anki ruh halin</p>
              <p className="text-xs text-muted-foreground capitalize">{currentMood.mood}</p>
            </div>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-3">
        {/* Memories Section */}
        <div className="mb-4">
          <button
            onClick={() => toggleSection('memories')}
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-sm">Hatırladıklarım</span>
              <span className="text-xs text-muted-foreground">({memories.length})</span>
            </div>
            {expandedSection === 'memories' ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          
          {expandedSection === 'memories' && (
            <div className="mt-2 space-y-2">
              {memories.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">
                  Henüz bir şey öğrenmedim. Benimle sohbet ettikçe seni tanıyacağım!
                </p>
              ) : (
                memories.map(memory => (
                  <div
                    key={memory.id}
                    className="group p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className="mt-0.5 p-1 rounded bg-primary/10 text-primary">
                          {memoryTypeIcons[memory.memory_type] || <Sparkles className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-tight">{memory.content}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {memoryTypeLabels[memory.memory_type] || memory.memory_type}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">{memory.category}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onDeleteMemory(memory.id)}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Interests Section */}
        <div className="mb-4">
          <button
            onClick={() => toggleSection('interests')}
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" />
              <span className="font-medium text-sm">İlgi Alanların</span>
              <span className="text-xs text-muted-foreground">({interests.length})</span>
            </div>
            {expandedSection === 'interests' ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          
          {expandedSection === 'interests' && (
            <div className="mt-2">
              {interests.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">
                  İlgi alanlarını henüz keşfetmedim. Nelerden hoşlandığını anlat!
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 p-2">
                  {interests.map(interest => (
                    <div
                      key={interest.id}
                      className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                      <span>{interest.interest}</span>
                      {interest.strength > 5 && <Star className="w-3 h-3 fill-current" />}
                      <button
                        onClick={() => onDeleteInterest(interest.id)}
                        className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mood History Section */}
        <div>
          <button
            onClick={() => toggleSection('moods')}
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-sm">Duygu Geçmişin</span>
              <span className="text-xs text-muted-foreground">({recentMoods.length})</span>
            </div>
            {expandedSection === 'moods' ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          
          {expandedSection === 'moods' && (
            <div className="mt-2 space-y-1">
              {recentMoods.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">
                  Henüz duygu analizi yapılmadı.
                </p>
              ) : (
                recentMoods.slice(0, 10).map(mood => (
                  <div
                    key={mood.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/30 transition-colors"
                  >
                    <span className="text-lg">{moodEmojis[mood.mood] || '🤖'}</span>
                    <div className="flex-1">
                      <p className="text-sm capitalize">{mood.mood}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(mood.created_at).toLocaleDateString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: mood.mood_score >= 0.3 
                          ? '#22c55e' 
                          : mood.mood_score <= -0.3 
                            ? '#ef4444' 
                            : '#eab308'
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          TreFriend seni tanıdıkça daha iyi yardımcı olur 💜
        </p>
      </div>
    </div>
  );
};
