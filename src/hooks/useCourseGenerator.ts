import { useCallback, useState } from 'react';
import DOMPurify from 'dompurify';
import { readModelSelection } from '@/hooks/useModelSelection';
import { requestChatCompletion } from '@/lib/chatRequest';

export interface CourseQuiz {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface CourseActivity {
  type: 'fill_blank' | 'drag_drop';
  instruction: string;
  prompt: string;
  items: string[];
  correctAnswer: string;
}

export interface CourseModule {
  title: string;
  content: string;
  quiz: CourseQuiz;
  activity: CourseActivity;
}

export interface GeneratedCourse {
  topic: string;
  modules: CourseModule[];
}

const API_CONNECTION_ERROR = "API bağlantısı kurulamadı. Lütfen Ayarlar'dan API anahtarınızı kontrol edin.";
const RATE_LIMIT_ERROR = 'İstek limiti aşıldı, lütfen biraz bekleyin.';
const COURSE_SYSTEM_PROMPT = `Sen bir eğitim içeriği üreticisisin. Kullanıcının verdiği konu için 3 modüllük bir kurs planı oluştur. Her modül için: başlık, kısa teori, 1 quiz sorusu ve 1 interaktif etkinlik (sürükle-bırak veya boşluk doldurma) hazırla. Yanıtını KESİNLİKLE ve SADECE geçerli bir JSON formatında ver. JSON dışında hiçbir metin, açıklama veya markdown işareti yazma. Yanıtın ilk karakteri '{' son karakteri '}' olmalıdır. Eğer JSON formatında yanıt veremiyorsan, boş bir JSON nesnesi döndür: {}. Beklenen biçim: { "modules": [ { "title": "...", "content": "...", "quiz": {...}, "activity": {...} } ] }`;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseJsonResponse(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('API geçerli JSON biçiminde kurs planı döndürmedi.');
  return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
}

function parseCompletionLine(line: string): string {
  if (!line.startsWith('data:')) return '';
  const data = line.slice(5).trim();
  if (!data || data === '[DONE]') return '';
  try {
    const parsed: unknown = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object' || !('choices' in parsed) || !Array.isArray(parsed.choices)) return '';
    const choice: unknown = parsed.choices[0];
    if (!choice || typeof choice !== 'object' || !('delta' in choice)) return '';
    const delta: unknown = choice.delta;
    if (!delta || typeof delta !== 'object' || !('content' in delta)) return '';
    return typeof delta.content === 'string' ? delta.content : '';
  } catch {
    return '';
  }
}

async function readCompletion(response: Response): Promise<string> {
  if (!response.body) throw new Error(API_CONNECTION_ERROR);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) content += parseCompletionLine(line);
  }
  buffer += decoder.decode();
  content += parseCompletionLine(buffer);
  if (!content.trim()) throw new Error('API boş kurs yanıtı verdi.');
  return content;
}

function isCoursePlan(value: unknown): value is { modules: CourseModule[] } {
  if (!value || typeof value !== 'object') return false;
  const modules = (value as { modules?: unknown }).modules;
  return Array.isArray(modules) && modules.length === 3 && modules.every((module) => {
    if (!module || typeof module !== 'object') return false;
    const candidate = module as Partial<CourseModule>;
    return typeof candidate.title === 'string'
      && typeof candidate.content === 'string'
      && !!candidate.quiz
      && typeof candidate.quiz.question === 'string'
      && Array.isArray(candidate.quiz.options)
      && typeof candidate.quiz.correctIndex === 'number'
      && !!candidate.activity
      && typeof candidate.activity.prompt === 'string'
      && Array.isArray(candidate.activity.items)
      && typeof candidate.activity.correctAnswer === 'string';
  });
}

function renderQuiz(quiz: CourseQuiz): string {
  const options = quiz.options.map((option, index) =>
    `<button type="button" data-correct="${index === quiz.correctIndex ? 'true' : 'false'}">${escapeHtml(option)}</button>`,
  ).join('');
  return `<h3>${escapeHtml(quiz.question)}</h3><div class="options">${options}</div><div class="status"></div>`;
}

