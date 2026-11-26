import { useCallback, useState } from 'react';

const STORAGE_KEY = 'tre-academy-learning-memory-v1';

export interface LearningCourse {
  id: string;
  topic: string;
  createdAt: number;
  completedModules: number[];
  html: string;
  completed: boolean;
  xpAwarded: number;
}

export interface LearningAttempt {
  courseId: string;
  topic: string;
  moduleIndex: number;
  correct: boolean;
  createdAt: number;
}

interface LearningMemory {
  courses: LearningCourse[];
  attempts: LearningAttempt[];
}

const emptyMemory = (): LearningMemory => ({ courses: [], attempts: [] });

function readMemory(): LearningMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyMemory();
    const parsed = JSON.parse(raw) as Partial<LearningMemory>;
    return {
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
    };
  } catch {
    return emptyMemory();
  }
}

export function useLearningMemory() {
  const [memory, setMemory] = useState<LearningMemory>(readMemory);

  const persist = useCallback((next: LearningMemory) => {
    setMemory(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const saveCourse = useCallback((course: LearningCourse) => {
    const current = readMemory();
    const courses = [course, ...current.courses.filter((item) => item.id !== course.id)];
    persist({ ...current, courses });
  }, [persist]);

  const recordAttempt = useCallback((attempt: LearningAttempt) => {
    const current = readMemory();
    const attempts = [attempt, ...current.attempts].slice(0, 500);
    persist({ ...current, attempts });
  }, [persist]);

  const recordModuleCompletion = useCallback((courseId: string, moduleIndex: number) => {
    const current = readMemory();
    let xpAwarded = 0;
    const courses = current.courses.map((course) => {
      if (course.id !== courseId) return course;
      const completedModules = course.completedModules.includes(moduleIndex)
        ? course.completedModules
        : [...course.completedModules, moduleIndex];
      xpAwarded = course.completedModules.includes(moduleIndex) ? course.xpAwarded : course.xpAwarded + 10;
      return {
        ...course,
        completedModules,
        xpAwarded,
        completed: completedModules.length >= 3,
      };
    });
    persist({ ...current, courses });
  }, [persist]);

  const reviewSuggestion = useCallback((): string | null => {
    const wrongAttempts = memory.attempts.filter((attempt) => !attempt.correct);
    if (!wrongAttempts.length) return null;
    const counts = new Map<string, number>();
    wrongAttempts.forEach((attempt) => counts.set(attempt.topic, (counts.get(attempt.topic) ?? 0) + 1));
    const [topic] = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
    return topic ? `Bu konuyu tekrar etmek ister misin: ${topic}?` : null;
  }, [memory.attempts]);

  return {
    courses: memory.courses,
    attempts: memory.attempts,
    saveCourse,
    recordAttempt,
    recordModuleCompletion,
    reviewSuggestion,
  };
}
