import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DrawingStudio from '@/components/tre-nt/DrawingStudio';
import ARWorkshop from '@/components/tre-nt/ARWorkshop';
import { isTreNtPet, type TreNtPet } from '@/components/tre-nt/types';

const TreNtPage = () => {
  const [pet, setPet] = useState<TreNtPet | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tre-nt-pet');
      if (!saved) return;
      const parsed: unknown = JSON.parse(saved);
      if (!isTreNtPet(parsed)) {
        toast.error('Kayıtlı Pet verisi geçersiz; AR’a yüklenemedi.');
        return;
      }
      setPet(parsed);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Depolama alanına erişilemedi.';
      toast.error(`Kayıtlı Pet yüklenemedi: ${message}`);
    }
  }, []);

  const removePet = (): string | null => {
    try {
      localStorage.removeItem('tre-nt-pet');
      setPet(null);
      return null;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Depolama alanına erişilemedi.';
      console.error('Tre-nt Pet kaydı silinemedi:', message);
      setPet(null);
      return `Pet’in kayıtlı kopyası silinemedi: ${message}`;
    }
  };

  const [activeTab, setActiveTab] = useState('drawing');

  return (
    <main className="dark min-h-[100dvh] bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex items-center gap-3">
          <Link to="/store" aria-label="Mağazaya dön" className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tre-nt <span className="text-fuchsia-300">🖍️</span></h1>
            <p className="text-sm text-slate-400">Çiz, canlandır, fiziksel dünyana taşı.</p>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid h-auto w-full max-w-lg grid-cols-2 rounded-xl border border-white/10 bg-slate-900 p-1">
            <TabsTrigger value="drawing" className="gap-2 py-3 data-[state=active]:bg-cyan-300 data-[state=active]:text-slate-950">
              <Pencil className="h-4 w-4" />Çizim Stüdyosu
            </TabsTrigger>
            <TabsTrigger value="ar" className="gap-2 py-3 data-[state=active]:bg-fuchsia-300 data-[state=active]:text-slate-950">
              <Camera className="h-4 w-4" />AR Atölyesi
            </TabsTrigger>
          </TabsList>
          <TabsContent value="drawing" forceMount className="mt-0 data-[state=inactive]:hidden">
            <DrawingStudio onSendPet={setPet} />
          </TabsContent>
          <TabsContent value="ar" forceMount className="mt-0 data-[state=inactive]:hidden">
            <ARWorkshop pet={pet} onRemovePet={removePet} isActive={activeTab === 'ar'} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

export default TreNtPage;
