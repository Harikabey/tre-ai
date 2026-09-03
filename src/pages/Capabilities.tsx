import { Link } from 'react-router-dom';
import {
  ArrowLeft, Puzzle, Share2, Bell, Mic, Image as ImageIcon, Film, Brain, Search,
  FileDown, Languages, Camera, ScreenShare, FileText, Smartphone, Package,
  Presentation, Volume2, Sparkles, Clock, FolderOpen, Code2, LayoutGrid, FileInput,
  Star, Lock, Palette, Heart, Eye, Mail, Smile, LucideIcon,
  ArrowUpDown, Minimize2, Cloud, DatabaseBackup, Sunrise, Moon, Eraser
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Capability = {
  icon: LucideIcon;
  title: string;
  desc: string;
  to?: string;
  badge?: string;
};

const GROUPS: { group: string; items: Capability[] }[] = [
  {
    group: 'Sohbet & Zeka',
    items: [
      { icon: Sparkles, title: 'Kişilikler', desc: '6 farklı persona ile sohbet tonunu değiştir.', to: '/settings' },
      { icon: Brain, title: 'Hızlı & Derin Düşünme', desc: 'Karmaşık sorularda adım adım akıl yürütme modu.' },
      { icon: Code2, title: 'Kod Yazma & İç Denetim', desc: 'Kod üretir, kendi içinde test eder, sonra sunar.' },
      { icon: Search, title: 'Web Arama & Kaynaklar', desc: 'Güncel bilgi için canlı arama ve kaynak gösterimi.' },
      { icon: Brain, title: 'Hafıza', desc: 'Seni hatırlar; hafızayı görüntüleyip düzenleyebilirsin.' },
      { icon: Smile, title: 'Emoji Reaksiyonları', desc: 'Mesajlara emoji bırak, Tre duyguya göre yanıt verir.' },
      { icon: Heart, title: 'Duygu Analizi', desc: 'Ruh halini takip eder, gerektiğinde iyileştirme moduna geçer.' },
      { icon: Eye, title: 'Düşünce Görünümü', desc: 'Derin düşünmede Tre\'nin adımlarını canlı izle.', to: '/settings' },
    ],
  },
  {
    group: 'Ses & Canlı',
    items: [
      { icon: Mic, title: 'Sesli Sohbet', desc: 'Tam ekran sesli mod, konuş ve dinle.', to: '/voice-chat' },
      { icon: Volume2, title: '"Hey Tre" Uyandırma', desc: 'İzin verdiğinde adını duyunca uyanır.', to: '/settings' },
      { icon: Camera, title: 'Canlı Kamera Analizi', desc: 'Kameranı aç, gördüğünü yorumlasın.' },
      { icon: ScreenShare, title: 'Ekran Paylaşımı', desc: 'Ekranını paylaş, üzerinde yardım etsin.' },
      { icon: Bell, title: 'Bildirimden Ekran Analizi', desc: 'Bildirimdeki butonla ekranı yakala, cevabı bildirim olarak al.' },
    ],
  },
  {
    group: 'Üretim',
    items: [
      { icon: ImageIcon, title: 'Görsel Üretme', desc: 'Metinden görsel oluşturur ve düzenler.' },
      { icon: Film, title: 'GIF Üretme', desc: 'Sıralı karelerle hareketli görseller.' },
      { icon: Presentation, title: 'Sunum (PPTX)', desc: 'Konudan hazır PowerPoint sunumu.' },
      { icon: Smartphone, title: 'APK Üretme', desc: 'Fikirden PWA site, oradan Android APK.' },
      { icon: Package, title: 'ISO Üretme', desc: 'Dosyalarından ISO 9660 imajı.' },
      { icon: Volume2, title: 'Ses / MP3', desc: 'Metinden doğal seslendirme dosyası.' },
      { icon: FolderOpen, title: 'Üretilen Dosyalar', desc: 'Tüm çıktılar cihazında saklanır, yönetilir.' },
    ],
  },
  {
    group: 'Entegrasyon & Modüller',
    items: [
      { icon: Puzzle, title: 'Tarayıcı Uzantısı', desc: "Herhangi bir sayfada metin seçip Tre'ye sor.", to: '/extension', badge: 'Önizleme' },
      { icon: Share2, title: 'Sistem Paylaşım Menüsü', desc: "Başka uygulamalardan Tre'ye içerik paylaş.", to: '/share-target' },
      { icon: Bell, title: 'Bildirimden Yanıt', desc: 'Uygulamayı açmadan bildirim üzerinden yaz.', to: '/settings' },
      { icon: Clock, title: 'Hatırlatıcılar', desc: "\"Yarın 9'da hatırlat\" de, zamanında bildirsin.", to: '/settings' },
      { icon: LayoutGrid, title: "Ana Ekran Widget'ı", desc: 'Sesli komut al, yanıtı bildirim olarak sun.', to: '/widget-preview', badge: 'Önizleme' },
      { icon: FileInput, title: 'Masaüstü Dosya İşleme', desc: 'Belgeleri doğrudan uygulamada aç ve analiz et.', to: '/file-handler', badge: 'Önizleme' },
      { icon: Mail, title: 'Google Bağlantısı', desc: 'Gmail ve Drive hesabını bağla, e-posta/dosya erişimi.', to: '/settings' },
    ],
  },
  {
    group: 'Kişisel & Gizlilik',
    items: [
      { icon: Star, title: 'Yıldızlı Mesajlar', desc: 'Önemli mesajları yıldızla, tek yerden gör.', to: '/starred' },
      { icon: Lock, title: 'Sohbet Kilitleme', desc: 'Sohbeti şifrele, gizliliğini koru, otomatik kilit.' },
      { icon: Palette, title: 'Arayüz Özelleştirme', desc: 'Vurgu rengi, yazı tipi, baloncuk stili, duvar kağıdı.', to: '/settings' },
    ],
  },
  {
    group: 'Belgeler & Dil',
    items: [
      { icon: FileText, title: 'Belge Okuma', desc: 'PDF ve 70+ dosya türünü okur, özetler.' },
      { icon: FileDown, title: 'Sohbeti PDF Yap', desc: 'Kod ve görseller dahil sohbeti dışa aktar.' },
      { icon: Languages, title: '114 Dil Desteği', desc: 'Mesaj çevirisi ve çok dilli arayüz.', to: '/settings' },
    ],
  },
];

const CapabilityCard = ({ item }: { item: Capability }) => {
  const Icon = item.icon;
  const inner = (
    <div className="group h-full rounded-2xl border border-border/60 bg-card/50 p-4 backdrop-blur-xl transition-all hover:border-primary/40 hover:shadow-glow">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{item.title}</h3>
            {item.badge && (
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                {item.badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
        </div>
      </div>
    </div>
  );

  return item.to ? <Link to={item.to} className="block h-full">{inner}</Link> : inner;
};

const Capabilities = () => {
  const total = GROUPS.reduce((n, g) => n + g.items.length, 0);

  return (
    <main className="min-h-[100dvh] w-full px-4 py-6 pb-[env(safe-area-inset-bottom)] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
            <Link to="/settings" aria-label="Ayarlara dön">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground text-glow sm:text-2xl">
              Tre Ne Yapabilir?
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {total} yetenek ve modül — dokunarak ilgili bölüme git.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {GROUPS.map((g) => (
            <section key={g.group}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
                {g.group}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((item) => (
                  <CapabilityCard key={item.title} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
};

export default Capabilities;
