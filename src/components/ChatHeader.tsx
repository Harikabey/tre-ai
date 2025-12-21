import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Bot, Sparkles, Trash2, PanelRight, Settings, Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ChatHeaderProps {
  isLearningMode: boolean;
  onLearningModeChange: (value: boolean) => void;
  onClearMessages: () => void;
  onTogglePanel: () => void;
  isPanelOpen: boolean;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const ChatHeader = ({
  isLearningMode,
  onLearningModeChange,
  onClearMessages,
  onTogglePanel,
  isPanelOpen,
  onToggleSidebar,
  isSidebarOpen,
}: ChatHeaderProps) => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: 'Hata',
        description: 'Çıkış yapılamadı',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Görüşürüz!',
        description: 'Başarıyla çıkış yaptınız',
      });
    }
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="text-muted-foreground"
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-glow">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-foreground text-glow">TreFriend</h1>
          <p className="text-xs text-muted-foreground">Akıllı AI Asistan</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg border border-border/50">
          <Sparkles className={`w-4 h-4 transition-colors ${isLearningMode ? 'text-accent' : 'text-muted-foreground'}`} />
          <span className="text-xs text-muted-foreground">Öğrenme</span>
          <Switch
            checked={isLearningMode}
            onCheckedChange={onLearningModeChange}
            className="data-[state=checked]:bg-accent"
          />
        </div>
        
        <Link to="/settings">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </Link>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearMessages}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onTogglePanel}
          className={isPanelOpen ? 'bg-primary/20 border-primary/30' : ''}
        >
          <PanelRight className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-destructive"
          title="Çıkış Yap"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
};
