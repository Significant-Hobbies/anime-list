'use client';

import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import type { SearchFilter } from '@/lib/types';
import { serializeFilters } from '@/lib/filterSerialization';
import {
  trackQuizCompleted,
  trackQuizResultClick,
  trackQuizResultShown,
  trackQuizStarted,
  trackQuizViewed,
} from '@/lib/engagement';

type ArchetypeId = 'steady-strategist' | 'chaotic-optimist' | 'quiet-observer' | 'world-builder';

interface Answer {
  label: string;
  weights: Partial<Record<ArchetypeId, number>>;
  episodeFilter?: SearchFilter;
  genres?: string[];
}

interface Question {
  id: string;
  prompt: string;
  answers: Answer[];
}

interface Archetype {
  id: ArchetypeId;
  title: string;
  tagline: string;
}

const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  'steady-strategist': {
    id: 'steady-strategist',
    title: 'Steady Strategist',
    tagline: 'You like sharp choices, slow reveals, and characters with a plan.',
  },
  'chaotic-optimist': {
    id: 'chaotic-optimist',
    title: 'Chaotic Optimist',
    tagline: 'You want big swings, loud friends, and a reason to grin after a fight.',
  },
  'quiet-observer': {
    id: 'quiet-observer',
    title: 'Quiet Observer',
    tagline: 'You notice tiny emotional turns and prefer a show that breathes.',
  },
  'world-builder': {
    id: 'world-builder',
    title: 'World Builder',
    tagline: 'You want maps, rules, factions, and a setting that keeps unfolding.',
  },
};

const QUESTIONS: Question[] = [
  {
    id: 'energy',
    prompt: 'What should a first episode do?',
    answers: [
      { label: 'Set up a smart problem', weights: { 'steady-strategist': 2 } },
      { label: 'Start moving immediately', weights: { 'chaotic-optimist': 2 } },
      { label: 'Let me settle into the mood', weights: { 'quiet-observer': 2 } },
      { label: 'Open a door to a bigger world', weights: { 'world-builder': 2 } },
    ],
  },
  {
    id: 'stakes',
    prompt: 'Pick the tension you actually enjoy.',
    answers: [
      {
        label: 'Mind games and tradeoffs',
        genres: ['Mystery', 'Suspense'],
        weights: { 'steady-strategist': 2, 'world-builder': 1 },
      },
      {
        label: 'Rivals, training, and payoff',
        genres: ['Action', 'Sports'],
        weights: { 'chaotic-optimist': 2 },
      },
      {
        label: 'Small choices that quietly hurt',
        genres: ['Drama', 'Slice of Life'],
        weights: { 'quiet-observer': 2 },
      },
      {
        label: 'Rules, factions, and lore',
        genres: ['Fantasy', 'Adventure', 'Sci-Fi'],
        weights: { 'world-builder': 2 },
      },
    ],
  },
  {
    id: 'pace',
    prompt: 'How much commitment sounds right?',
    answers: [
      {
        label: 'Up to 13 episodes',
        weights: {},
        episodeFilter: { field: 'episodes', action: 'LESS_THAN_OR_EQUALS', value: 13 },
      },
      {
        label: 'At least 24 episodes',
        weights: {},
        episodeFilter: { field: 'episodes', action: 'GREATER_THAN_OR_EQUALS', value: 24 },
      },
      { label: 'Any length', weights: {} },
    ],
  },
  {
    id: 'tone',
    prompt: 'What aftertaste should it leave?',
    answers: [
      { label: 'I want to think about it tomorrow', weights: { 'steady-strategist': 2 } },
      { label: 'I want to send clips to friends', weights: { 'chaotic-optimist': 2 } },
      { label: 'I want to feel calmer', weights: { 'quiet-observer': 2 } },
      { label: 'I want theories and wiki tabs', weights: { 'world-builder': 2 } },
    ],
  },
];

