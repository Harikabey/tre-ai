// FILE: src/components/CustomPersonalityInput.tsx
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useCustomPersonality } from '@/hooks/useCustomPersonality';
import { toast } from 'sonner';

const MAX_CUSTOM_PERSONALITY_LENGTH = 500;

interface CustomPersonalityInputProps {
  onClear: () => void;
}

export const CustomPersonalityInput = ({ onClear }: CustomPersonalityInputProps) => {
  const { customPersonality, setCustomPersonality, clearCustomPersonality, isActive } = useCustomPersonality();
  const [draft, setDraft] = useState(customPersonality);

  useEffect(() => {
    setDraft(customPersonality);
  }, [customPersonality]);

  const handleSave = () => {
    try {
      setCustomPersonality(draft);
      toast.success('Özel kişilik kaydedildi.');
    } catch {
      toast.error('Özel kişilik kaydedilemedi.');
    }
  };

  const handleClear = () => {
    try {
      clearCustomPersonality();
      setDraft('');
      onClear();
      toast.success('Özel kişilik temizlendi.');
    } catch {
      toast.error('Özel kişilik temizlenemedi.');
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">✏️ Özel Kişilik</CardTitle>
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? '✅ Aktif' : '⭕ Devre dışı'}
          </Badge>
        </div>
        <CardDescription>
          Tre'nin nasıl davranmasını istersin? Kendi talimatını yaz. Örn: 'Bana motivasyon ver', 'Einstein gibi düşün', 'Şair gibi konuş'.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Textarea
            aria-label="Özel kişilik talimatı"
            value={draft}
            maxLength={MAX_CUSTOM_PERSONALITY_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-28 resize-y"
          />
          <div className="text-right text-xs text-muted-foreground" aria-live="polite">
            {draft.length}/{MAX_CUSTOM_PERSONALITY_LENGTH}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClear}>
            Temizle
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!draft.trim() || draft.length > MAX_CUSTOM_PERSONALITY_LENGTH}
          >
            Kaydet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};