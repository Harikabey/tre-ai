import { useCallback, useEffect, useRef } from 'react';

export type InstrumentType = 'kick' | 'snare' | 'hat' | 'piano' | 'synth' | 'bass';

export interface StudioChannel {
  id: string;
  name: string;
  type: InstrumentType;
  volume: number;
  pan: number;
  muted: boolean;
  steps: boolean[];
}

export interface PianoNote {
  id: string;
  step: number;
  pitch: number;
  duration: number;
}

export interface StudioProject {
  bpm: number;
  channels: StudioChannel[];
  notes: PianoNote[];
  arrangement: boolean[];
  reverb: number;
  eq: number;
}

const STORAGE_KEY = 'trejen-project-v1';

export const DEFAULT_PROJECT: StudioProject = {
  bpm: 112,
  reverb: 18,
  eq: 50,
  channels: [
    { id: 'kick', name: 'Kick', type: 'kick', volume: 82, pan: 0, muted: false, steps: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false] },
    { id: 'snare', name: 'Snare', type: 'snare', volume: 72, pan: 0, muted: false, steps: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false] },
    { id: 'hat', name: 'Hi-hat', type: 'hat', volume: 48, pan: 12, muted: false, steps: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false] },
    { id: 'piano', name: 'Piano', type: 'piano', volume: 68, pan: -8, muted: false, steps: Array(16).fill(false) },
    { id: 'synth', name: 'Synth', type: 'synth', volume: 58, pan: 8, muted: false, steps: Array(16).fill(false) },
    { id: 'bass', name: 'Bass', type: 'bass', volume: 70, pan: 0, muted: false, steps: Array(16).fill(false) },
  ],
  notes: [],
  arrangement: [true, true, true, true],
};

const isStudioProject = (value: unknown): value is StudioProject => {
  if (!value || typeof value !== 'object') return false;
  const project = value as Partial<StudioProject>;
  return Number.isFinite(project.bpm)
    && project.bpm >= 50 && project.bpm <= 200
    && Number.isFinite(project.reverb) && project.reverb >= 0 && project.reverb <= 100
    && Number.isFinite(project.eq) && project.eq >= 0 && project.eq <= 100
    && Array.isArray(project.channels)
    && Array.isArray(project.notes)
    && Array.isArray(project.arrangement)
    && project.arrangement.length === 4
    && project.arrangement.every((bar) => typeof bar === 'boolean')
    && project.channels.every((channel) => (
      typeof channel.id === 'string'
      && typeof channel.name === 'string'
      && ['kick', 'snare', 'hat', 'piano', 'synth', 'bass'].includes(channel.type)
      && Number.isFinite(channel.volume) && channel.volume >= 0 && channel.volume <= 100
      && Number.isFinite(channel.pan) && channel.pan >= -100 && channel.pan <= 100
      && typeof channel.muted === 'boolean'
      && Array.isArray(channel.steps)
      && channel.steps.length === 16
      && channel.steps.every((step) => typeof step === 'boolean')
    ))
    && project.notes.every((note) => (
      typeof note.id === 'string'
      && Number.isInteger(note.step) && note.step >= 0 && note.step < 16
      && Number.isInteger(note.pitch) && note.pitch >= 36 && note.pitch <= 84
      && Number.isInteger(note.duration) && note.duration >= 1 && note.duration <= 16
    ));
};

export const loadStudioProject = (): StudioProject => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_PROJECT;
    const parsed: unknown = JSON.parse(saved);
    if (!isStudioProject(parsed)) throw new Error('Kayıtlı Trejen projesinin biçimi geçersiz.');
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Kayıtlı Trejen projesi okunamadı.');
    throw error;
  }
};

export const saveStudioProject = (project: StudioProject) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
};

interface AudioGraph {
  input: GainNode;
  eq: BiquadFilterNode;
  wet: GainNode;
  dry: GainNode;
}

const createAudioGraph = (context: BaseAudioContext, reverb: number, eq: number): AudioGraph => {
  const input = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = 'highshelf';
  filter.frequency.value = 3200;
  filter.gain.value = (eq - 50) / 5;
  const dry = context.createGain();
  const convolver = context.createConvolver();
  const impulseLength = Math.floor(context.sampleRate * 1.4);
  const impulse = context.createBuffer(2, impulseLength, context.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const samples = impulse.getChannelData(channel);
    for (let index = 0; index < impulseLength; index += 1) {
      samples[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / impulseLength, 3);
    }
  }
  convolver.buffer = impulse;
  const wet = context.createGain();
  input.connect(filter);
  filter.connect(dry);
  dry.connect(context.destination);
  filter.connect(convolver);
  convolver.connect(wet);
  wet.connect(context.destination);
  const wetLevel = reverb / 100;
  wet.gain.value = wetLevel;
  dry.gain.value = 1 - wetLevel * 0.45;
  return { input, eq: filter, wet, dry };
};

const midiFrequency = (pitch: number) => 440 * Math.pow(2, (pitch - 69) / 12);

