'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import type { SearchFilter } from '@/lib/types';
import { filtersParser } from '@/lib/filterMetadata';
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
  traits: string[];
  filters: SearchFilter[];
  exemplarMalIds: number[];
}

const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  'steady-strategist': {
    id: 'steady-strategist',
    title: 'Steady Strategist',
    tagline: 'You like sharp choices, slow reveals, and characters with a plan.',
    traits: ['Psychological stakes', 'Adult casts', 'Consequences over spectacle'],
    exemplarMalIds: [11061, 9253, 19],
    filters: [
      { field: 'genres', action: 'INCLUDES_ANY', value: ['Drama', 'Suspense'] },
      { field: 'demographics', action: 'INCLUDES_ANY', value: ['Seinen'] },
      { field: 'score', action: 'GREATER_THAN_OR_EQUALS', value: 7.8 },
    ],
  },
  'chaotic-optimist': {
    id: 'chaotic-optimist',
    title: 'Chaotic Optimist',
    tagline: 'You want big swings, loud friends, and a reason to grin after a fight.',
    traits: ['Action momentum', 'Found family', 'Comic release'],
    exemplarMalIds: [20, 31964, 30276],
    filters: [
      { field: 'genres', action: 'INCLUDES_ANY', value: ['Action', 'Comedy', 'Adventure'] },
      { field: 'demographics', action: 'INCLUDES_ANY', value: ['Shounen'] },
      { field: 'score', action: 'GREATER_THAN_OR_EQUALS', value: 7.5 },
    ],
  },
  'quiet-observer': {
    id: 'quiet-observer',
    title: 'Quiet Observer',
    tagline: 'You notice tiny emotional turns and prefer a show that breathes.',
    traits: ['Slice of life', 'Gentle pacing', 'Character texture'],
    exemplarMalIds: [4081, 36098, 42897],
    filters: [
      { field: 'genres', action: 'INCLUDES_ANY', value: ['Slice of Life', 'Drama'] },
      { field: 'score', action: 'GREATER_THAN_OR_EQUALS', value: 7.6 },
      { field: 'episodes', action: 'LESS_THAN_OR_EQUALS', value: 26 },
    ],
  },
  'world-builder': {
    id: 'world-builder',
    title: 'World Builder',
    tagline: 'You want maps, rules, factions, and a setting that keeps unfolding.',
    traits: ['Fantasy systems', 'Adventure arcs', 'Longer commitments'],
    exemplarMalIds: [5114, 16498, 21],
    filters: [
      { field: 'genres', action: 'INCLUDES_ANY', value: ['Fantasy', 'Adventure', 'Sci-Fi'] },
      { field: 'episodes', action: 'GREATER_THAN_OR_EQUALS', value: 24 },
      { field: 'score', action: 'GREATER_THAN_OR_EQUALS', value: 7.7 },
    ],
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
        weights: { 'steady-strategist': 2, 'world-builder': 1 },
      },
      { label: 'Rivals, training, and payoff', weights: { 'chaotic-optimist': 2 } },
      { label: 'Small choices that quietly hurt', weights: { 'quiet-observer': 2 } },
      { label: 'Rules, factions, and lore', weights: { 'world-builder': 2 } },
    ],
  },
  {
    id: 'pace',
    prompt: 'How much commitment sounds right?',
    answers: [
      {
        label: 'A tight 12-26 episode run',
        weights: { 'quiet-observer': 2, 'steady-strategist': 1 },
      },
      {
        label: 'A long journey if the cast is worth it',
        weights: { 'world-builder': 2, 'chaotic-optimist': 1 },
      },
      { label: 'Anything, as long as it is fun', weights: { 'chaotic-optimist': 2 } },
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
  const result = useMemo(() => scoreAnswers(answers), [answers]);
  const complete = Object.keys(answers).length === QUESTIONS.length;

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4">
        {QUESTIONS.map((question, index) => (
          <div key={question.id} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Question {index + 1}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-foreground">{question.prompt}</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {question.answers.map((answer) => {
                const selected = answers[question.id]?.label === answer.label;
                return (
                  <button
                    key={answer.label}
                    type="button"
                    onClick={() => {
                      if (!startedRef.current) {
                        startedRef.current = true;
                        trackQuizStarted();
                      }
                      setAnswers((prev) => ({ ...prev, [question.id]: answer }));
                    }}
                    className={[
                      'min-h-14 rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                      selected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    {answer.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <aside className="h-fit rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase text-muted-foreground">Your Shelf archetype</p>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">{result.title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{result.tagline}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {result.traits.map((trait) => (
            <span
              key={trait}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
            >
              {trait}
            </span>
          ))}
        </div>
        <div className="mt-5 rounded-lg border border-dashed border-border bg-background p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Share card preview</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{result.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{result.tagline}</p>
          <p className="mt-3 text-xs text-muted-foreground">Result URL only encodes: {result.id}</p>
        </div>
        <Button asChild className="mt-5 w-full" disabled={!complete}>
          <Link
            to={complete ? buildSearchHref(result) : '/quiz'}
            onClick={() => {
              if (complete) trackQuizResultClick(result.id, 'search');
            }}
          >
            Explore shows for this archetype
          </Link>
        </Button>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
          {result.exemplarMalIds.map((id) => (
            <Link
              key={id}
              to="/anime/$malId"
              params={{ malId: String(id) }}
              onClick={() => trackQuizResultClick(result.id, 'exemplar_detail')}
              className="rounded-md border border-border px-2 py-2 hover:text-foreground"
            >
              MAL {id}
            </Link>
          ))}
        </div>
        {!complete && (
          <p className="mt-3 text-xs text-muted-foreground">
            Answer all questions to unlock the search link.
          </p>
        )}
      </aside>
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

  const [winner] = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return ARCHETYPES[winner[0] as ArchetypeId];
}

function buildSearchHref(archetype: Archetype) {
  const filters: SearchFilter[] = [
    ...archetype.filters,
    { field: 'members', action: 'GREATER_THAN_OR_EQUALS', value: 100000 },
  ];
  // Use the shared serializer (object-wrapped {f:[...]}) so the link round-trips
  // through the nuqs TanStack Router adapter; a bare af=[...] array gets corrupted.
  return `/search?af=${encodeURIComponent(filtersParser.serialize(filters))}&sort=score`;
}
