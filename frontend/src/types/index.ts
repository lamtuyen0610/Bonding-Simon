export type QuestionStatus =
  | "LOCKED"
  | "NOT_STARTED"
  | "DRAFT_SAVED"
  | "PENDING_REVIEW"
  | "CORRECT"
  | "INCORRECT"
  | "RETRY_ALLOWED";

export interface PlayerQuestion {
  id: string;
  code: string;
  title: string;
  points: number;
  order: number;
  type: "TEXT" | "SAFE_DIAL";
  isFinalQuestion: boolean;
  locked: boolean;
  status: QuestionStatus;
  description: string | null;
  safeDialConfig: { digits: number; minDigit: number; maxDigit: number } | null;
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
