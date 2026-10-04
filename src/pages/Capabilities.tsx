// FILE: src/pages/Capabilities.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Accessibility,
  Activity,
  ArrowLeft,
  Bell,
  Brain,
  Camera,
  ChartNoAxesCombined,
  Check,
  Cloud,
  Code2,
  FileArchive,
  FileInput,
  FileText,
  Film,
  Globe,
  HardDrive,
  Heart,
  Image as ImageIcon,
  Languages,
  LockKeyhole,
  MessageCircle,
  Mic,
  Music,
  Package,
  Palette,
  Presentation,
  Puzzle,
  Search,
  Share2,
  ScreenShare,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  TextCursorInput,
  UserRound,
  Volume2,
  LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Capability = {
  icon: LucideIcon;
  title: string;
  description: string;
  to: string;
  note?: string;
  formats?: string;
  iconColor?: string;
};

type CapabilityGroup = {
  id: string;
  title: string;
  icon: LucideIcon;
  items: Capability[];
};

const GROUPS: CapabilityGroup[] = [
  {
    id: 'chat',
    title: 'Sohbet & Kişilik',
    icon: MessageCircle,
    items: [
      {
        icon: Sparkles,
        title: 'Metin sohbeti',
        description: 'Tre ile sohbet et, konuşmalarını ve eski mesajlarını yönet.',
        to: '/',
      },
      {
        icon: Brain,
        title: 'Kişilik ve düşünme modları',
        description: 'Dokuz hazır kişilikten veya özel kişiliğinden birini seç; hızlı ya da derin düşünme modunu kullan.',
        to: '/settings',
      },
      {
        icon: Languages,
        title: 'Dil seçimi ve çeviri',
        description: 'Arayüz dilini seç, sohbet mesajlarını çevir.',
        to: '/settings',
      },
      {
        icon: Search,
        title: 'Web arama ve kaynaklar',
        description: 'Web aramasıyla güncel sonuçlara ve kaynaklara dayalı yanıtlar al.',
        to: '/',
      },
      {
        icon: UserRound,
        title: 'Kullanıcı hafızası',
        description: 'Tre’nin tuttuğu bilgileri ve ilgi alanlarını görüntüle, düzenle veya sil.',
        to: '/',
      },
      {
        icon: Mic,
        title: 'Sesli sohbet',
        description: 'Sesli sohbet ekranında konuşarak Tre ile etkileşime geç.',
        to: '/voice-chat',
      },
      {
        icon: Volume2,
        title: 'Sesli yanıt ve uyandırma sözcüğü',
        description: 'Yanıtları sesli dinle, desteklenen tarayıcılarda “Hey Tre” uyandırma özelliğini kullan.',
        to: '/settings',
      },
      {
        icon: Code2,
        title: 'Kod yazma ve önizleme',
        description: 'Kod içeren yanıtları görüntüle; desteklenen kodu uygulama içi panelde açıp çalıştır.',
        to: '/',
      },
    ],
  },
  {
    id: 'personalization',
    title: 'Kişiselleştirme',
    icon: Palette,
    items: [
      {
        icon: UserRound,
        title: 'Profil fotoğrafı',
        description: 'Hesabına profil fotoğrafı yükle veya kaldır.',
        to: '/settings',
      },
      {
        icon: Palette,
        title: 'Tema ve arayüz görünümü',
        description: 'Açık, koyu veya sistem temasını; vurgu rengini, yazı tipini, baloncuk biçimini ve duvar kâğıdını seç.',
        to: '/settings',
      },
      {
        icon: ImageIcon,
        title: 'Sohbet arka planı',
        description: 'Sohbet için görsel yükle veya görsel URL’si kullan.',
        to: '/settings',
      },
      {
        icon: TextCursorInput,
        title: 'Metin kısayolları',
        description: 'Kendi tetikleyicilerini ve otomatik genişleyecek metinlerini tanımla.',
        to: '/settings',
      },
      {
        icon: Star,
        title: 'Yıldızlı mesajlar',
        description: 'Önemli mesajları kaydet ve tek bir sayfada tekrar bul.',
        to: '/starred',
      },
      {
        icon: LockKeyhole,
        title: 'Sohbet kilidi',
        description: 'Bir konuşmaya parola koy; sayfa gizlenince kilitli konuşma yeniden gizlenir.',
        to: '/',
      },
    ],
  },
  {
    id: 'production',
    title: '📄 Üretim',
    icon: ImageIcon,
    items: [
      {
        icon: ImageIcon,
        title: 'Metinden görsel üretimi',
        description: 'Sohbetteki isteğini görsele dönüştür ve oluşturulan görseli yanıt olarak al.',
        to: '/',
        iconColor: 'text-violet-500',
      },
      {
        icon: Film,
        title: 'GIF üretimi',
        description: 'Metin isteğinden sıralı karelerle hareketli GIF oluştur.',
        to: '/',
        formats: 'GIF',
        iconColor: 'text-fuchsia-500',
      },
      {
        icon: Film,
        title: 'MP4 / WebM slayt videosu üretimi',
        description: 'İsteğine göre görsel kareler hazırlar ve bunları tarayıcıda kısa bir slayt videosuna dönüştürür; kayıt biçimi tarayıcı desteğine bağlıdır.',
        to: '/',
        formats: 'MP4 veya WebM',
        iconColor: 'text-rose-500',
      },
      {
        icon: Music,
        title: 'MP3 ses ve müzik üretimi',
        description: 'ElevenLabs ile istekten müzik veya konuşma sesi üretip MP3 dosyası olarak sunar.',
        to: '/',
        formats: 'MP3',
        iconColor: 'text-amber-500',
      },
      {
        icon: Presentation,
        title: 'PPTX sunum üretimi',
        description: 'Tek komutla ders, iş veya proje sunumu oluşturur; slaytları indirilebilir bir sunum dosyası olarak hazırlar.',
        to: '/',
        formats: 'PPTX',
        iconColor: 'text-orange-500',
      },
      {
        icon: FileInput,
        title: 'Sohbeti PDF olarak dışa aktarma',
        description: 'Sohbet mesajlarını ve desteklenen içerikleri cihazında PDF dosyasına dönüştür.',
        to: '/',
        formats: 'PDF',
        iconColor: 'text-red-500',
      },
      {
        icon: Package,
        title: 'APK uygulama paketi üretimi',
        description: 'PWABuilder akışıyla PWA’dan veya oluşturulan PWA sitesinden Android uygulama paketi hazırlar.',
        to: '/',
        formats: 'APK ve AAB (ZIP paketi içinde)',
        iconColor: 'text-green-500',
      },
      {
        icon: HardDrive,
        title: 'ISO disk imajı üretimi',
        description: 'Sohbete eklenen dosyalardan ISO disk imajı oluşturur.',
        to: '/',
        formats: 'ISO',
        iconColor: 'text-sky-500',
      },
      {
        icon: Globe,
        title: 'PWA sitesi üretimi',
        description: 'İstekten küçük bir yüklenebilir web uygulaması sitesi oluşturur; bu site APK üretim akışında da kullanılabilir.',
        to: '/',
        formats: 'PWA (HTML, manifest ve ikon)',
        iconColor: 'text-teal-500',
      },
      {
        icon: Volume2,
        title: 'Sesli yanıt (ElevenLabs TTS)',
        description: 'Tre’nin metin yanıtını ElevenLabs metinden konuşmaya dönüştürme ile sesli dinletir.',
        to: '/',
        formats: 'MP3 ses akışı',
        iconColor: 'text-yellow-600',
      },
      {
        icon: Cloud,
        title: 'Üretilen dosyalar',
        description: 'Oluşturulan çıktıları görüntüle ve yönet; istersen yeni çıktıları buluta yedekle.',
        to: '/',
        iconColor: 'text-cyan-500',
      },
    ],
  },
  {
    id: 'analysis',
    title: '🔍 Analiz',
    icon: Search,
    items: [
      {
        icon: FileText,
        title: '70+ formatta belge okuma',
        description: 'Belgeleri sohbete ekleyerek içeriklerini Tre’ye okut; metin ve Office belgeleriyle kod dosyalarını analiz ettir.',
        to: '/',
        formats: 'PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, ODT/ODS/ODP, RTF, TXT, MD/MDX, JSON, CSV, HTML, CSS, XML/SVG, YAML, TOML, LOG, INI, CFG, ENV ve 70+ dosya/kod formatı (JS, TS, Python vb.)',
        iconColor: 'text-blue-500',
      },
      {
        icon: FileText,
        title: 'Belge özetleme',
        description: 'Yüklenen belgenin ana başlıklarını ve önemli noktalarını Türkçe özetler.',
        to: '/',
        iconColor: 'text-indigo-500',
      },
      {
        icon: MessageCircle,
        title: 'Belge hakkında soru-cevap',
        description: 'Belgeyi bağlam olarak kullanarak içeriğiyle ilgili sorularını yanıtlar.',
        to: '/',
        iconColor: 'text-cyan-600',
      },
      {
        icon: Search,
        title: 'Belgeden bilgi çıkarma',
        description: 'Belgede geçen belirli ad, tarih, değer veya diğer bilgileri isteğine göre bulup ayıklar.',
        to: '/',
        iconColor: 'text-emerald-600',
      },
      {
        icon: ImageIcon,
        title: 'Yüklenen görsel analizi',
        description: 'Yüklenen görseli inceler ve görsel hakkında soru sormanı sağlar.',
        to: '/',
        formats: 'JPEG, PNG, GIF, WebP, BMP, TIFF, ICO, AVIF, HEIC/HEIF ve image/*',
        iconColor: 'text-pink-500',
      },
      {
        icon: Camera,
        title: 'Canlı kamera analizi',
        description: 'Kameradan kare yakalar; tek seferlik veya sürekli analizle görüntü hakkında yanıt verir.',
        to: '/',
        iconColor: 'text-rose-600',
      },
      {
        icon: ScreenShare,
        title: 'Ekran paylaşımı analizi',
        description: 'Paylaşılan ekrandan kare yakalayıp ekrandaki içerik hakkında yanıt verir; sürekli analiz de kullanılabilir.',
        to: '/',
        iconColor: 'text-violet-600',
      },
      {
        icon: Film,
        title: 'Video analizi',
        description: 'Yüklenen videodan bir kare çıkarıp görsel analizine gönderir; tüm video boyunca otomatik analiz yapmaz.',
        to: '/',
        formats: 'MP4, MOV, AVI, WebM, MKV',
        iconColor: 'text-red-600',
      },
      {
        icon: Globe,
        title: 'Web arama ve kaynak gösterimi',
        description: 'Web’de arama yaparak güncel sonuçları yanıtına ekler ve bulunan kaynak bağlantılarını gösterir.',
        to: '/',
        iconColor: 'text-sky-600',
      },
      {
        icon: Heart,
        title: 'Mesajlarda duygu analizi',
        description: 'Mesajlardan duygu durumu çıkarır; ruh hâli geçmişini istatistiklerde görüntüleyebilirsin.',
        to: '/istatistik',
        iconColor: 'text-pink-600',
      },
    ],
  },
  {
    id: 'engagement',
    title: 'Bağlılık & Motivasyon',
    icon: ChartNoAxesCombined,
    items: [
      {
        icon: Activity,
        title: 'Sohbet serisi',
        description: 'Günlük kullanım serini ve seri geçmişini takip et.',
        to: '/',
      },
      {
        icon: ChartNoAxesCombined,
        title: 'Konuşma istatistikleri',
        description: 'Mesaj, kelime, konu, duygu ve kullanım etkinliği özetlerini incele.',
        to: '/istatistik',
      },
      {
        icon: Bell,
        title: 'Hatırlatıcılar ve bildirimler',
        description: 'Hatırlatıcı kur, bildirimleri ve bildirimden yanıt vermeyi yönet.',
        to: '/settings',
      },
      {
        icon: Heart,
        title: 'Destekleyici bildirimler',
        description: 'Seri, sohbet yolculuğu ve haftalık ilerleme bildirimlerini; sessiz saatler ve günlük sınırla özelleştir.',
        to: '/settings',
      },
    ],
  },
  {
    id: 'platform',
    title: 'Teknik Altyapı',
    icon: Smartphone,
    items: [
      {
        icon: Smartphone,
        title: 'Yüklenebilir web uygulaması',
        description: 'Desteklenen tarayıcılarda Tre’yi ana ekrana veya masaüstüne yükle.',
        to: '/settings',
      },
      {
        icon: ShieldCheck,
        title: 'Çevrimdışı uygulama kabuğu',
        description: 'Service Worker uygulama kabuğunu ve statik dosyaları önbelleğe alır; bağlantı yoksa çevrimdışı ekranı gösterir.',
        to: '/',
      },
      {
        icon: Share2,
        title: 'Uygulamalar arası paylaşım',
        description: 'Diğer uygulamalardan metin, bağlantı ve desteklenen dosyaları Tre’ye paylaş.',
        to: '/share-target',
      },
      {
        icon: FileInput,
        title: 'Dosyayı Tre ile açma',
        description: 'Desteklenen dosya türlerini işletim sisteminin dosya açma akışından Tre’ye gönder.',
        to: '/file-handler',
      },
      {
        icon: Globe,
        title: 'Google hesabı bağlantısı',
        description: 'Google hesabını bağlayarak izin verdiğin Gmail, Drive ve Takvim işlevlerine eriş.',
        to: '/settings',
      },
      {
        icon: Cloud,
        title: 'Veri yedekleme ve geri yükleme',
        description: 'Uygulama verilerini JSON yedeği olarak dışa aktar veya yedekten geri yükle.',
        to: '/settings',
      },
      {
        icon: Puzzle,
        title: 'Tarayıcı uzantısı önizlemesi',
        description: 'Tarayıcı uzantısı fikrinin uygulama içi önizlemesini görüntüle.',
        to: '/extension',
        note: 'Önizleme',
      },
    ],
  },
  {
    id: 'accessibility',
    title: 'Erişilebilirlik',
    icon: Accessibility,
    items: [
      {
        icon: Accessibility,
        title: 'Yüksek kontrast',
        description: 'Arayüzde yüksek kontrast görünümünü aç veya kapat.',
        to: '/settings',
      },
      {
        icon: TextCursorInput,
        title: 'Metin boyutu',
        description: 'Arayüz metin ölçeğini tercihine göre ayarla.',
        to: '/settings',
      },
      {
        icon: Check,
        title: 'Hareketi azalt',
        description: 'Arayüz animasyonlarını azaltma tercihini etkinleştir.',
        to: '/settings',
      },
    ],
  },
];

