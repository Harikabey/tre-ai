import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowLeft, BarChart3, Bot, FileSpreadsheet, Lightbulb, Mic, MicOff, Rotate3D,
  Send, Sparkles, Upload, Waypoints,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, PolarAngleAxis,
  PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { mountThreeNetwork, useChartEngine } from '@/hooks/useChartEngine';
import {
  useDataAnalyzer,
  type TreFikEdge,
  type TreFikInputMode,
  type TreFikNode,
} from '@/hooks/useDataAnalyzer';

const INPUT_TABS: { id: TreFikInputMode; label: string; icon: typeof Activity }[] = [
  { id: 'math', label: 'Matematik', icon: Activity },
  { id: 'table', label: 'Tablo (CSV/Excel)', icon: FileSpreadsheet },
  { id: 'health', label: 'Sağlık/Spor', icon: BarChart3 },
  { id: 'relations', label: 'İlişkiler', icon: Waypoints },
  { id: 'text', label: 'Serbest Metin', icon: Sparkles },
];

const DEFAULT_HEALTH = 'Tarih,Adım,Su (L),Uyku (saat)\nPzt,8200,2.1,7\nSal,10400,2.5,8\nÇar,7600,1.8,6.5\nPer,11200,2.7,7.5\nCum,9800,2.3,8';
const DEFAULT_RELATIONS = "Ahmet, Mehmet'le çalışıyor\nMehmet -> Zeynep: arkadaş\nZeynep -> Ahmet: aynı ekip";
const DEFAULT_TEXT = 'Fotosentez, bitkilerin güneş ışığı enerjisini kullanarak su ve karbondioksitten besin üretme sürecidir. Klorofil ışığı yakalar; oksijen açığa çıkar.';
const CHART_COLORS = ['#67e8f9', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa'];

const NetworkDiagram = ({
  nodes,
  edges,
  selectedNode,
  onSelect,
}: {
  nodes: TreFikNode[];
  edges: TreFikEdge[];
  selectedNode: string | null;
  onSelect: (node: TreFikNode) => void;
}) => {
  const positions = useMemo(() => {
    const center = { x: 250, y: 145 };
    return new Map(nodes.map((node, index) => {
      const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return [node.label, { x: center.x + Math.cos(angle) * 145, y: center.y + Math.sin(angle) * 90 }];
    }));
  }, [nodes]);

  return (
    <svg viewBox="0 0 500 290" role="img" aria-label="Kişiler arası etkileşimli ilişki ağı" className="h-full min-h-64 w-full">
      {edges.map((edge, index) => {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);
        if (!source || !target) return null;
        const labelX = (source.x + target.x) / 2;
        const labelY = (source.y + target.y) / 2;
        return (
          <g key={`${edge.source}-${edge.target}-${index}`}>
            <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="#475569" strokeWidth="2" />
            {edge.label && <text x={labelX} y={labelY - 5} textAnchor="middle" className="fill-slate-400 text-[10px]">{edge.label}</text>}
          </g>
        );
      })}
      {nodes.map((node) => {
        const point = positions.get(node.label);
        if (!point) return null;
        const selected = selectedNode === node.label;
        return (
          <g
            key={node.id}
            role="button"
            tabIndex={0}
            aria-label={`${node.label} düğümünü seç`}
            onClick={() => onSelect(node)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onSelect(node);
            }}
            className="cursor-pointer outline-none"
          >
            <circle cx={point.x} cy={point.y} r="25" fill={selected ? '#a78bfa' : '#164e63'} stroke="#67e8f9" strokeWidth="2" />
            <text x={point.x} y={point.y + 4} textAnchor="middle" className="fill-white text-xs font-medium">{node.label.slice(0, 12)}</text>
          </g>
        );
      })}
    </svg>
  );
};

