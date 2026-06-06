/** 相性質問（全ユーザー共通・12問） */

export type CompatibilityQuestionId =
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | "q5"
  | "q6"
  | "q7"
  | "q8"
  | "q9"
  | "q10"
  | "q11"
  | "q12";

export type CompatibilityAnswers = Partial<Record<CompatibilityQuestionId, string>>;

export const COMPATIBILITY_QUESTION_IDS: CompatibilityQuestionId[] = [
  "q1",
  "q2",
  "q3",
  "q4",
  "q5",
  "q6",
  "q7",
  "q8",
  "q9",
  "q10",
  "q11",
  "q12",
];

export type CompatibilityOption = { id: string; label: string };

export type CompatibilityQuestion = {
  id: CompatibilityQuestionId;
  label: string;
  options: CompatibilityOption[];
};

/** デザイン案の質問文どおり。全問2択（id + 表示ラベル） */
export const COMPATIBILITY_QUESTIONS: CompatibilityQuestion[] = [
  {
    id: "q1",
    label: "旅行に行くなら？",
    options: [
      { id: "plan_ahead", label: "事前にしっかり計画を立てたい" },
      { id: "go_with_flow", label: "行き当たりばったりで楽しみたい" },
    ],
  },
  {
    id: "q2",
    label: "LINEの返信スピードは？",
    options: [
      { id: "fast", label: "すぐ返すタイプ" },
      { id: "when_free", label: "時間ができたらまとめて返す" },
    ],
  },
  {
    id: "q3",
    label: "休日の過ごし方は？",
    options: [
      { id: "out_active", label: "外に出てアクティブに過ごす" },
      { id: "home_relax", label: "家でゆっくり過ごす" },
    ],
  },
  {
    id: "q4",
    label: "誕生日のプレゼントを選ぶときは？",
    options: [
      { id: "practical", label: "相手が普段使う実用的なもの" },
      { id: "surprise", label: "サプライズで気持ちが伝わるもの" },
    ],
  },
  {
    id: "q5",
    label: "恋人との写真をSNSに載せる？",
    options: [
      { id: "often", label: "載せる方だ" },
      { id: "rarely", label: "あまり載せない" },
    ],
  },
  {
    id: "q6",
    label: "相手に直して欲しいところがあったら？",
    options: [
      { id: "tell_direct", label: "はっきり伝える" },
      { id: "wait", label: "言わずに受け入れる" },
    ],
  },
  {
    id: "q7",
    label: "相談されたら？",
    options: [
      { id: "listen_first", label: "まずはじっくり聞く" },
      { id: "together", label: "一緒に考える" },
    ],
  },
  {
    id: "q8",
    label: "待ち合わせ、どちらのタイプ？",
    options: [
      { id: "early", label: "早めに着く" },
      { id: "just_in_time", label: "ギリギリでも間に合えばOK" },
    ],
  },
  {
    id: "q9",
    label: "予定外のトラブルが起きたら？",
    options: [
      { id: "replan", label: "すぐ別プランを考える" },
      { id: "flexible", label: "その場の流れに任せる" },
    ],
  },
  {
    id: "q10",
    label: "恋人の過去の恋愛について",
    options: [
      { id: "open", label: "聞いても気にならない" },
      { id: "minimal", label: "あまり深くは知りたくない" },
    ],
  },
  {
    id: "q11",
    label: "恋人が異性と仲良くしていたら？",
    options: [
      { id: "trust", label: "特に気にしない" },
      { id: "care", label: "境界線は話し合いたい" },
    ],
  },
  {
    id: "q12",
    label: "初めて行くお店では？",
    options: [
      { id: "signature", label: "看板メニューを頼む" },
      { id: "try_new", label: "気になったものを選ぶ" },
    ],
  },
];

const OPTION_IDS_BY_QUESTION = new Map(
  COMPATIBILITY_QUESTIONS.map((q) => [q.id, new Set(q.options.map((o) => o.id))])
);

export function sanitizeCompatibilityAnswers(raw: unknown): CompatibilityAnswers {
  if (!raw || typeof raw !== "object") return {};
  const out: CompatibilityAnswers = {};
  for (const qid of COMPATIBILITY_QUESTION_IDS) {
    const val = (raw as Record<string, unknown>)[qid];
    if (typeof val !== "string" || !val.trim()) continue;
    const allowed = OPTION_IDS_BY_QUESTION.get(qid);
    if (allowed?.has(val)) out[qid] = val;
  }
  return out;
}

export function countAnsweredQuestions(answers: CompatibilityAnswers | null | undefined): number {
  if (!answers) return 0;
  return COMPATIBILITY_QUESTION_IDS.filter((id) => answers[id]).length;
}

export const COMPATIBILITY_QUESTION_COUNT = COMPATIBILITY_QUESTION_IDS.length;

export function getCompatibilityOptionLabel(
  questionId: CompatibilityQuestionId,
  optionId: string | undefined
): string | null {
  if (!optionId) return null;
  const q = COMPATIBILITY_QUESTIONS.find((item) => item.id === questionId);
  return q?.options.find((o) => o.id === optionId)?.label ?? null;
}

export function isCompatibilityQuestionnaireComplete(
  answers: CompatibilityAnswers | null | undefined
): boolean {
  return countAnsweredQuestions(answers) >= COMPATIBILITY_QUESTION_COUNT;
}
