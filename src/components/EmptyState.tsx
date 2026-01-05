import { Bot } from 'lucide-react';
import aiLogo from '@/assets/ai-logo.jpg';

export const EmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8 text-center">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-glow mb-4 sm:mb-6">
        <img src={aiLogo} alt="TreFriend AI" className="w-full h-full object-cover" />
      </div>
      
      <h2 className="text-xl sm:text-2xl font-bold text-foreground text-glow mb-2 sm:mb-3">
        Merhaba! Ben TreFriend
      </h2>
      
      <p className="text-sm sm:text-base text-muted-foreground max-w-md mb-6 sm:mb-8">
        Size yardımcı olmak için buradayım. 
        Herhangi bir soru sorabilir, sohbet edebilir veya dosya paylaşabilirsiniz.
      </p>
      
      <div className="grid gap-2 sm:gap-3 w-full max-w-sm">
        <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-card/50 border border-border/50">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div className="text-left">
            <div className="text-xs sm:text-sm font-medium text-foreground">Sohbete Başlayın</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">Mesaj yazarak başlayın</div>
          </div>
        </div>
      </div>
    </div>
  );
};
