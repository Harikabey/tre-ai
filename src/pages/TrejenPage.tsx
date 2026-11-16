import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, AudioLines, Download, ListMusic, Pause, Play, Plus, Radio, Save, SlidersHorizontal, Trash2, Volume2, VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TreAssistant from '@/components/TreAssistant';
import {
  DEFAULT_PROJECT, exportProjectWav, loadStudioProject, saveStudioProject, useAudioEngine,
  type InstrumentType, type PianoNote, type StudioChannel, type StudioProject,
} from '@/hooks/useAudioEngine';

type StudioTab = 'rack' | 'piano' | 'mixer' | 'playlist';

const instrumentOptions: { type: InstrumentType; name: string }[] = [
  { type: 'kick', name: 'Kick' },
  { type: 'snare', name: 'Snare' },
  { type: 'hat', name: 'Hi-hat' },
  { type: 'piano', name: 'Piyano' },
  { type: 'synth', name: 'Synth' },
  { type: 'bass', name: 'Bas' },
];

const noteNames = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
const pitchName = (pitch: number) => `${noteNames[pitch % 12]}${Math.floor(pitch / 12) - 1}`;

const TrejenPage = () => {
  const [project, setProject] = useState<StudioProject>(DEFAULT_PROJECT);
  const [activeTab, setActiveTab] = useState<StudioTab>('rack');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [newChannelType, setNewChannelType] = useState<InstrumentType>('synth');
  const projectRef = useRef(project);
  const playheadRef = useRef(0);
  const { playSound } = useAudioEngine();

  useEffect(() => {
    try {
      setProject(loadStudioProject());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Trejen projesi yüklenemedi.');
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    projectRef.current = project;
    if (!isLoaded) return;
    try {
      saveStudioProject(project);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Trejen projesi kaydedilemedi.');
    }
  }, [project, isLoaded]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const intervalId = window.setInterval(() => {
      const currentProject = projectRef.current;
      const nextStep = (playheadRef.current + 1) % 64;
      playheadRef.current = nextStep;
      setPlayhead(nextStep);
      const bar = Math.floor(nextStep / 16);
      const step = nextStep % 16;
      if (!currentProject.arrangement[bar]) return;

      try {
        currentProject.channels.forEach((channel) => {
          if (channel.steps[step]) playSound(currentProject, channel);
        });
        const piano = currentProject.channels.find((channel) => channel.type === 'piano');
        if (piano) {
          currentProject.notes
            .filter((note) => note.step === step)
            .forEach((note) => playSound(currentProject, piano, note.pitch, note.duration * (60 / currentProject.bpm / 4)));
        }
      } catch (error) {
        setIsPlaying(false);
        toast.error(error instanceof Error ? error.message : 'Ses motoru başlatılamadı.');
      }
    }, 60_000 / project.bpm / 4);
    return () => window.clearInterval(intervalId);
  }, [isPlaying, playSound, project.bpm]);

  const toggleStep = (channelId: string, step: number) => {
    setProject((current) => ({
      ...current,
      channels: current.channels.map((channel) => channel.id === channelId
        ? { ...channel, steps: channel.steps.map((active, index) => index === step ? !active : active) }
        : channel),
    }));
  };

  const toggleNote = (step: number, pitch: number) => {
    setProject((current) => {
      const existing = current.notes.find((note) => note.step === step && note.pitch === pitch);
      return {
        ...current,
        notes: existing
          ? current.notes.filter((note) => note.id !== existing.id)
          : [...current.notes, { id: `note-${Date.now()}-${pitch}-${step}`, step, pitch, duration: 2 }],
      };
    });
  };

  const updateChannel = (channelId: string, changes: Partial<StudioChannel>) => {
    setProject((current) => ({
      ...current,
      channels: current.channels.map((channel) => channel.id === channelId ? { ...channel, ...changes } : channel),
    }));
  };

  const addChannel = () => {
    const option = instrumentOptions.find((item) => item.type === newChannelType);
    if (!option) return;
    const id = `${newChannelType}-${Date.now()}`;
    setProject((current) => ({
      ...current,
      channels: [...current.channels, {
        id, name: option.name, type: newChannelType, volume: 70, pan: 0, muted: false, steps: Array(16).fill(false),
      }],
    }));
  };

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    const currentProject = projectRef.current;
    const firstActiveBar = currentProject.arrangement.findIndex(Boolean);
    if (firstActiveBar < 0) {
      toast.error('Çalmak için Çalma Listesi sekmesinde en az bir ölçüyü etkinleştirin.');
      return;
    }
    const startStep = playheadRef.current;
    const bar = Math.floor(startStep / 16);
    const step = startStep % 16;
    if (!currentProject.arrangement[bar]) {
      const nextActiveBar = currentProject.arrangement.findIndex((active, index) => index > bar && active);
      const nextStep = nextActiveBar >= 0 ? nextActiveBar * 16 : Math.max(0, firstActiveBar) * 16;
      playheadRef.current = nextStep;
      setPlayhead(nextStep);
    }
    const activeStep = currentProject.arrangement[bar] ? step : 0;
    try {
      currentProject.channels.forEach((channel) => {
        if (channel.steps[activeStep]) playSound(currentProject, channel);
      });
      currentProject.notes
        .filter((note) => note.step === activeStep)
        .forEach((note) => {
          const piano = currentProject.channels.find((channel) => channel.type === 'piano');
          if (piano) playSound(currentProject, piano, note.pitch, note.duration * (60 / currentProject.bpm / 4));
        });
      setIsPlaying(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ses motoru başlatılamadı.');
    }
  };

  const exportWav = async () => {
    setIsExporting(true);
    try {
      const wav = await exportProjectWav(project);
      const url = URL.createObjectURL(wav);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'trejen-projem.wav';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Projen WAV olarak dışa aktarıldı.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'WAV dışa aktarılamadı.');
    } finally {
      setIsExporting(false);
    }
  };

  const addMelody = (notes: PianoNote[]) => setProject((current) => ({ ...current, notes }));
  const tabs: { id: StudioTab; label: string; icon: typeof Radio }[] = [
    { id: 'rack', label: 'Kanal Rack', icon: Radio },
    { id: 'piano', label: 'Piyano Rulosu', icon: AudioLines },
    { id: 'mixer', label: 'Mikser', icon: SlidersHorizontal },
    { id: 'playlist', label: 'Çalma Listesi', icon: ListMusic },
  ];

  return (
    <main className="dark min-h-[100dvh] bg-[#090d16] px-3 py-4 text-slate-100 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <Link to="/store" aria-label="Mağazaya dön" className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">Trejen <span className="text-cyan-300">🎛️</span></h1>
            <p className="text-sm text-slate-400">Tarayıcı içi müzik stüdyosu <span className="text-slate-600">/</span> {isLoaded ? 'Otomatik kaydediliyor' : 'Proje yükleniyor…'}</p>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-wider text-slate-500">BPM</span>
            <Input
              aria-label="Tempo BPM"
              type="number"
              min={50}
              max={200}
              value={project.bpm}
              onChange={(event) => {
                const bpm = Number(event.target.value);
                if (bpm >= 50 && bpm <= 200) setProject((current) => ({ ...current, bpm }));
              }}
              className="h-8 w-16 border-0 bg-transparent px-1 text-center font-mono text-cyan-200 focus-visible:ring-0"
            />
          </label>
          <Button onClick={togglePlayback} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
            {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {isPlaying ? 'Durdur' : 'Çal'}
          </Button>
          <Button variant="outline" onClick={() => void exportWav()} disabled={isExporting} className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white">
            {isExporting ? <AudioLines className="mr-2 h-4 w-4 animate-pulse" /> : <Download className="mr-2 h-4 w-4" />}
            WAV
          </Button>
        </header>

        <section className="mb-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101622] shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-cyan-300/10 p-2.5 text-cyan-200"><AudioLines className="h-5 w-5" /></div>
              <div><h2 className="font-semibold">Stüdyo</h2><p className="text-xs text-slate-500">16 adımlı ritim · 2 oktav piyano rulosu</p></div>
            </div>
            <nav aria-label="Stüdyo görünümleri" className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1 sm:flex">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setActiveTab(id)}
                  aria-current={activeTab === id ? 'page' : undefined}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition ${activeTab === id ? 'bg-cyan-300 text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}
                >
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </nav>
          </div>

          {activeTab === 'rack' && (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-semibold">Kanal Rack</h3><p className="text-xs text-slate-500">Adımlara tıklayarak ritim yaz veya kanalı tek başına dinle.</p></div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Eklenecek kanal türü"
                    value={newChannelType}
                    onChange={(event) => setNewChannelType(event.target.value as InstrumentType)}
                    className="h-9 rounded-lg border border-white/10 bg-slate-900 px-2 text-sm text-slate-200"
                  >
                    {instrumentOptions.map((option) => <option key={option.type} value={option.type}>{option.name}</option>)}
                  </select>
                  <Button size="sm" onClick={addChannel} className="bg-white/10 text-slate-100 hover:bg-white/15"><Plus className="mr-1 h-4 w-4" />Kanal ekle</Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[150px_repeat(16,minmax(28px,1fr))] gap-1 border-b border-white/[0.06] bg-black/15 px-2 py-2">
                    <span className="self-center text-xs uppercase tracking-wider text-slate-600">Kanal / adım</span>
                    {Array.from({ length: 16 }, (_, step) => <span key={step} className={`text-center font-mono text-xs ${step % 4 === 0 ? 'text-cyan-300' : 'text-slate-600'}`}>{step + 1}</span>)}
                  </div>
                  {project.channels.map((channel) => (
                    <div key={channel.id} className="grid grid-cols-[150px_repeat(16,minmax(28px,1fr))] gap-1 border-b border-white/[0.04] px-2 py-2 last:border-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          aria-label={`${channel.name} kanalını ${channel.muted ? 'aç' : 'kıs'}`}
                          onClick={() => updateChannel(channel.id, { muted: !channel.muted })}
                          className={`rounded-md p-1.5 ${channel.muted ? 'text-slate-600' : 'text-cyan-200 hover:bg-cyan-300/10'}`}
                        >{channel.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
                        <button type="button" onClick={() => {
                          try { playSound(project, channel, 60, 0.3); } catch (error) {
                            toast.error(error instanceof Error ? error.message : 'Ses çalınamadı.');
                          }
                        }} className="min-w-0 truncate text-left text-sm text-slate-200 hover:text-cyan-200">{channel.name}</button>
                        <span className="ml-auto pr-1 text-[10px] uppercase text-slate-600">{channel.type}</span>
                      </div>
                      {channel.steps.map((active, step) => (
                        <button
                          key={step}
                          type="button"
                          onClick={() => toggleStep(channel.id, step)}
                          aria-label={`${channel.name}, ${step + 1}. adım ${active ? 'etkin' : 'boş'}`}
                          aria-pressed={active}
                          className={`h-8 rounded-md border transition ${active ? 'border-cyan-200/50 bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.2)]' : step % 4 === 0 ? 'border-white/10 bg-white/[0.045] hover:border-white/25' : 'border-white/[0.04] bg-white/[0.02] hover:border-white/15'}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500">Kanal ses düzeyi ve pan ayarları Mikser sekmesinden yapılır. Sesler Web Audio API ile bu cihazda sentezlenir.</p>
            </div>
          )}

          {activeTab === 'piano' && (
            <div className="p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="font-semibold">Piyano Rulosu</h3><p className="text-xs text-slate-500">Izgaraya tıklayarak nota ekle veya kaldır.</p></div>
                <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">{project.notes.length} nota</span>
              </div>
              <div className="overflow-auto rounded-xl border border-white/[0.07]">
                <div className="min-w-[740px]">
                  <div className="grid grid-cols-[56px_repeat(16,minmax(32px,1fr))] gap-px bg-white/[0.06]">
                    <span className="bg-[#111824]" />
                    {Array.from({ length: 16 }, (_, step) => <span key={step} className={`bg-[#111824] py-2 text-center font-mono text-[10px] ${step % 4 === 0 ? 'text-cyan-300' : 'text-slate-600'}`}>{step + 1}</span>)}
                    {Array.from({ length: 25 }, (_, row) => {
                      const pitch = 72 - row;
                      const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
                      return (
                        <div key={pitch} className="contents">
                          <span className={`flex items-center justify-end bg-[#111824] pr-2 font-mono text-[10px] ${pitch % 12 === 0 ? 'text-cyan-200' : 'text-slate-500'}`}>{pitchName(pitch)}</span>
                          {Array.from({ length: 16 }, (_, step) => {
                            const note = project.notes.find((item) => item.step === step && item.pitch === pitch);
                            return (
                              <button
                                key={`${pitch}-${step}`}
                                type="button"
                                onClick={() => toggleNote(step, pitch)}
                                aria-label={`${pitchName(pitch)}, ${step + 1}. adım ${note ? 'notayı sil' : 'nota ekle'}`}
                                aria-pressed={Boolean(note)}
                                className={`h-7 transition ${note ? 'rounded-sm bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.25)]' : isBlack ? 'bg-[#121827] hover:bg-violet-400/20' : 'bg-[#182130] hover:bg-violet-400/15'} ${step % 4 === 0 ? 'border-l border-white/10' : ''}`}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {project.notes.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => addMelody([])} className="mt-3 text-slate-400 hover:text-white">
                  <Trash2 className="mr-2 h-4 w-4" />Tüm notaları sil
                </Button>
              )}
            </div>
          )}

          {activeTab === 'mixer' && (
            <div className="p-4">
              <div className="mb-4"><h3 className="font-semibold">Mikser</h3><p className="text-xs text-slate-500">Kanal seviyelerini, panoramayı ve ana efektleri ayarla.</p></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {project.channels.map((channel, index) => (
                  <article key={channel.id} className="rounded-xl border border-white/[0.07] bg-black/15 p-4">
                    <div className="mb-4 flex items-center justify-between"><div><p className="text-xs text-slate-500">KANAL {String(index + 1).padStart(2, '0')}</p><h4 className="font-medium">{channel.name}</h4></div><button type="button" onClick={() => updateChannel(channel.id, { muted: !channel.muted })} aria-label={`${channel.name} kanalını ${channel.muted ? 'aç' : 'kıs'}`} className={channel.muted ? 'text-slate-600' : 'text-cyan-200'}>{channel.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button></div>
                    <label className="mb-4 block text-xs text-slate-400">Ses seviyesi <span className="float-right font-mono text-slate-300">{channel.volume}%</span>
                      <input type="range" min="0" max="100" value={channel.volume} onChange={(event) => updateChannel(channel.id, { volume: Number(event.target.value) })} className="mt-2 h-1.5 w-full accent-cyan-300" />
                    </label>
                    <label className="block text-xs text-slate-400">Pan <span className="float-right font-mono text-slate-300">{channel.pan < 0 ? `L ${Math.abs(channel.pan)}` : channel.pan > 0 ? `R ${channel.pan}` : 'C'}</span>
                      <input aria-label={`${channel.name} pan`} type="range" min="-100" max="100" value={channel.pan} onChange={(event) => updateChannel(channel.id, { pan: Number(event.target.value) })} className="mt-2 h-1.5 w-full accent-violet-300" />
                    </label>
                  </article>
                ))}
              </div>
              <div className="mt-4 grid gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-4 sm:grid-cols-2">
                <label className="text-sm text-slate-300">EQ · tiz frekans <span className="float-right font-mono text-cyan-200">{project.eq}%</span>
                  <input type="range" min="0" max="100" value={project.eq} onChange={(event) => setProject((current) => ({ ...current, eq: Number(event.target.value) }))} className="mt-3 h-1.5 w-full accent-cyan-300" />
                </label>
                <label className="text-sm text-slate-300">Reverb <span className="float-right font-mono text-cyan-200">{project.reverb}%</span>
                  <input type="range" min="0" max="100" value={project.reverb} onChange={(event) => setProject((current) => ({ ...current, reverb: Number(event.target.value) }))} className="mt-3 h-1.5 w-full accent-violet-300" />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'playlist' && (
            <div className="p-4">
              <div className="mb-4"><h3 className="font-semibold">Çalma Listesi</h3><p className="text-xs text-slate-500">Dört ölçülük aranjmanda çalınacak bölümleri seç.</p></div>
              <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
                <div className="grid min-w-[640px] grid-cols-[120px_repeat(4,minmax(100px,1fr))]">
                  <div className="border-b border-r border-white/[0.06] bg-black/15 p-3 text-xs text-slate-500">Düzenleme</div>
                  {project.arrangement.map((active, bar) => (
                    <button
                      type="button"
                      key={bar}
                      aria-pressed={active}
                      onClick={() => setProject((current) => ({
                        ...current,
                        arrangement: current.arrangement.map((enabled, index) => index === bar ? !enabled : enabled),
                      }))}
                      className={`border-b border-r border-white/[0.06] p-3 text-left transition last:border-r-0 ${active ? 'bg-cyan-300/[0.07]' : 'bg-black/20 opacity-50'}`}
                    >
                      <span className="mb-2 block font-mono text-xs text-slate-500">ÖLÇÜ {bar + 1}</span>
                      <span className={`flex h-16 items-center justify-center rounded-lg border text-sm ${active ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/[0.02] text-slate-600'}`}>
                        {active ? `${project.channels.length} kanal · ${project.notes.length} nota` : 'Sessiz'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Save className="h-3.5 w-3.5 text-cyan-300" />Düzenleme ve proje değişiklikleri bu tarayıcıya otomatik kaydedilir.</div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-cyan-300" />Çalma konumu: Ölçü {Math.floor(playhead / 16) + 1}, adım {(playhead % 16) + 1}</div>
            </div>
          )}
        </section>
        <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center text-xs text-slate-600">
          <span>Ses sentezi cihazınızda gerçekleşir</span><span>·</span><span>Proje tarayıcı belleğinde saklanır</span><span>·</span><span>WAV dışa aktarma çevrimdışıdır</span>
        </footer>
      </div>
      <TreAssistant project={project} onProjectChange={setProject} />
    </main>
  );
};

export default TrejenPage;
