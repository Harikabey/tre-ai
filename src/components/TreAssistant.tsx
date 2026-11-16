import { useState, type FormEvent } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PianoNote, StudioProject } from '@/hooks/useAudioEngine';

interface TreAssistantProps {
  project: StudioProject;
  onProjectChange: (project: StudioProject) => void;
}

interface AssistantMessage {
  role: 'user' | 'tre';
  text: string;
}

const makeNote = (step: number, pitch: number, duration = 2): PianoNote => ({
  id: `tre-${Date.now()}-${step}-${pitch}`,
  step,
  pitch,
  duration,
});

const pitchNames = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const chordTypes = [
  { intervals: [0, 4, 7], suffix: ' majör' },
  { intervals: [0, 3, 7], suffix: ' minör' },
  { intervals: [0, 3, 6], suffix: ' eksiltilmiş' },
  { intervals: [0, 4, 8], suffix: ' artırılmış' },
];

const identifyChords = (notes: PianoNote[]) => {
  const grouped = new Map<number, PianoNote[]>();
  notes.forEach((note) => grouped.set(note.step, [...(grouped.get(note.step) ?? []), note]));
  return [...grouped.values()].flatMap((group) => {
    const pitches = [...new Set(group.map((note) => note.pitch % 12))];
    if (pitches.length < 3) return [];
    for (const root of pitches) {
      const intervals = pitches.map((pitch) => (pitch - root + 12) % 12).sort((a, b) => a - b);
      const chord = chordTypes.find((candidate) => (
        candidate.intervals.length === intervals.length
        && candidate.intervals.every((interval, index) => interval === intervals[index])
      ));
      if (chord) return [`${pitchNames[root]}${chord.suffix}`];
    }
    return ['Üç veya daha fazla notalı akor (türü tanınmadı)'];
  });
};

