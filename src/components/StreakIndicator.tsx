// FILE: src/components/StreakIndicator.tsx
import { useState } from 'react';
import { Flame, Snowflake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StreakModal } from '@/components/StreakModal';
import { useStreak } from '@/hooks/useStreak';

export function StreakIndicator() {
  const [open, setOpen] = useState(false);
  const { currentStreak, freezesAvailable } = useStreak();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Seri durumunu görüntüle"
        onClick={() => setOpen(true)}
        className="gap-2 px-2 text-muted-foreground"
      >
        <span className="inline-flex items-center gap-1">
          <Flame className={`h-4 w-4 ${currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
          <span>{currentStreak}</span>
        </span>
        <span aria-hidden="true" className="hidden sm:block h-4 w-px bg-border" />
        <span className="hidden sm:inline-flex items-center gap-1">
          <Snowflake className="h-4 w-4 text-sky-500" />
          <span>{freezesAvailable}</span>
        </span>
      </Button>
      <StreakModal open={open} onOpenChange={setOpen} />
    </>
  );
}