function renderActivity(activity: CourseActivity): string {
  const prompt = escapeHtml(activity.prompt);
  const instruction = escapeHtml(activity.instruction);
  if (activity.type === 'fill_blank') {
    return `<h3>${instruction}</h3><p>${prompt}</p><div class="drag-list"><button type="button" data-activity-correct="true">${escapeHtml(activity.correctAnswer)}</button>${activity.items.filter((item) => item !== activity.correctAnswer).slice(0, 3).map((item) => `<button type="button" data-activity-correct="false">${escapeHtml(item)}</button>`).join('')}</div><div class="status"></div>`;
  }
  const items = [...activity.items, activity.correctAnswer]
    .filter((item, index, list) => list.indexOf(item) === index)
    .map((item) => `<button type="button" class="drag-item" draggable="true" data-activity-correct="${item === activity.correctAnswer ? 'true' : 'false'}">${escapeHtml(item)}</button>`)
    .join('');
  return `<h3>${instruction}</h3><p>${prompt}</p><div class="drag-list">${items}</div><span class="activity-word" aria-label="Etkinlik hedefi"></span><div class="status"></div>`;
}

export function useCourseGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateCourse = useCallback(async (topic: string): Promise<GeneratedCourse> => {
    const normalizedTopic = topic.trim();
    if (!normalizedTopic) throw new Error('Bir kurs konusu girin.');
    const configuredSelection = readModelSelection();
    if (!configuredSelection.apiKey.trim()) throw new Error(API_CONNECTION_ERROR);

    setIsGenerating(true);
    try {
      let response: Response;
      try {
        response = await requestChatCompletion({
          modelSelection: { ...configuredSelection, provider: 'byok' },
          headers: { 'Content-Type': 'application/json' },
          body: {
            systemPrompt: COURSE_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: `Konu: ${normalizedTopic}` }],
          },
        });
      } catch {
        throw new Error(API_CONNECTION_ERROR);
      }

      if (response.status === 429) throw new Error(RATE_LIMIT_ERROR);
      if (!response.ok) throw new Error(API_CONNECTION_ERROR);

      let completion: string;
      try {
        completion = await readCompletion(response);
      } catch (reason) {
        if (reason instanceof Error && reason.message === 'API boş kurs yanıtı verdi.') throw reason;
        throw new Error(API_CONNECTION_ERROR);
      }

      let parsed: unknown;
      try {
        parsed = parseJsonResponse(completion);
      } catch (reason) {
        console.error('Tre Akademi API JSON yanıtı ayrıştırılamadı. Ham yanıt:', completion, reason);
        throw new Error('Kurs oluşturulamadı. API yanıtı beklenen formatta değil.');
      }
      if (!isCoursePlan(parsed)) {
        console.error('Tre Akademi API JSON yanıtı beklenen kurs biçiminde değil. Ham yanıt:', completion);
        throw new Error('Kurs oluşturulamadı. API yanıtı beklenen formatta değil.');
      }
      return { topic: normalizedTopic, modules: parsed.modules };
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const renderCourseHtml = useCallback(async (course: GeneratedCourse, courseId: string): Promise<string> => {
    const templateResponse = await fetch('/templates/course-template.html');
    if (!templateResponse.ok) throw new Error('Kurs şablonu yüklenemedi.');
    let template = await templateResponse.text();
    template = template.replaceAll('{{KONU}}', escapeHtml(course.topic));
    template = template.replaceAll('{{KURS_ID}}', escapeHtml(courseId));

    course.modules.forEach((module, index) => {
      const number = index + 1;
      template = template
        .replaceAll(`{{MODUL_${number}_BASLIK}}`, escapeHtml(module.title))
        .replaceAll(`{{MODUL_${number}_ICERIK}}`, escapeHtml(module.content))
        .replaceAll(`{{MODUL_${number}_QUIZ}}`, renderQuiz(module.quiz))
        .replaceAll(`{{MODUL_${number}_ETKINLIK}}`, renderActivity(module.activity));
    });

    return DOMPurify.sanitize(template, {
      WHOLE_DOCUMENT: true,
      ADD_TAGS: ['script'],
      ADD_ATTR: ['draggable', 'data-correct', 'data-activity-correct', 'data-module'],
      FORBID_TAGS: ['iframe', 'object', 'embed', 'link', 'base'],
    });
  }, []);

  const createCourseHtml = useCallback(async (topic: string, courseId: string): Promise<GeneratedCourse & { html: string }> => {
    const course = await generateCourse(topic);
    const html = await renderCourseHtml(course, courseId);
    return { ...course, html };
  }, [generateCourse, renderCourseHtml]);

  return { isGenerating, generateCourse, renderCourseHtml, createCourseHtml };
}