export default function AnimeIdentityQuiz() {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [step, setStep] = useState(0);
  const complete = step === QUESTIONS.length;
  const question = QUESTIONS[step];
  const heading = useRef<HTMLHeadingElement>(null);
  const result = scoreAnswers(answers);
  const episodeChoice = answers.pace;
  const genres = answers.stakes?.genres ?? [];

  // Funnel: viewed -> started (first answer) -> completed. Refs de-dupe
  // per mount; only the derived archetype id is ever sent (never answers).
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    trackQuizViewed();
  }, []);

  useEffect(() => {
    if (complete && !completedRef.current) {
      completedRef.current = true;
      trackQuizCompleted(result.id);
      trackQuizResultShown(result.id);
    }
  }, [complete, result.id]);

  useEffect(() => {
    if (startedRef.current) heading.current?.focus();
  }, [step]);

  function selectAnswer(answer: Answer) {
    if (!startedRef.current) {
      startedRef.current = true;
      trackQuizStarted();
    }
    setAnswers((previous) => ({ ...previous, [question.id]: answer }));
  }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-7">
      {complete ? (
        <>
          <p className="text-sm text-muted-foreground">Your anime archetype</p>
          <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold">
            {result.title}
          </h2>
          <p>{result.tagline}</p>
          <div className="space-y-1 text-sm">
            <h3 className="font-medium">Your search filters</h3>
            <p className="text-muted-foreground">
              {genres.join(' or ')} · {episodeChoice.label}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link
                to={buildSearchHref(genres, episodeChoice)}
                onClick={() => trackQuizResultClick(result.id, 'search')}
              >
                Explore in Search
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setStep(0)}>
              Edit answers
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Question {step + 1} of {QUESTIONS.length}
          </p>
          <h2 id="quiz-question" ref={heading} tabIndex={-1} className="text-xl font-semibold">
            {question.prompt}
          </h2>
          <QuizChoices
            question={question}
            choice={answers[question.id]}
            selectAnswer={selectAnswer}
          />
          <div className="flex justify-between gap-3">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
              Back
            </Button>
            <Button disabled={!answers[question.id]} onClick={() => setStep(step + 1)}>
              {step === QUESTIONS.length - 1 ? 'See my result' : 'Next'}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function QuizChoices({
  question,
  choice,
  selectAnswer,
}: {
  question: Question;
  choice?: Answer;
  selectAnswer: (answer: Answer) => void;
}) {
  return (
    <div role="group" aria-labelledby="quiz-question" className="grid gap-2 sm:grid-cols-2">
      {question.answers.map((answer) => {
        const selected = choice === answer;
        return (
          <button
            key={answer.label}
            type="button"
            aria-pressed={selected}
            onClick={() => selectAnswer(answer)}
            className={`min-h-14 rounded-lg border px-4 py-3 text-left text-sm ${selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}
          >
            {answer.label}
          </button>
        );
      })}
    </div>
  );
}

function scoreAnswers(answers: Record<string, Answer>) {
  const scores: Record<ArchetypeId, number> = {
    'steady-strategist': 0,
    'chaotic-optimist': 0,
    'quiet-observer': 0,
    'world-builder': 0,
  };

  for (const answer of Object.values(answers)) {
    for (const [id, score] of Object.entries(answer.weights)) {
      scores[id as ArchetypeId] += score ?? 0;
    }
  }

  // When tastes split evenly, use the viewer's first-episode preference.
  const opening = answers.energy?.weights;
  const [winner] = (Object.keys(scores) as ArchetypeId[]).sort(
    (left, right) =>
      scores[right] - scores[left] || (opening?.[right] ?? 0) - (opening?.[left] ?? 0)
  );
  return ARCHETYPES[winner];
}

function buildSearchHref(genres: string[], length: Answer) {
  const filters: SearchFilter[] = [
    { field: 'genres', action: 'INCLUDES_ANY', value: genres },
    ...(length.episodeFilter ? [length.episodeFilter] : []),
  ];
  // Use the shared serializer (object-wrapped {f:[...]}) so the link round-trips
  // through the nuqs TanStack Router adapter; a bare af=[...] array gets corrupted.
  return `/search?af=${encodeURIComponent(serializeFilters(filters))}&min=0`;
}
