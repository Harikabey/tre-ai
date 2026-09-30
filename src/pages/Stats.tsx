// FILE: src/pages/Stats.tsx
import {
  Activity, ArrowDown, ArrowLeft, ArrowUp, BookOpen, CalendarDays, Code2, Copy,
  Heart, MessageCircle, Search, Sparkles, Trash2, TrendingDown, TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useStats } from '@/hooks/useStats';
import { formatDate, formatNumber, getPercentage, getTopItem, getLast7Days } from '@/lib/stats-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const topicStyles: Record<string, { color: string; icon: typeof Code2 }> = {
  kod: { color: 'text-sky-600 dark:text-sky-400', icon: Code2 },
  ödev: { color: 'text-emerald-600 dark:text-emerald-400', icon: BookOpen },
  sohbet: { color: 'text-violet-600 dark:text-violet-400', icon: MessageCircle },
  duygu: { color: 'text-pink-600 dark:text-pink-400', icon: Heart },
  plan: { color: 'text-orange-600 dark:text-orange-400', icon: CalendarDays },
  arama: { color: 'text-yellow-600 dark:text-yellow-400', icon: Search },
  diğer: { color: 'text-muted-foreground', icon: MessageCircle },
};

const moodEmojis: Record<string, string> = {
  mutlu: '😊', üzgün: '😔', kızgın: '😠', stresli: '😰', yorgun: '😴',
  endişeli: '😟', heyecanlı: '🤩', sakin: '😌', nötr: '😐',
};

