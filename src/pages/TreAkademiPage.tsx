import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Award, BookOpen, GraduationCap, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCourseGenerator } from '@/hooks/useCourseGenerator';
import { useLearningMemory, type LearningCourse } from '@/hooks/useLearningMemory';

interface AkademiMessage {
  type?: unknown;
  kind?: unknown;
  courseId?: unknown;
  moduleIndex?: unknown;
  topic?: unknown;
}

const createCourseId = (topic: string): string =>
  `${topic.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 30) || 'kurs'}-${Date.now()}`;

const TreAkademiPage = () => {
  const [topic, setTopic] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  const [activeCourse, setActiveCourse] = useState<LearningCourse | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isGenerating, createCourseHtml } = useCourseGenerator();
  const { courses, saveCourse, recordAttempt, recordModuleCompletion, reviewSuggestion } = useLearningMemory();

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || typeof event.data !== 'object') return;
      const message = event.data as AkademiMessage;
      if (message.type !== 'tre-akademi') return;
      if (typeof message.courseId !== 'string' || typeof message.moduleIndex !== 'number') return;

      if (message.kind === 'quiz_wrong') {
        recordAttempt({
          courseId: message.courseId,
          topic: typeof message.topic === 'string' ? message.topic : activeCourse?.topic ?? '',
          moduleIndex: message.moduleIndex,
          correct: false,
          createdAt: Date.now(),
        });
        toast.info('Yanıt yanlış. Bu modülü tekrar deneyebilirsin.');
      } else if (message.kind === 'quiz_correct') {
        recordAttempt({
          courseId: message.courseId,
          topic: activeCourse?.topic ?? '',
          moduleIndex: message.moduleIndex,
          correct: true,
          createdAt: Date.now(),
        });
      } else if (message.kind === 'xp' || message.kind === 'activity_complete') {
        recordModuleCompletion(message.courseId, message.moduleIndex);
        if (message.kind === 'xp') toast.success('+10 XP kazanıldı!');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeCourse, recordAttempt, recordModuleCompletion]);

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!topic.trim() || isGenerating) return;
    try {
      const courseId = createCourseId(topic);
      const generated = await createCourseHtml(topic, courseId);
      const course: LearningCourse = {
        id: courseId,
        topic: generated.topic,
        createdAt: Date.now(),
        completedModules: [],
        html: generated.html,
        completed: false,
        xpAwarded: 0,
      };
      saveCourse(course);
      setActiveCourse(course);
      setActiveTab('preview');
      toast.success('Kurs hazırlandı!');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Kurs oluşturulamadı.');
    }
  };

  const openCourse = (course: LearningCourse) => {
    setActiveCourse(course);
    setActiveTab('preview');
  };

  const suggestion = reviewSuggestion();

  return (
    <main className="dark min-h-[100dvh] bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex items-center gap-3">
          <Link to="/store" aria-label="Mağazaya dön" className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              <GraduationCap className="h-7 w-7 text-cyan-300" />Tre Akademi
            </h1>
            <p className="text-sm text-slate-400">İstediğin konudan 3 modüllü interaktif kurs üret.</p>
          </div>
        </header>

        {suggestion && (
          <button type="button" onClick={() => setTopic(suggestion.replace('Bu konuyu tekrar etmek ister misin: ', '').replace(/\?$/, '').trim())}
            className="mb-5 w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-left text-sm text-amber-100">
            {suggestion}
          </button>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="grid h-auto w-full max-w-xl grid-cols-3 rounded-xl border border-white/10 bg-slate-900 p-1">
            <TabsTrigger value="create" className="gap-2 py-3 data-[state=active]:bg-cyan-300 data-[state=active]:text-slate-950"><Plus className="h-4 w-4" />Oluştur</TabsTrigger>
            <TabsTrigger value="preview" className="gap-2 py-3 data-[state=active]:bg-cyan-300 data-[state=active]:text-slate-950"><BookOpen className="h-4 w-4" />Önizleme</TabsTrigger>
            <TabsTrigger value="courses" className="gap-2 py-3 data-[state=active]:bg-cyan-300 data-[state=active]:text-slate-950"><GraduationCap className="h-4 w-4" />Benim Kurslarım</TabsTrigger>
          </TabsList>

          <TabsContent value="create" forceMount className="mt-0 data-[state=inactive]:hidden">
            <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 sm:p-7">
              <form onSubmit={handleGenerate} className="flex flex-col gap-3 sm:flex-row">
                <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Örn. Kuantum fiziği, Osmanlı tarihi, Python döngüleri..."
                  className="h-12 border-white/10 bg-slate-950 text-base" />
                <Button type="submit" disabled={isGenerating || !topic.trim()} className="h-12 bg-cyan-300 px-5 text-slate-950 hover:bg-cyan-200">
                  {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />İçerik hazırlanıyor</> : <><Plus className="mr-2 h-4 w-4" />Kurs Oluştur</>}
                </Button>
              </form>
              {isGenerating && (
                <p role="status" className="mt-4 flex items-center gap-2 text-sm text-cyan-200">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kurs içeriği yapay zeka tarafından hazırlanıyor...
                </p>
              )}
            </section>
          </TabsContent>

          <TabsContent value="preview" forceMount className="mt-0 data-[state=inactive]:hidden">
            {activeCourse ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                <iframe ref={iframeRef} title={`${activeCourse.topic} kurs önizlemesi`} srcDoc={activeCourse.html}
                  sandbox="allow-scripts" className="h-[70vh] w-full border-0 bg-slate-950" />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-slate-400">Önizlemek için bir kurs oluşturun veya kataloğunuzdan açın.</div>
            )}
          </TabsContent>

          <TabsContent value="courses" forceMount className="mt-0 data-[state=inactive]:hidden">
            {courses.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {courses.map((course) => (
                  <article key={course.id} className="rounded-2xl border border-white/10 bg-slate-900 p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div><h2 className="font-semibold">{course.topic}</h2><p className="text-xs text-slate-400">{new Date(course.createdAt).toLocaleDateString('tr-TR')} · {course.xpAwarded} XP</p></div>
                      {course.completed && <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-1 text-xs text-amber-300"><Award className="h-3.5 w-3.5" />Tamamlandı</span>}
                    </div>
                    <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full bg-cyan-300 transition-all" style={{ width: `${Math.min(100, (course.completedModules.length / 3) * 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-400">{course.completedModules.length}/3 modül</span><Button variant="outline" size="sm" onClick={() => openCourse(course)}>Aç</Button></div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-slate-400">Henüz oluşturulmuş kurs yok.</div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

export default TreAkademiPage;
