import { Sparkles, Brain, Image, MessageSquare } from 'lucide-react';
import aiLogo from '@/assets/ai-logo.jpg';

interface EmptyStateProps {
  onSuggestionClick?: (text: string) => void;
}

const suggestions = [
  { icon: MessageSquare, text: "Bugün nasıl yardımcı olabilirim?", color: "text-primary" },
  { icon: Brain, text: "Bana ilginç bir şey öğret", color: "text-accent" },
  { icon: Image, text: "🎨 Görsel oluştur: gökyüzünde uçan balıklar", color: "text-primary" },
  { icon: Sparkles, text: "Yaratıcı bir hikaye yaz", color: "text-accent" },
];

export const EmptyState = ({ onSuggestionClick }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8 text-center">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-lg mb-4 sm:mb-6">
        <img src={aiLogo} alt="TreFriend AI" className="w-full h-full object-cover" />
      </div>
      
      <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
        TreFriend
      </h2>
      
      <p className="text-sm text-muted-foreground max-w-sm mb-6 sm:mb-8">
        Soru sorun, fikir alın, görsel oluşturun — her konuda yanınızdayım.
      </p>

      {onSuggestionClick && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick(s.text)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs sm:text-sm rounded-xl bg-card/60 border border-border/40 hover:border-primary/30 hover:bg-card/80 transition-all duration-200 group"
            >
              <s.icon className={`w-4 h-4 flex-shrink-0 ${s.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
              <span className="text-muted-foreground group-hover:text-foreground transition-colors truncate">
                {s.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