const RELEASE_NOTES = [
  {
    date: '4 Ekim 2026',
    title: 'Paylaşım ve dosya alma',
    description: 'Başka uygulamalardan metin, bağlantı ve desteklenen dosyaları Tre’ye gönderme akışı eklendi.',
  },
  {
    date: '3 Ekim 2026',
    title: 'Bildirim tercihleri',
    description: 'Destekleyici bildirim türleri, sessiz saatler ve günlük bildirim limiti için ayarlar eklendi.',
  },
  {
    date: '3 Ekim 2026',
    title: 'Profil fotoğrafı',
    description: 'Ayarlar sayfasına profil fotoğrafı yükleme ve kaldırma alanı eklendi.',
  },
];

const CapabilityCard = ({ item }: { item: Capability }) => {
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      className="group flex h-full min-h-32 rounded-2xl border border-border/60 bg-card/60 p-4 transition-colors hover:border-primary/50 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
      <Icon className={`h-5 w-5 ${item.iconColor ?? 'text-primary'}`} aria-hidden="true" />
      </span>
      <span className="ml-3 flex min-w-0 flex-1 flex-col">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{item.title}</span>
          {item.note && (
            <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {item.note}
            </span>
          )}
        </span>
        <span className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</span>
        {item.formats && (
          <span className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Biçimler: </span>
            {item.formats}
          </span>
        )}
      </span>
    </Link>
  );
};

