import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  TrendingUp,
  Pencil,
  Plus,
  Check,
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
  onAddMemory?: (content: string, memory_type: UserMemory['memory_type'], category: string, importance: number) => Promise<void> | void;
  onUpdateMemory?: (id: string, updates: Partial<Pick<UserMemory, 'content' | 'memory_type' | 'category' | 'importance'>>) => Promise<void> | void;
  onAddInterest?: (interest: string, category: string) => Promise<void> | void;
  onUpdateInterest?: (id: string, updates: Partial<Pick<UserInterest, 'interest' | 'category' | 'strength'>>) => Promise<void> | void;
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

const memoryTypeOptions: UserMemory['memory_type'][] = [
  'fact', 'preference', 'interest', 'habit', 'relationship', 'goal',
];

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
  onAddMemory,
  onUpdateMemory,
  onAddInterest,
  onUpdateInterest,
}: UserMemoryPanelProps) => {
  const [expandedSection, setExpandedSection] = useState<'memories' | 'interests' | 'moods' | null>('memories');

  // Add memory form state
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [newMemContent, setNewMemContent] = useState('');
  const [newMemType, setNewMemType] = useState<UserMemory['memory_type']>('fact');
  const [newMemCategory, setNewMemCategory] = useState('');

  // Edit memory state
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editMemContent, setEditMemContent] = useState('');
  const [editMemType, setEditMemType] = useState<UserMemory['memory_type']>('fact');
  const [editMemCategory, setEditMemCategory] = useState('');

  // Add / edit interest state
  const [showAddInterest, setShowAddInterest] = useState(false);
  const [newInterestText, setNewInterestText] = useState('');
  const [editingInterestId, setEditingInterestId] = useState<string | null>(null);
  const [editInterestText, setEditInterestText] = useState('');

  if (!isOpen) return null;

  const toggleSection = (section: 'memories' | 'interests' | 'moods') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const startEditMemory = (m: UserMemory) => {
    setEditingMemoryId(m.id);
    setEditMemContent(m.content);
    setEditMemType(m.memory_type);
    setEditMemCategory(m.category);
  };

  const submitEditMemory = async () => {
    if (!editingMemoryId || !editMemContent.trim()) return;
    await onUpdateMemory?.(editingMemoryId, {
      content: editMemContent.trim(),
      memory_type: editMemType,
      category: editMemCategory.trim() || 'genel',
    });
    setEditingMemoryId(null);
  };

  const submitAddMemory = async () => {
    if (!newMemContent.trim()) return;
    await onAddMemory?.(newMemContent, newMemType, newMemCategory || 'genel', 5);
    setNewMemContent('');
    setNewMemCategory('');
    setNewMemType('fact');
    setShowAddMemory(false);
  };

  const submitAddInterest = async () => {
    if (!newInterestText.trim()) return;
    await onAddInterest?.(newInterestText, 'genel');
    setNewInterestText('');
    setShowAddInterest(false);
  };

  const submitEditInterest = async () => {
    if (!editingInterestId || !editInterestText.trim()) return;
    await onUpdateInterest?.(editingInterestId, { interest: editInterestText.trim() });
    setEditingInterestId(null);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 max-w-full bg-card border-l border-border/50 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Tre Hafızası</h2>
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleSection('memories')}
              className="flex-1 flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
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
            {onAddMemory && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setExpandedSection('memories');
                  setShowAddMemory(v => !v);
                }}
                title="Yeni hafıza ekle"
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>

          {expandedSection === 'memories' && (
            <div className="mt-2 space-y-2">
              {showAddMemory && (
                <div className="p-2 rounded-lg bg-secondary/40 border border-border/50 space-y-2">
                  <Input
                    autoFocus
                    placeholder="Tre'nin hatırlamasını istediğin şey..."
                    value={newMemContent}
                    onChange={(e) => setNewMemContent(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-2">
                    <Select value={newMemType} onValueChange={(v) => setNewMemType(v as UserMemory['memory_type'])}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {memoryTypeOptions.map(t => (
                          <SelectItem key={t} value={t} className="text-xs">
                            {memoryTypeLabels[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="kategori"
                      value={newMemCategory}
                      onChange={(e) => setNewMemCategory(e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setShowAddMemory(false)}>İptal</Button>
                    <Button size="sm" onClick={submitAddMemory} disabled={!newMemContent.trim()}>
                      Ekle
                    </Button>
                  </div>
                </div>
              )}

              {memories.length === 0 && !showAddMemory ? (
                <p className="text-xs text-muted-foreground p-2">
                  Henüz bir şey öğrenmedim. Benimle sohbet ettikçe seni tanıyacağım ya da kendin ekleyebilirsin!
                </p>
              ) : (
                memories.map(memory => (
                  <div
                    key={memory.id}
                    className="group p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    {editingMemoryId === memory.id ? (
                      <div className="space-y-2">
                        <Input
                          autoFocus
                          value={editMemContent}
                          onChange={(e) => setEditMemContent(e.target.value)}
                          className="h-8 text-sm"
                        />
                        <div className="flex gap-2">
                          <Select value={editMemType} onValueChange={(v) => setEditMemType(v as UserMemory['memory_type'])}>
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {memoryTypeOptions.map(t => (
                                <SelectItem key={t} value={t} className="text-xs">
                                  {memoryTypeLabels[t]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={editMemCategory}
                            onChange={(e) => setEditMemCategory(e.target.value)}
                            className="h-8 text-xs flex-1"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingMemoryId(null)}>İptal</Button>
                          <Button size="sm" onClick={submitEditMemory}>
                            <Check className="w-3 h-3 mr-1" /> Kaydet
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <div className="mt-0.5 p-1 rounded bg-primary/10 text-primary">
                            {memoryTypeIcons[memory.memory_type] || <Sparkles className="w-3 h-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-tight break-words">{memory.content}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {memoryTypeLabels[memory.memory_type] || memory.memory_type}
                              </span>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground">{memory.category}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          {onUpdateMemory && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => startEditMemory(memory)}
                              title="Düzenle"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onDeleteMemory(memory.id)}
                            title="Sil"
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Interests Section */}
        <div className="mb-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleSection('interests')}
              className="flex-1 flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors"
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
            {onAddInterest && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setExpandedSection('interests');
                  setShowAddInterest(v => !v);
                }}
                title="Yeni ilgi alanı ekle"
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>

          {expandedSection === 'interests' && (
            <div className="mt-2">
              {showAddInterest && (
                <div className="p-2 mb-2 rounded-lg bg-secondary/40 border border-border/50 flex gap-2">
                  <Input
                    autoFocus
                    placeholder="örn. yoga, sci-fi filmler..."
                    value={newInterestText}
                    onChange={(e) => setNewInterestText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitAddInterest()}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" onClick={submitAddInterest} disabled={!newInterestText.trim()}>
                    Ekle
                  </Button>
                </div>
              )}

              {interests.length === 0 && !showAddInterest ? (
                <p className="text-xs text-muted-foreground p-2">
                  İlgi alanlarını henüz keşfetmedim. Nelerden hoşlandığını anlat ya da kendin ekle!
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 p-2">
                  {interests.map(interest => (
                    <div
                      key={interest.id}
                      className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                      {editingInterestId === interest.id ? (
                        <>
                          <Input
                            autoFocus
                            value={editInterestText}
                            onChange={(e) => setEditInterestText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitEditInterest();
                              if (e.key === 'Escape') setEditingInterestId(null);
                            }}
                            className="h-6 text-xs w-32 px-2"
                          />
                          <button onClick={submitEditInterest} className="hover:text-foreground">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => setEditingInterestId(null)} className="hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{interest.interest}</span>
                          {interest.strength > 5 && <Star className="w-3 h-3 fill-current" />}
                          {onUpdateInterest && (
                            <button
                              onClick={() => {
                                setEditingInterestId(interest.id);
                                setEditInterestText(interest.interest);
                              }}
                              className="ml-1 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                              title="Düzenle"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteInterest(interest.id)}
                            className="opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                            title="Sil"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      )}
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
          Tre seni tanıdıkça daha iyi yardımcı olur 💜
        </p>
      </div>
    </div>
  );
};
