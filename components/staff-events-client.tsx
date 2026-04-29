"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRequireAuth } from "@/lib/use-require-auth";
import { isFirebaseConfigComplete } from "@/lib/firebase";
import {
  addSlotChoiceAsStaff,
  checkIsLobbyStaff,
  createLobbyEventAsStaff,
  subscribeStaffAllEvents,
  type StaffEventListRow,
} from "@/lib/firestore-staff-events";
import type { EventSlotPeriod, LobbyCohort } from "@/lib/lobby-firestore-types";

function localDatetimeInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocalDatetimeInput(v: string): Date {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error("開始日時の形式が不正です。");
  return d;
}

function dateKeyFromYmd(y: string, m: string, day: string): string {
  return `${y}${m.padStart(2, "0")}${day.padStart(2, "0")}`;
}

export function StaffEventsClient() {
  const { user, loading } = useRequireAuth();
  const [staffChecked, setStaffChecked] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [events, setEvents] = useState<StaffEventListRow[]>([]);
  const [listErr, setListErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [startsLocal, setStartsLocal] = useState(() => localDatetimeInputValue(new Date()));
  const [endsLocal, setEndsLocal] = useState("");
  const [locationSummary, setLocationSummary] = useState("");
  const [description, setDescription] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const [slotEventId, setSlotEventId] = useState("");
  const [slotY, setSlotY] = useState(String(new Date().getFullYear()));
  const [slotM, setSlotM] = useState(String(new Date().getMonth() + 1));
  const [slotD, setSlotD] = useState(String(new Date().getDate()));
  const [slotPeriod, setSlotPeriod] = useState<EventSlotPeriod>("morning");
  const [slotCohort, setSlotCohort] = useState<LobbyCohort>("A");
  const [slotLine, setSlotLine] = useState<0 | 1>(0);
  const [slotLabel, setSlotLabel] = useState("");
  const [slotMsg, setSlotMsg] = useState<string | null>(null);
  const [slotBusy, setSlotBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    void (async () => {
      const ok = await checkIsLobbyStaff(user.uid);
      if (!cancelled) {
        setIsStaff(ok);
        setStaffChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  useEffect(() => {
    if (!user || !isStaff || !isFirebaseConfigComplete()) return;
    const unsub = subscribeStaffAllEvents(
      (rows) => {
        setEvents(rows);
        setListErr(null);
        setSlotEventId((prev) => {
          if (prev && rows.some((r) => r.id === prev)) return prev;
          return rows[0]?.id ?? "";
        });
      },
      (code) => setListErr(code)
    );
    return () => {
      unsub?.();
    };
  }, [user, isStaff]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateMsg(null);
    setCreateBusy(true);
    try {
      const startsAt = parseLocalDatetimeInput(startsLocal);
      let endsAt: Date | null = null;
      if (endsLocal.trim()) {
        endsAt = parseLocalDatetimeInput(endsLocal);
      }
      const id = await createLobbyEventAsStaff({
        title,
        startsAt,
        endsAt,
        description,
        locationSummary,
        isPublished: publishNow,
      });
      setCreateMsg(`作成しました（ID: ${id}）。ダッシュボードのイベントタブで公開中なら表示されます。`);
      setTitle("");
    } catch (err) {
      setCreateMsg(err instanceof Error ? err.message : "作成に失敗しました。");
    } finally {
      setCreateBusy(false);
    }
  };

  const handleAddSlot = async (e: FormEvent) => {
    e.preventDefault();
    setSlotMsg(null);
    if (!slotEventId) {
      setSlotMsg("先にイベントを一覧に表示してください（イベントが無ければ上で作成）。");
      return;
    }
    setSlotBusy(true);
    try {
      const dateKey = dateKeyFromYmd(slotY, slotM, slotD);
      await addSlotChoiceAsStaff(slotEventId, {
        dateKey,
        period: slotPeriod,
        cohort: slotCohort,
        lineIndex: slotLine,
        destinationLabel: slotLabel,
      });
      setSlotMsg("枠（行き先）を追加しました。");
      setSlotLabel("");
    } catch (err) {
      setSlotMsg(err instanceof Error ? err.message : "追加に失敗しました。");
    } finally {
      setSlotBusy(false);
    }
  };

  if (!isFirebaseConfigComplete()) {
    return (
      <p className="text-sm text-zinc-600">
        Firebase の環境変数が未設定です。`.env.local` を確認してください。
      </p>
    );
  }

  if (loading || !user) {
    return <p className="text-sm text-zinc-500">読み込み中…</p>;
  }

  if (!staffChecked) {
    return <p className="text-sm text-zinc-500">権限を確認しています…</p>;
  }

  if (!isStaff) {
    return (
      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-700">
          このページは運営スタッフのみ利用できます。Firebase Console でコレクション{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">admins</code> に、あなたの
          UID と同じドキュメント ID のドキュメントを 1 件作成してください（フィールドは空で構いません）。
        </p>
        <p className="break-all font-mono text-xs text-zinc-500">あなたの UID: {user.uid}</p>
        <Link href="/dashboard" className="inline-block text-sm font-medium text-zinc-800 underline">
          ダッシュボードへ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-serif text-2xl font-semibold text-zinc-900">イベント・枠（運営）</h1>
        <p className="text-sm text-zinc-600">
          Console の代わりに、フォームから <code className="font-mono text-xs">events</code> と{" "}
          <code className="font-mono text-xs">slotChoices</code> を追加できます。ルールをデプロイ済みにしてください。
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">外部フォーム運用（最小入力）</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Googleフォーム等からは、この画面の代わりに API に送信できます。必須は
          <code className="ml-1 font-mono text-xs">title</code> と
          <code className="ml-1 font-mono text-xs">startsAt</code> だけです。
        </p>
        <div className="mt-3 space-y-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700">
          <p>
            送信先: <code className="font-mono">POST /api/staff/events</code>
          </p>
          <p>
            ヘッダー: <code className="font-mono">x-lobby-intake-token: LOBBY_EVENT_INTAKE_TOKEN</code>
          </p>
          <p>JSON: {"{ \"title\": \"名古屋オフ会\", \"startsAt\": \"2026-05-10T01:00:00.000Z\" }"}</p>
          <p>作成イベントは下書き（非公開）なので、必要に応じて下の一覧から確認してください。</p>
          <p>
            毎週木曜の自動処理（<code className="font-mono">/api/admin/weekly-operations</code>）で、次週表示範囲と
            A/B グループが更新されます。
          </p>
        </div>
      </section>

      {listErr ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          一覧の取得エラー: {listErr}（インデックスやログインを確認）
        </p>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">直近のイベント（全件・下書き含む）</h2>
        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
          {events.length === 0 ? (
            <li className="text-zinc-500">まだありません。</li>
          ) : (
            events.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-baseline gap-2 border-b border-zinc-100 pb-2 last:border-0">
                <span className="font-medium text-zinc-900">{ev.title}</span>
                <span className="text-zinc-500">{ev.isPublished ? "公開" : "下書き"}</span>
                <code className="text-xs text-zinc-400">{ev.id}</code>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">新規イベント</h2>
        <form className="mt-4 space-y-4" onSubmit={handleCreate}>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">タイトル</span>
            <input
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 名古屋オフ会"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-600">開始（ローカル時刻）</span>
              <input
                required
                type="datetime-local"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                value={startsLocal}
                onChange={(e) => setStartsLocal(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-600">終了（任意）</span>
              <input
                type="datetime-local"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                value={endsLocal}
                onChange={(e) => setEndsLocal(e.target.value)}
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">場所の一行（任意）</span>
            <input
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              value={locationSummary}
              onChange={(e) => setLocationSummary(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">説明（任意）</span>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
            いまから公開する（<code className="font-mono text-xs">isPublished: true</code>）
          </label>
          <button
            type="submit"
            disabled={createBusy}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {createBusy ? "作成中…" : "イベントを作成"}
          </button>
          {createMsg ? <p className="text-sm text-zinc-600">{createMsg}</p> : null}
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-zinc-900">行き先枠（slotChoices）を 1 件追加</h2>
        <p className="mt-1 text-xs text-zinc-500">
          A/B 両方の日に出すなら、同じ日付・帯で cohort だけ変えたドキュメントを 2 本作ります。
        </p>
        <form className="mt-4 space-y-4" onSubmit={handleAddSlot}>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">対象イベント</span>
            <select
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              value={slotEventId}
              onChange={(e) => setSlotEventId(e.target.value)}
            >
              {events.length === 0 ? (
                <option value="">（イベントを先に作成）</option>
              ) : (
                events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} {ev.isPublished ? "" : "（下書き）"} — {ev.id}
                  </option>
                ))
              )}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-zinc-600">年</span>
              <input
                className="w-24 rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                value={slotY}
                onChange={(e) => setSlotY(e.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-zinc-600">月</span>
              <input
                className="w-16 rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                value={slotM}
                onChange={(e) => setSlotM(e.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-zinc-600">日</span>
              <input
                className="w-16 rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                value={slotD}
                onChange={(e) => setSlotD(e.target.value)}
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-600">帯</span>
              <select
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                value={slotPeriod}
                onChange={(e) => setSlotPeriod(e.target.value as EventSlotPeriod)}
              >
                <option value="morning">朝</option>
                <option value="afternoon">昼</option>
                <option value="evening">夜</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-600">コホート</span>
              <select
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                value={slotCohort}
                onChange={(e) => setSlotCohort(e.target.value as LobbyCohort)}
              >
                <option value="A">A</option>
                <option value="B">B</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-600">lineIndex（0 または 1）</span>
              <select
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                value={slotLine}
                onChange={(e) => setSlotLine(Number(e.target.value) as 0 | 1)}
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">行き先ラベル</span>
            <input
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              value={slotLabel}
              onChange={(e) => setSlotLabel(e.target.value)}
              placeholder="例: ○○会議室"
            />
          </label>
          <button
            type="submit"
            disabled={slotBusy || !slotEventId}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
          >
            {slotBusy ? "追加中…" : "枠を追加"}
          </button>
          {slotMsg ? <p className="text-sm text-zinc-600">{slotMsg}</p> : null}
        </form>
      </section>

      <p className="text-center text-sm">
        <Link href="/dashboard" className="text-zinc-600 underline">
          ダッシュボードへ
        </Link>
      </p>
    </div>
  );
}