const MindMapDiagram = ({
  nodes,
  selectedNode,
  onSelect,
}: {
  nodes: TreFikNode[];
  selectedNode: string | null;
  onSelect: (node: TreFikNode) => void;
}) => {
  const center = nodes[0];
  if (!center) return <p className="p-8 text-center text-sm text-slate-400">Kavram şeması oluşturmak için metin girin.</p>;
  const branches = nodes.slice(1);
  return (
    <svg viewBox="0 0 680 360" role="img" aria-label="Etkileşimli kavram zihin haritası" className="h-full min-h-72 w-full">
      {branches.map((node, index) => {
        const y = 55 + index * (250 / Math.max(branches.length - 1, 1));
        return <path key={`path-${node.id}`} d={`M 340 180 C 435 180, 425 ${y}, 510 ${y}`} fill="none" stroke="#475569" strokeWidth="2" />;
      })}
      <g
        role="button"
        tabIndex={0}
        aria-label={`${center.label} ana kavramını seç`}
        onClick={() => onSelect(center)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onSelect(center);
        }}
        className="cursor-pointer"
      >
        <rect x="260" y="146" width="160" height="68" rx="22" fill={selectedNode === center.label ? '#7c3aed' : '#164e63'} stroke="#67e8f9" strokeWidth="2" />
        <text x="340" y="186" textAnchor="middle" className="fill-white text-base font-semibold">{center.label.slice(0, 22)}</text>
      </g>
      {branches.map((node, index) => {
        const y = 35 + index * (250 / Math.max(branches.length - 1, 1));
        return (
          <g
            key={node.id}
            role="button"
            tabIndex={0}
            aria-label={`${node.label} kavramını seç`}
            onClick={() => onSelect(node)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onSelect(node);
            }}
            className="cursor-pointer"
          >
            <rect x="500" y={y} width="150" height="40" rx="15" fill={selectedNode === node.label ? '#7c3aed' : '#1e293b'} stroke="#64748b" />
            <text x="575" y={y + 25} textAnchor="middle" className="fill-slate-100 text-xs">{node.label.slice(0, 20)}</text>
          </g>
        );
      })}
    </svg>
  );
};

const ThreeNetwork = ({
  nodes,
  edges,
  onSelect,
}: {
  nodes: TreFikNode[];
  edges: TreFikEdge[];
  onSelect: (node: TreFikNode) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let active = true;
    let unmount: (() => void) | undefined;
    void mountThreeNetwork(container, nodes, edges, (node) => onSelectRef.current(node))
      .then((cleanup) => {
        if (active) unmount = cleanup;
        else cleanup();
      })
      .catch((mountError: unknown) => {
        if (!active) return;
        const message = mountError instanceof Error ? mountError.message : '3D ağ oluşturulamadı.';
        setError(message);
      });
    return () => {
      active = false;
      unmount?.();
    };
  }, [edges, nodes]);

  return (
    <div className="relative min-h-72 rounded-xl border border-white/10 bg-[#0b1220]">
      <div ref={containerRef} className="absolute inset-0 overflow-hidden rounded-xl [&_canvas]:h-full [&_canvas]:w-full" />
      {error && <p role="alert" className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-rose-300">{error}</p>}
      {!error && <p className="pointer-events-none absolute bottom-2 left-3 text-xs text-slate-500">Düğüme tıklayın · sürükleyin ve ağı döndürün</p>}
    </div>
  );
};

