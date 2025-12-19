import { Bot, MessageSquare, Sparkles, Brain } from 'lucide-react';

export const EmptyState = () => {
  const suggestions = [
    { icon: MessageSquare, text: 'Merhaba!' },
    { icon: Brain, text: 'Yapay zeka nedir?' },
    { icon: Sparkles, text: 'Sen kimsin?' },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-fade-in">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 shadow-glow-lg">
        <Bot className="w-10 h-10 text-primary" />
      </div>
      
      <h2 className="text-2xl font-semibold text-foreground mb-2 text-glow">
        Merhaba! Ben Öğrenebilen AI
      </h2>
      <p className="text-muted-foreground max-w-md mb-8">
        Benimle sohbet edebilir ve yeni şeyler öğretebilirsiniz. 
        Öğrenme modu açıkken bilmediğim sorulara cevap öğretebilirsiniz.
      </p>
      
      <div className="flex flex-wrap gap-2 justify-center">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-4 py-2 bg-secondary/50 border border-border/50 rounded-full text-sm text-secondary-foreground hover:border-primary/30 transition-colors cursor-default"
          >
            <suggestion.icon className="w-4 h-4 text-primary" />
            {suggestion.text}
          </div>
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-accent/5 border border-accent/20 rounded-xl max-w-sm">
        <div className="flex items-center gap-2 text-accent mb-2">
          <Sparkles className="w-4 h-4" />
          <span className="font-medium text-sm">Öğretme İpucu</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Bilmediğim bir soruya cevap vermemi isterseniz, 
          <code className="mx-1 px-1.5 py-0.5 bg-accent/10 rounded text-accent">/öğret [cevap]</code>
          yazarak öğretebilirsiniz.
        </p>
      </div>
    </div>
  );
};