const synthesize = (
  context: BaseAudioContext,
  graph: AudioGraph,
  channel: StudioChannel,
  pitch: number,
  duration: number,
  when = context.currentTime,
) => {
  if (channel.muted || channel.volume <= 0) return;
  const gain = context.createGain();
  const panner = context.createStereoPanner();
  gain.gain.value = channel.volume / 100;
  panner.pan.value = channel.pan / 100;
  gain.connect(panner);
  panner.connect(graph.input);

  const voiceDuration = channel.type === 'hat' ? Math.min(duration, 0.07) : Math.max(0.06, duration);
  const oscillator = (frequency: number, type: OscillatorType, level: number, endFrequency?: number) => {
    const source = context.createOscillator();
    const envelope = context.createGain();
    source.type = type;
    source.frequency.setValueAtTime(frequency, when);
    if (endFrequency) source.frequency.exponentialRampToValueAtTime(endFrequency, when + Math.min(voiceDuration, 0.16));
    envelope.gain.setValueAtTime(level, when);
    envelope.gain.exponentialRampToValueAtTime(0.001, when + voiceDuration);
    source.connect(envelope);
    envelope.connect(gain);
    source.start(when);
    source.stop(when + voiceDuration + 0.02);
  };
  const noise = (highpass: number, level: number) => {
    const length = Math.ceil(context.sampleRate * voiceDuration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    envelope.gain.setValueAtTime(level, when);
    envelope.gain.exponentialRampToValueAtTime(0.001, when + voiceDuration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(gain);
    source.start(when);
  };

  switch (channel.type) {
    case 'kick':
      oscillator(145, 'sine', 0.95, 42);
      break;
    case 'snare':
      noise(900, 0.52);
      oscillator(185, 'triangle', 0.25, 100);
      break;
    case 'hat':
      noise(7000, 0.32);
      break;
    case 'bass':
      oscillator(midiFrequency(pitch) / 2, 'sawtooth', 0.55);
      break;
    case 'piano':
      oscillator(midiFrequency(pitch), 'triangle', 0.45);
      oscillator(midiFrequency(pitch) * 2, 'sine', 0.12);
      break;
    case 'synth':
      oscillator(midiFrequency(pitch), 'sawtooth', 0.32);
      oscillator(midiFrequency(pitch) * 1.005, 'square', 0.12);
      break;
    default: {
      const exhaustive: never = channel.type;
      throw new Error(`Desteklenmeyen enstrüman: ${exhaustive}`);
    }
  }
};

const renderProject = async (project: StudioProject): Promise<AudioBuffer> => {
  const bars = project.arrangement.length;
  const stepDuration = 60 / project.bpm / 4;
  const duration = bars * 16 * stepDuration + 2;
  const context = new OfflineAudioContext(2, Math.ceil(duration * 44100), 44100);
  const graph = createAudioGraph(context, project.reverb, project.eq);
  project.channels.forEach((channel) => {
    for (let bar = 0; bar < bars; bar += 1) {
      if (!project.arrangement[bar]) continue;
      channel.steps.forEach((active, step) => {
        if (active) synthesize(context, graph, channel, 60, 0.22, (bar * 16 + step) * stepDuration);
      });
    }
  });
  project.notes.forEach((note) => {
    const piano = project.channels.find((channel) => channel.type === 'piano');
    if (!piano) return;
    for (let bar = 0; bar < bars; bar += 1) {
      if (!project.arrangement[bar]) continue;
      synthesize(context, graph, piano, note.pitch, note.duration * stepDuration, (bar * 16 + note.step) * stepDuration);
    }
  });
  return context.startRendering();
};

const encodeWav = (buffer: AudioBuffer): Blob => {
  const channelCount = buffer.numberOfChannels;
  const frameCount = buffer.length;
  const bytes = new ArrayBuffer(44 + frameCount * channelCount * 2);
  const view = new DataView(bytes);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, bytes.byteLength - 8, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, frameCount * channelCount * 2, true);
  const channels = Array.from({ length: channelCount }, (_, index) => buffer.getChannelData(index));
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([bytes], { type: 'audio/wav' });
};

export const exportProjectWav = async (project: StudioProject) => encodeWav(await renderProject(project));

export const useAudioEngine = () => {
  const contextRef = useRef<AudioContext | null>(null);
  const graphRef = useRef<AudioGraph | null>(null);

  const getGraph = useCallback((project: StudioProject) => {
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) throw new Error('Bu tarayıcı Web Audio API’yi desteklemiyor.');
    if (!contextRef.current || contextRef.current.state === 'closed') {
      contextRef.current = new AudioContextConstructor({ latencyHint: 'interactive' });
      graphRef.current = createAudioGraph(contextRef.current, project.reverb, project.eq);
    }
    if (!graphRef.current) throw new Error('Ses motoru başlatılamadı.');
    graphRef.current.eq.gain.setTargetAtTime((project.eq - 50) / 5, contextRef.current.currentTime, 0.03);
    const wetLevel = project.reverb / 100;
    graphRef.current.wet.gain.setTargetAtTime(wetLevel, contextRef.current.currentTime, 0.03);
    graphRef.current.dry.gain.setTargetAtTime(1 - wetLevel * 0.45, contextRef.current.currentTime, 0.03);
    return { context: contextRef.current, graph: graphRef.current };
  }, []);

  const playSound = useCallback((project: StudioProject, channel: StudioChannel, pitch = 60, duration = 0.22, when?: number) => {
    const { context, graph } = getGraph(project);
    if (context.state === 'suspended') void context.resume();
    synthesize(context, graph, channel, pitch, duration, when ?? context.currentTime);
  }, [getGraph]);

  useEffect(() => () => {
    if (contextRef.current && contextRef.current.state !== 'closed') void contextRef.current.close();
  }, []);

  return { playSound };
};
