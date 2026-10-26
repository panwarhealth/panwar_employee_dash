import { isQuestion, type CourseDoc, type GradedBlock, type Page, type ResultsBlock } from './doc';
import type { ResultsData } from './context';
import type { Answer } from './scorm';
import { shuffled } from './util';

export const BLANK = /\[([^\]]+)\]/g;

export function blankAnswers(text: string): string[][] {
  return [...text.matchAll(BLANK)].map((m) => m[1].split('|').map((a) => a.trim().toLowerCase()));
}

export function questionPrompt(b: GradedBlock): string {
  if (b.type === 'check') return b.question;
  if (b.type === 'blank') return b.text.replace(BLANK, '___');
  return b.prompt;
}

export function resultsSettings(doc: CourseDoc): ResultsBlock | undefined {
  return doc.pages.flatMap((p) => p.blocks).find((b): b is ResultsBlock => b.type === 'results');
}

export function choosePool(doc: CourseDoc): string[] {
  const size = resultsSettings(doc)?.pool;
  const quizPages = doc.pages.filter((p) => p.blocks.some((b) => isQuestion(b) && b.scored));
  if (!size || size >= quizPages.length) return [];
  return shuffled(quizPages)
    .slice(size)
    .map((p) => p.id);
}

export function computeResults(
  doc: CourseDoc,
  answers: Record<string, Answer>,
  skip: string[],
): ResultsData {
  const questions = doc.pages
    .filter((p) => !skip.includes(p.id))
    .flatMap((p) => p.blocks)
    .filter((b): b is GradedBlock => isQuestion(b) && b.scored);
  const review = questions.map((q) => ({
    id: q.id,
    prompt: questionPrompt(q),
    correct: !!answers[q.id]?.firstCorrect,
  }));
  if (!questions.length) return { score: null, passMark: null, passed: true, review };
  const right = review.filter((r) => r.correct).length;
  const wrong = questions.filter((q) => answers[q.id] && !answers[q.id].firstCorrect).length;
  const raw = resultsSettings(doc)?.negative ? Math.max(0, right - wrong) : right;
  const score = Math.round((raw / questions.length) * 100);
  return {
    score,
    passMark: doc.passMark,
    passed: doc.passMark === null || score >= doc.passMark,
    review,
  };
}

export function cueHidden(page: Page, cueTimes: Record<string, number>): Set<string> {
  const hidden = new Set<string>();
  for (const b of page.blocks)
    if (b.type === 'audio')
      for (const c of b.cues) if ((cueTimes[b.id] ?? -1) < c.at) hidden.add(c.blockId);
  return hidden;
}