const TreFikPage = () => {
  const [mode, setMode] = useState<TreFikInputMode>('math');
  const [inputs, setInputs] = useState<Record<TreFikInputMode, string>>({
    math: 'y = x^2 + 3x - 5',
    table: 'Ay,Satış\nOcak,120\nŞubat,145\nMart,138\nNisan,172\nMayıs,190',
    health: DEFAULT_HEALTH,
    relations: DEFAULT_RELATIONS,
    text: DEFAULT_TEXT,
  });
  const [projectionPercent, setProjectionPercent] = useState(0);
  const [chartColor, setChartColor] = useState('#67e8f9');
  const [rotated, setRotated] = useState(false);
  const [threeDimensional, setThreeDimensional] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatReply, setChatReply] = useState('Merhaba! Veriniz için otomatik grafik seçtim. İstersen içgörüleri sor veya “ne olursa” simülasyonunu ayarla.');
  const [fileName, setFileName] = useState('');
  const analysis = useDataAnalyzer(mode, inputs[mode]);
  const { projectedRows, radarRows, projectionKey } = useChartEngine(analysis, projectionPercent);
  const { isListening, transcript, isSupported, startListening, stopListening } = useSpeechRecognition();
  const appliedVoiceCommand = useRef('');

  useEffect(() => {
    if (isListening || !transcript.trim() || appliedVoiceCommand.current === transcript) return;
    const command = transcript.toLocaleLowerCase('tr-TR');
    appliedVoiceCommand.current = transcript;
    let response = 'Komutu anlayamadım. “Grafiği döndür”, “sütunu kırmızı yap” veya “yüzde 20 artış göster” diyebilirsiniz.';
    if (command.includes('döndür') || command.includes('çevir')) {
      setRotated((current) => !current);
      response = 'Grafik görünümünü döndürdüm.';
    } else if (command.includes('kırmızı') || command.includes('kirmizi')) {
      setChartColor('#fb7185');
      response = 'Grafik rengini kırmızıya çevirdim.';
    } else if (command.includes('mavi')) {
      setChartColor('#60a5fa');
      response = 'Grafik rengini maviye çevirdim.';
    } else if (command.includes('yeşil') || command.includes('yesil')) {
      setChartColor('#34d399');
      response = 'Grafik rengini yeşile çevirdim.';
    } else if (command.includes('artış') || command.includes('artis') || command.includes('azalış') || command.includes('azalis')) {
      const amount = Number(command.match(/\d+/)?.[0] ?? 20);
      setProjectionPercent(Math.min(200, Math.max(-100, command.includes('azalış') || command.includes('azalis') ? -amount : amount)));
      response = 'What-if simülasyonu için projeksiyon parametresini güncelledim.';
    }
    setChatReply(response);
    toast.info(response);
  }, [isListening, transcript]);

  const setCurrentInput = (value: string) => setInputs((current) => ({ ...current, [mode]: value }));
  const selectNode = useCallback((node: TreFikNode) => {
    setSelectedNode(node.label);
    setChatReply(`“${node.label}” düğümünü seçtiniz.`);
  }, []);

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      let text: string;
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const XLSX = await import('@e965/xlsx');
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) throw new Error('Excel dosyasında okunabilir bir çalışma sayfası bulunamadı.');
        text = XLSX.utils.sheet_to_csv(firstSheet);
      } else {
        text = await file.text();
      }
      if (!text.trim()) throw new Error('Dosya boş.');
      setMode('table');
      setInputs((current) => ({ ...current, table: text }));
      setFileName(file.name);
      toast.success(`${file.name} tarayıcıda açıldı.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dosya okunamadı.';
      toast.error(message);
    }
  };

  const sendChatMessage = () => {
    const question = chatPrompt.trim().toLocaleLowerCase('tr-TR');
    if (!question) return;
    let reply: string;
    if (/içgörü|yorum|sonuç|ne anlat|analiz/.test(question)) {
      reply = analysis.insights.join(' ') || 'Henüz analiz edilecek veri yok.';
    } else if (/grafik|şema|görsel/.test(question)) {
      reply = `Bu girdi için ${analysis.visualization} görünümünü seçtim. Veriler bu tarayıcıda işleniyor.`;
    } else if (/ne olursa|what.if|simülasyon|simulasyon/.test(question)) {
      reply = 'Aşağıdaki What-if kaydırıcısını değiştirerek sonraki dönem projeksiyonunu yeniden hesaplayabilirsiniz.';
    } else if (/temiz|eksik/.test(question)) {
      reply = analysis.cleaningNotes.join(' ') || 'Eksik veya hatalı sayısal hücre bulunmadı.';
    } else {
      reply = 'Grafik türünü otomatik belirledim. İçgörü, veri temizleme ya da What-if simülasyonu hakkında sorabilirsiniz.';
    }
    setChatReply(reply);
    setChatPrompt('');
  };

  const chartStyle = { transform: rotated ? 'perspective(900px) rotateY(12deg)' : 'none', transition: 'transform 300ms ease' };
  const chartTitle = {
    line: 'Trend grafiği',
    bar: 'Sütun grafiği',
    pie: 'Pasta grafiği',
    radar: 'Sağlık radar grafiği',
    network: 'İlişki ağı',
    mindmap: 'Kavram zihin haritası',
  }[analysis.visualization];
  const hasData = analysis.rows.length > 0 || analysis.nodes.length > 0;

  return (
    <main className="dark min-h-[100dvh] bg-[#090d16] px-3 py-4 text-slate-100 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center gap-3">
          <Link to="/store" aria-label="Mağazaya dön" className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">Tre-fik <span className="text-emerald-300">🚦</span></h1>
            <p className="text-sm text-slate-400">Verileriniz tarayıcınızda kalır · akıllı görselleştirme ve şema motoru</p>
          </div>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">Yerel analiz</span>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.5fr)]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101622] shadow-xl shadow-black/20">
            <div className="border-b border-white/[0.07] p-4">
              <h2 className="font-semibold">Veri giriş noktası</h2>
              <p className="mt-1 text-xs text-slate-500">Girdi türünü seçin; uygun görsel anında oluşturulur.</p>
            </div>
            <div className="p-4">
              <Tabs value={mode} onValueChange={(value) => setMode(value as TreFikInputMode)}>
                <TabsList aria-label="Girdi türü" className="mb-4 grid h-auto grid-cols-2 gap-1 bg-black/20 p-1 sm:grid-cols-3">
                  {INPUT_TABS.map(({ id, label, icon: Icon }) => (
                    <TabsTrigger key={id} value={id} className="h-auto min-h-9 gap-1 px-2 py-2 text-xs data-[state=active]:bg-emerald-300 data-[state=active]:text-slate-950">
                      <Icon className="h-3.5 w-3.5 shrink-0" />{label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <label htmlFor="tre-fik-input" className="mb-2 block text-sm font-medium">
                {mode === 'math' ? 'Denklem (x değişkeni desteklenir)' : INPUT_TABS.find((tab) => tab.id === mode)?.label}
              </label>
              <Textarea
                id="tre-fik-input"
                value={inputs[mode]}
                onChange={(event) => setCurrentInput(event.currentTarget.value)}
                maxLength={mode === 'math' ? 240 : 20_000}
                spellCheck={mode !== 'math'}
                placeholder={mode === 'math' ? 'y = x^2 + 3x - 5' : 'Verinizi buraya girin…'}
                className="min-h-36 resize-y border-white/10 bg-[#0b111c] font-mono text-sm text-slate-200 placeholder:text-slate-600 focus-visible:ring-emerald-300/50"
              />
              {mode === 'table' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.08]">
                    <Upload className="h-4 w-4" /> CSV / Excel yükle
                    <input type="file" accept=".csv,.tsv,.xlsx,.xls" className="sr-only" onChange={(event) => void importFile(event.currentTarget.files?.[0])} />
                  </label>
                  {fileName && <span className="max-w-48 truncate text-xs text-slate-500">{fileName}</span>}
                </div>
              )}
              {analysis.error && (
                <p role="alert" className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{analysis.error}</p>
              )}
              {analysis.cleaningNotes.map((note) => (
                <p key={note} className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />{note}
                </p>
              ))}
              <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/15 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">Sesli komut</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!isSupported) {
                        toast.error('Bu tarayıcı sesli komutları desteklemiyor.');
                        return;
                      }
                      if (isListening) stopListening();
                      else startListening();
                    }}
                    className="h-8 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  >
                    {isListening ? <MicOff className="mr-2 h-4 w-4 text-rose-300" /> : <Mic className="mr-2 h-4 w-4" />}
                    {isListening ? 'Dinlemeyi durdur' : 'Komut ver'}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">“Grafiği döndür”, “sütunu kırmızı yap”, “yüzde 20 artış göster”</p>
                {transcript && <p className="mt-2 text-xs text-emerald-200">Algılanan: {transcript}</p>}
              </div>
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101622] shadow-xl shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] p-4">
              <div>
                <h2 className="flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4 text-emerald-300" />{chartTitle}</h2>
                <p className="mt-1 text-xs text-slate-500">{analysis.topic || 'Girdiğinizi analiz edin'}</p>
              </div>
              <div className="flex items-center gap-2">
                {analysis.visualization === 'network' && (
                  <Button size="sm" variant="outline" onClick={() => setThreeDimensional((current) => !current)} className="h-8 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                    <Rotate3D className="mr-1 h-4 w-4" />{threeDimensional ? '2D görünüm' : '3D görünüm'}
                  </Button>
                )}
                {analysis.visualization !== 'network' && analysis.visualization !== 'mindmap' && (
                  <label className="flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-slate-400">
                    Renk
                    <input aria-label="Grafik rengi" type="color" value={chartColor} onChange={(event) => setChartColor(event.currentTarget.value)} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" />
                  </label>
                )}
              </div>
            </div>
            <div className="p-4">
              {!hasData || analysis.error ? (
                <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-white/10 text-center">
                  <div className="max-w-sm p-5">
                    <Activity className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                    <p className="text-sm text-slate-400">{analysis.error ? 'Girdiyi düzeltip yeniden deneyin.' : 'Görselleştirmek için sol taraftan veri girin.'}</p>
                  </div>
                </div>
              ) : (
                <div style={chartStyle} className="min-h-72 transition-transform">
                  {analysis.visualization === 'network' && (threeDimensional
                    ? <ThreeNetwork nodes={analysis.nodes} edges={analysis.edges} onSelect={selectNode} />
                    : <NetworkDiagram nodes={analysis.nodes} edges={analysis.edges} selectedNode={selectedNode} onSelect={selectNode} />)}
                  {analysis.visualization === 'mindmap' && (
                    <div className="min-h-72 rounded-xl border border-white/[0.07] bg-[#0b1220]">
                      <MindMapDiagram nodes={analysis.nodes} selectedNode={selectedNode} onSelect={selectNode} />
                    </div>
                  )}
                  {analysis.visualization === 'line' && (
                    <div className="h-72 min-w-0" aria-label="Matematik veya trend çizgi grafiği">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={projectedRows} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                          <XAxis dataKey={analysis.categoryKey} tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={24} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10 }} />
                          <Legend />
                          {analysis.seriesKeys.map((key, index) => <Line key={key} type="monotone" dataKey={key} stroke={index === 0 ? chartColor : CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />)}
                          <Line type="monotone" dataKey={projectionKey} name="Öngörü" stroke="#fbbf24" strokeDasharray="5 5" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {analysis.visualization === 'bar' && (
                    <div className="h-72 min-w-0" aria-label="Veri sütun grafiği">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={projectedRows} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                          <XAxis dataKey={analysis.categoryKey} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10 }} />
                          <Legend />
                          {analysis.seriesKeys.map((key, index) => <Bar key={key} dataKey={key} fill={index === 0 ? chartColor : CHART_COLORS[index % CHART_COLORS.length]} radius={[5, 5, 0, 0]} />)}
                          <Bar dataKey={projectionKey} name="Öngörü" fill="#fbbf24" radius={[5, 5, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {analysis.visualization === 'pie' && (
                    <div className="h-72 min-w-0" aria-label="Kategori payları pasta grafiği">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={analysis.rows} dataKey={analysis.seriesKeys[0]} nameKey={analysis.categoryKey} cx="50%" cy="48%" outerRadius={100} label>
                            {analysis.rows.map((row, index) => <Cell key={String(row[analysis.categoryKey])} fill={index === 0 ? chartColor : CHART_COLORS[index % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10 }} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {analysis.visualization === 'radar' && (
                    <div className="h-72 min-w-0" aria-label="Sağlık ve spor ölçümleri radar grafiği">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarRows} outerRadius="72%">
                          <PolarGrid stroke="#334155" />
                          <PolarAngleAxis dataKey={analysis.categoryKey} tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} />
                          {analysis.seriesKeys.map((key, index) => <Radar key={key} name={key} dataKey={key} stroke={index === 0 ? chartColor : CHART_COLORS[index % CHART_COLORS.length]} fill={index === 0 ? chartColor : CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.12} />)}
                          <Legend />
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {analysis.visualization === 'radar' && <p className="mt-2 text-xs text-slate-500">Ölçümler adım: 10.000, su: 2,5 L ve uyku: 8 saat hedeflerine göre 0–100 aralığında normalize edilir.</p>}

              {analysis.insights.length > 0 && (
                <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] p-3">
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-200"><Lightbulb className="h-4 w-4" />Otomatik içgörü</h3>
                  <ul className="space-y-1 text-xs text-slate-300">{analysis.insights.map((insight) => <li key={insight}>· {insight}</li>)}</ul>
                </div>
              )}

              {analysis.rows.length >= 2 && analysis.seriesKeys.length > 0 && analysis.visualization !== 'pie' && (
                <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/15 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="tre-fik-projection" className="flex items-center gap-2 text-xs font-medium text-slate-300"><Rotate3D className="h-4 w-4 text-amber-300" />What-if · eğim değişimi</label>
                    <output htmlFor="tre-fik-projection" className="font-mono text-xs text-amber-200">{projectionPercent > 0 ? '+' : ''}{projectionPercent}%</output>
                  </div>
                  <input id="tre-fik-projection" aria-label="Projeksiyon eğim değişimi" type="range" min="-100" max="200" step="5" value={projectionPercent} onChange={(event) => setProjectionPercent(Number(event.currentTarget.value))} className="w-full accent-amber-300" />
                  <p className="mt-1 text-[11px] text-slate-500">Son iki dönemin eğimini değiştirerek bir sonraki dönem tahmini güncellenir.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-2xl border border-white/[0.08] bg-[#101622] p-4 shadow-xl shadow-black/20">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Bot className="h-4 w-4 text-violet-300" />Tre ile sohbet</h2>
          <p aria-live="polite" className="mb-3 rounded-xl bg-black/20 p-3 text-sm text-slate-300">{chatReply}</p>
          <form onSubmit={(event) => { event.preventDefault(); sendChatMessage(); }} className="flex gap-2">
            <Input value={chatPrompt} onChange={(event) => setChatPrompt(event.currentTarget.value)} aria-label="Tre'ye soru sor" placeholder="İçgörüleri açıkla veya verinin nasıl temizlendiğini sor…" className="border-white/10 bg-[#0b111c] text-slate-200 placeholder:text-slate-600" />
            <Button type="submit" aria-label="Mesajı gönder" className="shrink-0 bg-emerald-300 text-slate-950 hover:bg-emerald-200"><Send className="h-4 w-4" /></Button>
          </form>
        </section>

        <footer className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-slate-600">
          <Lightbulb className="h-3.5 w-3.5" />Tre-fik analizini bu cihazda yapar; girdiler sunucuya gönderilmez.
        </footer>
      </div>
    </main>
  );
};

export default TreFikPage;
