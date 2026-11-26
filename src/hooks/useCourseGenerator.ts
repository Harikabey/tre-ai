import { useCallback, useState } from 'react';
import DOMPurify from 'dompurify';
import { useLocalModel } from '@/hooks/useLocalModel';

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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseJsonResponse(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Yerel model JSON formatında kurs planı oluşturmadı.');
  return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
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
  const { isReady, generateResponse } = useLocalModel();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateCourse = useCallback(async (topic: string): Promise<GeneratedCourse> => {
    const normalizedTopic = topic.trim();
    if (!normalizedTopic) throw new Error('Bir kurs konusu girin.');
    if (!isReady) throw new Error('Kurs üretmek için Ayarlar’dan yerel modeli indirip yükleyin.');

    setIsGenerating(true);
    try {
      const response = await generateResponse([
        {
          role: 'system',
          content: 'Sen Tre Akademi kurs üretim motorusun. Güvenli, öğretici ve yalnızca geçerli JSON üret. Markdown veya açıklama yazma.',
        },
        {
          role: 'user',
          content: `Aşağıdaki konu için 3 modüllük bir kurs planı oluştur. Her modül için: başlık, kısa teori, 1 quiz sorusu ve 1 interaktif etkinlik (sürükle-bırak veya boşluk doldurma) hazırla. Etkinlik activity nesnesinde type, instruction, prompt, items ve correctAnswer alanlarını içersin. Quizde question, options ve correctIndex alanlarını içersin. Yanıtını JSON formatında ver: {"modules":[{"title":"...","content":"...","quiz":{"question":"...","options":["..."],"correctIndex":0},"activity":{"type":"fill_blank","instruction":"...","prompt":"...","items":["..."],"correctAnswer":"..."}}]}. Konu: ${normalizedTopic}`,
        },
      ]);
      const parsed = parseJsonResponse(response);
      if (!isCoursePlan(parsed)) throw new Error('Yerel model beklenen 3 modüllü kurs biçimini vermedi.');
      return { topic: normalizedTopic, modules: parsed.modules };
    } finally {
      setIsGenerating(false);
    }
  }, [generateResponse, isReady]);

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
