export type QuestionStatus =
  | "LOCKED"
  | "NOT_STARTED"
  | "DRAFT_SAVED"
  | "PENDING_REVIEW"
  | "ANSWERED"
  | "CORRECT"
  | "INCORRECT"
  | "RETRY_ALLOWED";

export interface PlayerQuestion {
  id: string;
  code: string;
  title: string;
  points: number;
  order: number;
  type: "TEXT" | "SAFE_DIAL" | "MULTIPLE_CHOICE";
  revealMode: "IMMEDIATE" | "DEFERRED";
  isFinalQuestion: boolean;
  locked: boolean;
  status: QuestionStatus;
  description: string | null;
  options: string[] | null;
  safeDialConfig: { digits: number; minDigit: number; maxDigit: number } | null;
  successMessage: string | null;
  draftAnswer: string | null;
  lastAnswer: string | null;
  awardedPoints: number;
  adminNote: string | null;
  allowRetry: boolean;
  submittedAt: string | null;
}

export interface PlayerMeResponse {
  team: {
    id: string;
    name: string;
    status: string;
    totalScore: number;
    clue1Delivered: boolean;
    clue2Delivered: boolean;
    question7Unlocked: boolean;
    sixTasksCompletedAt: string | null;
    finalQuestionCompletedAt: string | null;
    caseDecodedAt: string | null;
  };
  game: {
    status: string;
    showLiveRanking: boolean;
    leaderboardPublished: boolean;
    storyPublished: boolean;
  };
  questions: PlayerQuestion[];
}

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  totalScore: number;
  correctCount: number;
  caseDecodedAt: string | null;
  durationMs: number | null;
  finalQuestionCompletedAt: string | null;
  sixTasksCompletedAt: string | null;
  status: string;
  isTie: boolean;
}

export interface StoryChapter {
  id: string;
  title: string;
  content: string;
  order: number;
  presenterNote?: string | null;
  imageUrl?: string | null;
}
