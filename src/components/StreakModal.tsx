// FILE: src/components/StreakModal.tsx
import { Flame, Play, Snowflake } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useStreak } from '@/hooks/useStreak';

interface StreakModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StreakModal({ open, onOpenChange }: StreakModalProps) {
  const { currentStreak, longestStreak, freezesAvailable, addFreeze } = useStreak();
  const { toast } = useToast();
  const atFreezeLimit = freezesAvailable >= 5;

  const handleEarnFreeze = () => {
    if (atFreezeLimit) {
      addFreeze();
      return;
    }
    toast({ description: '🎬 Reklamlar yakında! Gelecekte burada reklam olacak.' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">🔥 Seri Durumun</DialogTitle>
          <DialogDescription className="sr-only">
            Günlük giriş serin, en uzun serin ve kullanabileceğin seri dondurmaları.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 py-2">
          <Flame className={`h-12 w-12 ${currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
          <p className="text-center">
            <span className="block text-4xl font-bold text-foreground">{currentStreak}</span>
            <span className="text-sm text-muted-foreground">günlük serin</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border p-3 text-center">
            <p className="text-sm text-muted-foreground">En Uzun</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{longestStreak}</p>
          </div>
          <div className="rounded-md border border-border p-3 text-center">
            <p className="text-sm text-muted-foreground">Dondurma</p>
            <p className="mt-1 inline-flex items-center justify-center gap-1 text-xl font-semibold text-foreground">
              <Snowflake className="h-5 w-5 text-sky-500" />
              {freezesAvailable}/5
            </p>
          </div>
        </div>

        <Button onClick={handleEarnFreeze} disabled={atFreezeLimit} className="w-full">
          <Play className="h-4 w-4" />
          {atFreezeLimit ? 'Maksimum dondurmaya ulaştın' : 'Reklam İzle → Dondurma Kazan'}
        </Button>

        <p className="text-center text-sm leading-relaxed text-muted-foreground">
          Seri dondurma, bir gün Tre'yi açmayı unutursan serinin sıfırlanmasını önler. En fazla 5 dondurma biriktirebilirsin.
        </p>
      </DialogContent>
    </Dialog>
  );
}