const Capabilities = () => {
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-6 pb-[env(safe-area-inset-bottom)] text-foreground sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8">
          <Button asChild variant="ghost" className="-ml-3 mb-5 text-muted-foreground">
            <Link to="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Ayarlara dön
            </Link>
          </Button>
          <p className="mb-2 text-sm font-medium text-primary">Tre AI</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Tre Neler Yapabilir?
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Senin için tasarlanmış bir yapay zeka arkadaşı.
          </p>
        </header>

        <div className="space-y-10">
          {GROUPS.map((group) => {
            const GroupIcon = group.icon;
            return (
              <section key={group.id} aria-labelledby={`${group.id}-title`}>
                <h2
                  id={`${group.id}-title`}
                  className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground"
                >
                  <GroupIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                  {group.title}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => (
                    <CapabilityCard key={item.title} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="mt-12 flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild className="w-full sm:w-auto">
            <Link to="/">
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              Tre’yi Keşfet
            </Link>
          </Button>

          <Dialog open={releaseNotesOpen} onOpenChange={setReleaseNotesOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" className="w-full sm:w-auto">
                Sürüm Notları
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Sürüm Notları</DialogTitle>
                <DialogDescription>
                  Depodaki son değişikliklerden doğrulanabilen yenilikler.
                </DialogDescription>
              </DialogHeader>
              <ol className="space-y-5">
                {RELEASE_NOTES.map((release) => (
                  <li key={`${release.date}-${release.title}`} className="border-l-2 border-primary/30 pl-4">
                    <p className="text-xs font-medium text-muted-foreground">{release.date}</p>
                    <h3 className="mt-1 text-sm font-semibold text-foreground">{release.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{release.description}</p>
                  </li>
                ))}
              </ol>
            </DialogContent>
          </Dialog>
        </footer>
      </div>
    </main>
  );
};

export default Capabilities;
