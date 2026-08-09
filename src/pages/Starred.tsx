import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listStarred, removeStarred, StarredMessage } from '@/lib/starredDb';

const Starred = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<StarredMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listStarred().then((r) => { setItems(r); setLoading(false); });
  }, []);

  const handleRemove = async (id: string) => {
    await removeStarred(id);
    setItems((prev) => prev.filter((i) => i.messageId !== id));
  };

  const goToChat = (item: StarredMessage) => {
    navigate('/', { state: { openConversationId: item.chatId, scrollToMessageId: item.messageId } });
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/50 bg-background/80 px-3 py-3 backdrop-blur">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9">
          <Link to="/settings" aria-label="Geri"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Star className="h-4 w-4 text-primary" /> Yıldızlı Mesajlar
        </h1>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 p-3 sm:p-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Henüz yıldızlı mesaj yok. Bir mesajdaki ⭐ simgesine dokun.</p>
        ) : (
          items.map((item) => (
            <article key={item.messageId} className="rounded-xl border border-border/50 bg-card/60 p-3">
              <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                <span className="truncate">{item.chatTitle || 'Sohbet'}</span>
                <span>•</span>
                <span>{new Date(item.timestamp).toLocaleString('tr-TR')}</span>
                <span className="ml-auto">{item.sender === 'bot' ? 'Tre' : 'Sen'}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground/90 line-clamp-6">{item.text}</p>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8" onClick={() => goToChat(item)}>
                  Sohbete git
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => handleRemove(item.messageId)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Kaldır
                </Button>
              </div>
            </article>
          ))
        )}
      </main>
    </div>
  );
};

export default Starred;
