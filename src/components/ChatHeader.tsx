import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Trash2, PanelRight, Settings, Menu, LogOut, Image, Brain, Link2, FileDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getTranslations } from '@/utils/translations';
import aiLogo from '@/assets/ai-logo.jpg';

interface ChatHeaderProps {
  isLearningMode: boolean;
  onLearningModeChange: (value: boolean) => void;
  onClearMessages: () => void;
  onTogglePanel: () => void;
  isPanelOpen: boolean;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onToggleImageHistory?: () => void;
  imageHistoryCount?: number;
  onToggleMemoryPanel?: () => void;
  memoryCount?: number;
  onToggleConnectedAccounts?: () => void;
  onExportPdf?: () => void;
}

export const ChatHeader = ({
  isLearningMode,
  onLearningModeChange,
  onClearMessages,
  onTogglePanel,
  isPanelOpen,
  onToggleSidebar,
  onToggleImageHistory,
  imageHistoryCount = 0,
  onToggleMemoryPanel,
  memoryCount = 0,
  onToggleConnectedAccounts,
  onExportPdf,
}: ChatHeaderProps) => {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const t = getTranslations(localStorage.getItem('ai_chatbot_language') || 'tr');

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: t.error,
        description: t.signOutError,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t.goodbye,
        description: t.signOutSuccess,
      });
    }
  };

  return (
    <header className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 sm:gap-3">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="text-muted-foreground h-8 w-8 sm:h-9 sm:w-9"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        )}
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-primary/30 shadow-glow">
          <img src={aiLogo} alt="Tre AI" className="w-full h-full object-cover" />
        </div>
        <div className="hidden xs:block">
          <h1 className="font-semibold text-foreground text-glow text-sm sm:text-base">Tre</h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground">AI Assistant</p>
        </div>
      </div>
      
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Learning mode - hidden on small screens */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg border border-border/50">
          <Sparkles className={`w-4 h-4 transition-colors ${isLearningMode ? 'text-accent' : 'text-muted-foreground'}`} />
          <span className="text-xs text-muted-foreground">{t.learning}</span>
          <Switch
            checked={isLearningMode}
            onCheckedChange={onLearningModeChange}
            className="data-[state=checked]:bg-accent"
          />
        </div>

        {/* Memory Panel button */}
        {onToggleMemoryPanel && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMemoryPanel}
            className="text-muted-foreground hover:text-primary h-8 w-8 sm:h-9 sm:w-9 relative"
            title="Tre Hafızası"
          >
            <Brain className="w-4 h-4" />
            {memoryCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {memoryCount > 9 ? '9+' : memoryCount}
              </span>
            )}
          </Button>
        )}

        {/* Image History button */}
        {onToggleImageHistory && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleImageHistory}
            className="text-muted-foreground hover:text-primary h-8 w-8 sm:h-9 sm:w-9 relative"
            title="Görsel Geçmişi"
          >
            <Image className="w-4 h-4" />
            {imageHistoryCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {imageHistoryCount > 9 ? '9+' : imageHistoryCount}
              </span>
            )}
          </Button>
        )}
        
        {/* Connected Accounts button */}
        {onToggleConnectedAccounts && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleConnectedAccounts}
            className="text-muted-foreground hover:text-primary h-8 w-8 sm:h-9 sm:w-9"
            title="Bağlı Hesaplar"
          >
            <Link2 className="w-4 h-4" />
          </Button>
        )}

        <Link to="/settings">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary h-8 w-8 sm:h-9 sm:w-9"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </Link>

        {onExportPdf && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onExportPdf}
            className="text-muted-foreground hover:text-primary h-8 w-8 sm:h-9 sm:w-9"
            title="Sohbeti PDF olarak indir"
          >
            <FileDown className="w-4 h-4" />
          </Button>
        )}
        
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearMessages}
          className="text-muted-foreground hover:text-destructive h-8 w-8 sm:h-9 sm:w-9"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        
        {/* Panel toggle - hidden on mobile */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onTogglePanel}
          className={`hidden lg:flex h-8 w-8 sm:h-9 sm:w-9 ${isPanelOpen ? 'bg-primary/20 border-primary/30' : ''}`}
        >
          <PanelRight className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-destructive h-8 w-8 sm:h-9 sm:w-9"
          title="Çıkış Yap"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
};
