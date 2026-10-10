// FILE: src/pages/Stats.tsx
import {
  Activity, ArrowDown, ArrowLeft, ArrowUp, BookOpen, CalendarDays, Code2, Copy,
  Heart, MessageCircle, Search, Sparkles, Trash2, TrendingDown, TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useT } from '@/hooks/useTranslations';
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
  const t = useT();
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
  const topicKeys: Record<string, string> = {
    kod: 'code', ödev: 'homework', sohbet: 'chat', duygu: 'mood', plan: 'plan', arama: 'search', diğer: 'other',
  };
  const moodKeys: Record<string, string> = {
    mutlu: 'happy', üzgün: 'sad', kızgın: 'angry', stresli: 'stressed', yorgun: 'tired',
    endişeli: 'anxious', heyecanlı: 'excited', sakin: 'calm', nötr: 'neutral',
  };
  const translatedTopic = (topic: string) => t(`stats.topic.${topicKeys[topic] ?? topic}`, { defaultValue: topic });
  const translatedMood = (mood: string) => t(`stats.mood.${moodKeys[mood] ?? mood}`, { defaultValue: mood });
  const shareText = `${t('stats.shareTitle')}\n${formatNumber(stats.totalMessages)} ${t('stats.totalMessages').toLowerCase()} · ${formatNumber(stats.totalWords)} ${t('stats.totalWords').toLowerCase()} · ${summary.activeDays} ${t('stats.activeDays').toLowerCase()}\n${t('stats.shareTopTopic')} ${topTopic ? translatedTopic(topTopic[0]) : t('stats.shareNoTopic')}${topWords[0] ? `\n${t('stats.shareMostFrequentWord')} ${topWords[0][0]}` : ''}`;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success(t('stats.copied'));
    } catch {
      toast.error(t('stats.copyFailed'));
    }
  };

  if (stats.totalMessages === 0) {
    return (
      <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Button variant="ghost" onClick={() => navigate('/settings')} className="mb-8 -ml-3">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t('stats.back')}
          </Button>
          <section className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center text-center">
            <Activity className="mb-5 h-10 w-10 text-primary" />
            <h1 className="text-2xl font-semibold">{t('stats.empty')}</h1>
            <Button onClick={() => navigate('/')} className="mt-6">{t('stats.returnToChat')}</Button>
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
            <ArrowLeft className="mr-2 h-4 w-4" /> {t('stats.backToSettings')}
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{t('stats.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('stats.journey')}</p>
        </header>

        <section aria-labelledby="summary-title" className="space-y-3">
          <h2 id="summary-title" className="text-lg font-semibold">{t('stats.summary')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [t('stats.totalMessages'), stats.totalMessages],
              [t('stats.userMessages'), stats.totalUserMessages],
              [t('stats.treMessages'), stats.totalTreMessages],
              [t('stats.totalWords'), stats.totalWords],
              [t('stats.firstChat'), stats.firstMessageDate ? formatDate(stats.firstMessageDate) : '—'],
              [t('stats.activeDays'), summary.activeDays],
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
            <TabsTrigger value="overview">{t('stats.wordsAndTopics')}</TabsTrigger>
            <TabsTrigger value="activity">{t('stats.activityAndInsights')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <Card>
              <CardHeader><CardTitle className="text-base">{t('stats.topWords')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {topWords.length === 0 ? <p className="text-sm text-muted-foreground">{t('stats.insufficientData')}</p> :
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
              <CardHeader><CardTitle className="text-base">{t('stats.topicDistribution')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(stats.topicCounts).sort((a, b) => b[1] - a[1]).map(([topic, count]) => {
                  const style = topicStyles[topic] ?? topicStyles.diğer;
                  const TopicIcon = style.icon;
                  return (
                    <div key={topic} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className={`flex items-center gap-2 capitalize ${style.color}`}><TopicIcon className="h-4 w-4" />{translatedTopic(topic)}</span>
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
              <CardHeader><CardTitle className="text-base">{t('stats.hourlyActivity')}</CardTitle></CardHeader>
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
              <CardHeader><CardTitle className="text-base">{t('stats.weeklyMonthlyTrend')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: t('stats.thisWeek'), current: summary.thisWeek, previousLabel: t('stats.lastWeek'), previous: summary.lastWeek },
                  { label: t('stats.thisMonth'), current: summary.thisMonth, previousLabel: t('stats.lastMonth'), previous: summary.lastMonth },
                ].map(trend => {
                  const TrendIcon = trend.current >= trend.previous ? TrendingUp : TrendingDown;
                  const DeltaIcon = trend.current >= trend.previous ? ArrowUp : ArrowDown;
                  return (
                    <div key={trend.label} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{trend.label}: {formatNumber(trend.current)}</span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <TrendIcon className="h-4 w-4" /> {trend.previousLabel}: {formatNumber(trend.previous)}
                        <DeltaIcon className="ml-1 h-3 w-3" aria-label={trend.current >= trend.previous ? t('stats.increase') : t('stats.decrease')} />
                      </span>
                    </div>
                  );
                })}
                <Separator />
                <p className="text-sm text-muted-foreground">
                  {t('stats.busiestDay')}: {busiestDayThisWeek?.[1] ? formatDate(busiestDayThisWeek[0]) : t('stats.noData')}
                  {summary.busiestHour ? ` · ${t('stats.busiestHour')}: ${String(summary.busiestHour[0]).padStart(2, '0')}:00` : ''}
                </p>
              </CardContent>
            </Card>

            {moodTotal > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">{t('stats.moodDistribution')}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(stats.sentimentCounts).sort((a, b) => b[1] - a[1]).map(([mood, count]) => (
                    <div key={mood} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span>{moodEmojis[mood] ?? '💭'} {translatedMood(mood)}</span>
                        <span className="text-muted-foreground">{getPercentage(count, moodTotal).toFixed(0)}%</span>
                      </div>
                      <Progress value={getPercentage(count, moodTotal)} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />{t('stats.personalInsights')}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {topWords[0] && <p>{t('stats.mostUsedWord')} <span className="font-mono font-medium">{topWords[0][0]}</span>; {formatNumber(topWords[0][1])} {t('stats.timesUsed')}</p>}
                {topTopic && <p>{t('stats.mostDiscussedTopic')} <span className="font-medium">{translatedTopic(topTopic[0])}</span> {t('stats.topicSuffix')}</p>}
                {summary.busiestDay && <p>{t('stats.mostActiveDay')} {formatDate(summary.busiestDay[0])} {t('stats.was')}</p>}
                {summary.busiestHour && <p>{t('stats.mostFrequentHour')} {String(summary.busiestHour[0]).padStart(2, '0')}:00 {t('stats.chattedAt')}</p>}
                {topMood && <p>{t('stats.mostRecordedMood')} {moodEmojis[topMood[0]] ?? '💭'} {translatedMood(topMood[0])}.</p>}
                {!topWords.length && !topTopic && !summary.busiestDay && <p>{t('stats.newChatsInsight')}</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator />
        <footer className="flex flex-col gap-3 pb-4 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={handleShare}><Copy className="mr-2 h-4 w-4" />{t('stats.share')}</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" />{t('stats.reset')}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('stats.resetConfirm')}</AlertDialogTitle>
                <AlertDialogDescription>{t('stats.resetDescription')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('stats.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={resetStats}>{t('stats.confirmReset')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </footer>
      </div>
    </main>
  );
};

export default Stats;