const Stats = () => {
  const navigate = useNavigate();
  const { stats, resetStats, getSummary, getTopWords } = useStats();
  const summary = getSummary();
  const topWords = getTopWords(3);
  const topWordCount = topWords[0]?.[1] ?? 0;
  const topicTotal = Object.values(stats.topicCounts).reduce((sum, count) => sum + count, 0);
  const moodTotal = Object.values(stats.sentimentCounts).reduce((sum, count) => sum + count, 0);
  const topTopic = getTopItem(stats.topicCounts);
  const topMood = getTopItem(stats.sentimentCounts);
  const hourlyBuckets = Array.from({ length: 8 }, (_, bucket) => {
    const start = bucket * 3;
    const count = [start, start + 1, start + 2].reduce((sum, hour) => sum + (stats.hourlyActivity[String(hour)] ?? 0), 0);
    return { label: `${String(start).padStart(2, '0')}-${String(start + 3).padStart(2, '0')}`, count };
  });
  const maxHourlyCount = Math.max(1, ...hourlyBuckets.map(bucket => bucket.count));
  const last7Days = getLast7Days();
  const busiestDayThisWeek = last7Days
    .map(day => [day, stats.dailyActivity[day] ?? 0] as [string, number])
    .sort((first, second) => second[1] - first[1])[0];
  const shareText = `Tre ile Konuşma Karnem\n${formatNumber(stats.totalMessages)} mesaj · ${formatNumber(stats.totalWords)} kelime · ${summary.activeDays} aktif gün\nEn çok konu: ${topTopic?.[0] ?? 'henüz yok'}${topWords[0] ? `\nEn sık kelimem: ${topWords[0][0]}` : ''}`;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Kopyalandı!');
    } catch {
      toast.error('Kopyalama başarısız oldu.');
    }
  };

  if (stats.totalMessages === 0) {
    return (
      <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Button variant="ghost" onClick={() => navigate('/settings')} className="mb-8 -ml-3">
            <ArrowLeft className="mr-2 h-4 w-4" /> Ayarlar
          </Button>
          <section className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center text-center">
            <Activity className="mb-5 h-10 w-10 text-primary" />
            <h1 className="text-2xl font-semibold">Henüz istatistik yok. Tre ile sohbet etmeye başla!</h1>
            <Button onClick={() => navigate('/')} className="mt-6">Sohbete Dön</Button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-7">
        <header>
          <Button variant="ghost" onClick={() => navigate('/settings')} className="mb-5 -ml-3">
            <ArrowLeft className="mr-2 h-4 w-4" /> Ayarlar'a dön
          </Button>
          <h1 className="text-2xl font-bold text-foreground">📊 Konuşma Karnen</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tre ile olan yolculuğun</p>
        </header>

        <section aria-labelledby="summary-title" className="space-y-3">
          <h2 id="summary-title" className="text-lg font-semibold">Genel Özet</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Toplam mesaj', stats.totalMessages],
              ['Gönderdiğin mesaj', stats.totalUserMessages],
              ["Tre'nin cevabı", stats.totalTreMessages],
              ['Toplam kelime', stats.totalWords],
              ['İlk sohbet', stats.firstMessageDate ? formatDate(stats.firstMessageDate) : '—'],
              ['Aktif gün', summary.activeDays],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-semibold">{typeof value === 'number' ? formatNumber(value) : value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="grid w-full max-w-sm grid-cols-2">
            <TabsTrigger value="overview">Kelime ve Konular</TabsTrigger>
            <TabsTrigger value="activity">Aktivite ve İçgörü</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <Card>
              <CardHeader><CardTitle className="text-base">En Çok Kullandığın 3 Kelime</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {topWords.length === 0 ? <p className="text-sm text-muted-foreground">Henüz yeterli veri yok.</p> :
                  topWords.map(([word, count], index) => (
                    <div key={word} className="grid grid-cols-[2rem_minmax(4rem,auto)_1fr_auto] items-center gap-3">
                      <span className="text-sm text-muted-foreground">{index + 1}.</span>
                      <span className="font-mono text-sm">{word}</span>
                      <Progress value={getPercentage(count, topWordCount)} className="h-2" />
                      <span className="text-sm tabular-nums">{formatNumber(count)}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Konu Dağılımı</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(stats.topicCounts).sort((a, b) => b[1] - a[1]).map(([topic, count]) => {
                  const style = topicStyles[topic] ?? topicStyles.diğer;
                  const TopicIcon = style.icon;
                  return (
                    <div key={topic} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className={`flex items-center gap-2 capitalize ${style.color}`}><TopicIcon className="h-4 w-4" />{topic}</span>
                        <span className="tabular-nums text-muted-foreground">{getPercentage(count, topicTotal).toFixed(0)}%</span>
                      </div>
                      <Progress value={getPercentage(count, topicTotal)} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-5">
            <Card>
              <CardHeader><CardTitle className="text-base">Saatlik Aktivite</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {hourlyBuckets.map(bucket => (
                  <div key={bucket.label} className="flex items-center gap-3">
                    <span className="w-14 text-xs tabular-nums text-muted-foreground">{bucket.label}</span>
                    <Progress value={getPercentage(bucket.count, maxHourlyCount)} className={`h-2 ${bucket.count === maxHourlyCount ? '[&>div]:bg-foreground' : ''}`} />
                    <span className="w-8 text-right text-xs tabular-nums">{bucket.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Haftalık ve Aylık Trend</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Bu hafta', current: summary.thisWeek, previousLabel: 'geçen hafta', previous: summary.lastWeek },
                  { label: 'Bu ay', current: summary.thisMonth, previousLabel: 'geçen ay', previous: summary.lastMonth },
                ].map(trend => {
                  const TrendIcon = trend.current >= trend.previous ? TrendingUp : TrendingDown;
                  const DeltaIcon = trend.current >= trend.previous ? ArrowUp : ArrowDown;
                  return (
                    <div key={trend.label} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{trend.label}: {formatNumber(trend.current)}</span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <TrendIcon className="h-4 w-4" /> {trend.previousLabel}: {formatNumber(trend.previous)}
                        <DeltaIcon className="ml-1 h-3 w-3" aria-label={trend.current >= trend.previous ? 'artış' : 'azalış'} />
                      </span>
                    </div>
                  );
                })}
                <Separator />
                <p className="text-sm text-muted-foreground">
                  Bu haftanın en aktif günü: {busiestDayThisWeek?.[1] ? formatDate(busiestDayThisWeek[0]) : 'henüz veri yok'}
                  {summary.busiestHour ? ` · En aktif saat: ${String(summary.busiestHour[0]).padStart(2, '0')}:00` : ''}
                </p>
              </CardContent>
            </Card>

            {moodTotal > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Duygu Dağılımı</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(stats.sentimentCounts).sort((a, b) => b[1] - a[1]).map(([mood, count]) => (
                    <div key={mood} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span>{moodEmojis[mood] ?? '💭'} {mood}</span>
                        <span className="text-muted-foreground">{getPercentage(count, moodTotal).toFixed(0)}%</span>
                      </div>
                      <Progress value={getPercentage(count, moodTotal)} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />Kişisel İçgörüler</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {topWords[0] && <p>En sık kullandığın kelime <span className="font-mono font-medium">{topWords[0][0]}</span>; toplam {formatNumber(topWords[0][1])} kez kullandın.</p>}
                {topTopic && <p>En çok <span className="font-medium">{topTopic[0]}</span> konusunu konuştun.</p>}
                {summary.busiestDay && <p>En hareketli günün {formatDate(summary.busiestDay[0])} oldu.</p>}
                {summary.busiestHour && <p>En sık {String(summary.busiestHour[0]).padStart(2, '0')}:00 saatinde sohbet ettin.</p>}
                {topMood && <p>En sık kaydedilen duygu: {moodEmojis[topMood[0]] ?? '💭'} {topMood[0]}.</p>}
                {!topWords.length && !topTopic && !summary.busiestDay && <p>Yeni sohbetlerinle kişisel içgörülerin burada oluşacak.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator />
        <footer className="flex flex-col gap-3 pb-4 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={handleShare}><Copy className="mr-2 h-4 w-4" />Karneni Paylaş</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" />İstatistikleri Sıfırla</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>İstatistikler sıfırlansın mı?</AlertDialogTitle>
                <AlertDialogDescription>Bu işlem yalnızca bu cihazda saklanan konuşma karneni siler ve geri alınamaz.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                <AlertDialogAction onClick={resetStats}>Sıfırla</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </footer>
      </div>
    </main>
  );
};

export default Stats;