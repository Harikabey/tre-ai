import { useState } from 'react';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TryTreButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUsedDemo, setHasUsedDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!userMessage.trim() || hasUsedDemo || isLoading) return;

    setIsLoading(true);
    setError(null);
    setReply(null);

    try {
      const apiKey = import.meta.env.VITE_TRE_DEMO_API_KEY;

      if (!apiKey) {
        throw new Error('API anahtarı bulunamadı');
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
        },
        body: JSON.stringify({
          model: 'openrouter/free',
          messages: [
            { role: 'system', content: "Sen Tre'sin, samimi ve yardımsever bir AI arkadaşsın. Kısa ve öz cevap ver." },
            { role: 'user', content: userMessage.trim() },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`API hatası: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || 'Cevap alınamadı.';
      setReply(content);
      setHasUsedDemo(true);
    } catch (err) {
      setError('Bağlantı hatası, tekrar deneyin.');
      console.error('Demo API hatası:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setUserMessage('');
    setReply(null);
    setError(null);
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-3 rounded-full shadow-lg shadow-primary/20 transition-all duration-200 hover:scale-105"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Tre'yi Dene
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md bg-card/95 backdrop-blur-lg border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-secondary/30">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">Tre'yi Dene</span>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {!hasUsedDemo && !reply && (
                <>
                  <p className="text-sm text-muted-foreground">
                    1 mesaj hakkın var. Tre'ye bir şey sor, nasıl cevap verdiğini gör.
                  </p>
                  <Input
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    placeholder="Merhaba Tre, nasılsın?"
                    disabled={isLoading}
                    autoFocus
                  />
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <Button
                    onClick={handleSend}
                    disabled={!userMessage.trim() || isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Gönder
                      </>
                    )}
                  </Button>
                </>
              )}

              {reply && (
                <>
                  <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                    <div className="text-[10px] text-muted-foreground mb-1">Sen:</div>
                    <p className="text-sm text-foreground">{userMessage}</p>
                  </div>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="text-[10px] text-primary mb-1">Tre:</div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{reply}</p>
                  </div>
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                    Demo hakkınız doldu. Tre'ye tam erişim için kayıt olun.
                  </div>
                  <Button onClick={handleClose} variant="outline" className="w-full">
                    Kapat
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TryTreButton;