const TreAssistant = ({ project, onProjectChange }: TreAssistantProps) => {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { role: 'tre', text: 'Merhaba! Melodi, ritim, akor veya miks için ne yapalım?' },
  ]);

  const respond = (text: string) => {
    const command = text.toLocaleLowerCase('tr-TR');
    let response: string;

    if (command.includes('akor') && (command.includes('öner') || command.includes('ekle'))) {
      const progression = [
        [48, 51, 55],
        [56, 60, 63],
        [51, 55, 58],
        [58, 62, 65],
      ];
      onProjectChange({
        ...project,
        notes: [
          ...project.notes,
          ...progression.flatMap((chord, index) => chord.map((pitch) => makeNote(index * 4, pitch, 4))),
        ],
      });
      response = 'Do minör → La♭ majör → Mi♭ majör → Si♭ majör akor dizisini mevcut notalarına ekledim.';
    } else if (command.includes('bas') && (command.includes('yüksek') || command.includes('kıs') || command.includes('çok'))) {
      const bass = project.channels.find((channel) => channel.type === 'bass');
      if (!bass) {
        response = 'Bas kanalı bulunamadı. Kanal Rack’e bir bas kanalı ekleyebilirsin.';
      } else {
        onProjectChange({
          ...project,
          channels: project.channels.map((channel) => (
            channel.id === bass.id ? { ...channel, volume: Math.max(0, channel.volume - 20) } : channel
          )),
        });
        response = `Bas kanalının sesini ${Math.max(0, bass.volume - 20)}% seviyesine indirdim.`;
      }
    } else if (command.includes('bas') && (command.includes('melodi') || command.includes('eşlik') || command.includes('hattı'))) {
      const bass = project.channels.find((channel) => channel.type === 'bass');
      if (!bass) {
        response = 'Bas kanalı bulunamadı. Kanal Rack’e bir bas kanalı ekleyebilirsin.';
      } else {
        onProjectChange({
          ...project,
          channels: project.channels.map((channel) => channel.id === bass.id
            ? { ...channel, muted: false, steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false] }
            : channel),
        });
        response = 'Bas kanalını açıp her vuruşta çalacak bir bas eşliği ekledim. Sesini Mikser sekmesinden ayarlayabilirsin.';
      }
    } else if (command.includes('davul') || command.includes('ritim')) {
      const beat = {
        kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
        snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
        hat: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
      };
      onProjectChange({
        ...project,
        channels: project.channels.map((channel) => {
          const steps = channel.type === 'kick'
            ? beat.kick
            : channel.type === 'snare'
              ? beat.snare
              : channel.type === 'hat'
                ? beat.hat
                : null;
          return steps ? { ...channel, muted: false, steps: [...steps] } : channel;
        }),
      });
      response = 'Dört vuruşlu kick, ikinci ve dördüncü vuruşta snare ve sekizlik hi-hat ritmini ekledim.';
    } else if (command.includes('akor')) {
      const chords = identifyChords(project.notes);
      if (chords.length > 0) {
        response = `Piyano rulosunda aynı anda çalan notalara göre bulduğum akorlar: ${chords.join(' → ')}. Alternatif olarak Do minör → La♭ majör → Mi♭ majör dizisini ekleyebilirim.`;
      } else {
        const pitches = [...new Set(project.notes.map((note) => note.pitch % 12))].sort((a, b) => a - b);
        response = pitches.length > 0
          ? `Notalar farklı zamanlarda çalıyor; belirgin bir eşzamanlı akor bulamadım. Nota sınıfları: ${pitches.map((pitch) => pitchNames[pitch]).join(', ')}. “Akor öner” dersen alternatif bir dizi ekleyebilirim.`
          : 'Piyano rulosu henüz boş. Nota ekleyip analiz edebilir veya “akor öner” komutuyla bir dizi ekleyebilirsin.';
      }
    } else if (command.includes('melodi') || command.includes('piyano')) {
      const minorMelody = [
        [0, 60], [2, 63], [4, 67], [6, 65], [8, 63], [10, 62], [12, 60], [14, 58],
      ];
      const majorMelody = [
        [0, 60], [2, 64], [4, 67], [6, 69], [8, 67], [10, 64], [12, 62], [14, 60],
      ];
      const melody = command.includes('hüzün') || command.includes('minör') || command.includes('minor')
        ? minorMelody
        : majorMelody;
      onProjectChange({
        ...project,
        notes: melody.map(([step, pitch]) => makeNote(step, pitch, 2)),
      });
      response = command.includes('hüzün') || command.includes('minör') || command.includes('minor')
        ? 'Piyano rulosuna Do minör dizisinde hüzünlü bir melodi yazdım. Çal düğmesiyle dinleyebilirsin.'
        : 'Piyano rulosuna sekiz notalı bir melodi yazdım. İstersen daha hüzünlü bir varyasyon için minör bir melodi iste.';
    } else {
      response = 'Şimdilik “hüzünlü bir piyano melodisi yaz”, “davul ritmi ekle”, “bas çok yüksek, kıs” veya “akor öner” komutlarını deneyebilirsin.';
    }

    setMessages((current) => [...current, { role: 'user', text }, { role: 'tre', text: response }]);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const currentPrompt = prompt.trim();
    if (!currentPrompt) return;
    setPrompt('');
    respond(currentPrompt);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open && (
        <section className="mb-3 flex h-[min(30rem,75dvh)] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-slate-100 shadow-2xl shadow-black/50">
          <header className="flex items-center gap-3 border-b border-white/10 p-4">
            <div className="rounded-xl bg-cyan-300/10 p-2 text-cyan-200"><Bot className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Tre <span className="text-xs font-normal text-emerald-300">· Yerel asistan</span></h2>
              <p className="text-xs text-slate-400">Proje verini doğrudan düzenler</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Tre sohbetini kapat" onClick={() => setOpen(false)} className="text-slate-400 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${message.role === 'user' ? 'ml-auto bg-cyan-300 text-slate-950' : 'bg-white/5 text-slate-200'}`}>
                {message.text}
              </div>
            ))}
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
            <Input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Tre'ye bir komut ver..."
              aria-label="Tre için komut"
              className="border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
            />
            <Button type="submit" size="icon" aria-label="Komutu gönder" disabled={!prompt.trim()} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>
      )}
      <Button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="ml-auto flex rounded-full bg-cyan-300 px-5 text-slate-950 shadow-lg shadow-cyan-950/40 hover:bg-cyan-200"
      >
        {open ? <X className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
        Tre
      </Button>
    </div>
  );
};

export default TreAssistant;
