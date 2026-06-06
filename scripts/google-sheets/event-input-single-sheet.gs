/**
 * Lobby EventInput one-sheet operation script.
 *
 * 運用モデル:
 * - シーズン開始前（または随時）に EventInput へシーズン分の枠を登録し Send Pending Rows で Firestore へ保存
 * - ユーザーアプリへの「公開」は毎週木曜の週次処理（eventDisplayWindow + cohortWeeks）で次週（日〜土）分のみ
 * - スプシ送信＝データ登録。ユーザーが見えるタイミングは木曜の自動公開
 *
 * 1) Create a spreadsheet.
 * 2) Extensions -> Apps Script, paste this file.
 * 3) Edit PROJECT_CONFIG for your domain/tokens.
 * 4) Reload spreadsheet, run menu: Lobby Ops -> Setup EventInput Sheet
 * 5) Fill rows and run menu: Lobby Ops -> Send Pending Rows
 */

const NOTES_SHEET_NAME = "LobbyOpsNotes";

const PROJECT_CONFIG = {
  BASE_URL: "https://YOUR_DOMAIN",
  EVENT_INTAKE_TOKEN: "REPLACE_WITH_LOBBY_EVENT_INTAKE_TOKEN",
};

const SHEET_NAME = "EventInput";
const MASTER_SHEET_NAME = "EventMasterList";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Lobby Ops")
    .addItem("Setup EventInput Sheet（⚠初回のみ・データ全消去）", "setupEventInputSheetWithConfirm")
    .addItem("Send Pending Rows", "sendPendingRows")
    .addToUi();
}

/** メニューから Setup を押したとき — 誤操作防止の確認ダイアログ */
function setupEventInputSheetWithConfirm() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    "Setup EventInput Sheet",
    "⚠ 注意\n\n" +
      "EventInput シートの入力内容をすべて削除し、列・入力ルールを作り直します。\n" +
      "本番データがある状態では絶対に実行しないでください。\n\n" +
      "初回セットアップ、または意図的にシートを作り直す場合のみ「はい」を選んでください。",
    ui.ButtonSet.YES_NO
  );
  if (result !== ui.Button.YES) return;
  setupEventInputSheet();
}

function setupEventInputSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = getOrCreateSheet_(ss, SHEET_NAME);
  const masterSh = getOrCreateSheet_(ss, MASTER_SHEET_NAME);
  const shAll = sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns());
  const masterAll = masterSh.getRange(1, 1, masterSh.getMaxRows(), masterSh.getMaxColumns());
  sh.clear();
  shAll.clearDataValidations();
  shAll.clearFormat();
  masterSh.clear();
  masterAll.clearDataValidations();
  masterAll.clearFormat();

  const headers = [
    "eventName",
    "eventDate",
    "startTime(HH:mm)",
    "period(auto)",
    "cohort(A/B/AB)",
    "lineIndex(0/1)",
    "eventDetail",
    "sendStatus",
    "errorMessage",
    "updatedAt",
  ];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
  sh.getRange(1, 1, 1, headers.length).setHorizontalAlignment("center").setVerticalAlignment("middle");
  sh.getRange(2, 1, sh.getMaxRows() - 1, headers.length).setVerticalAlignment("middle");

  masterSh.getRange(1, 1, 1, 3).setValues([["eventName", "unused", "timeOptions"]]);
  masterSh.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f3f4f6");
  masterSh.setFrozenRows(1);
  masterSh.getRange(2, 1, 5, 1).setValues([
    ["名古屋駅2番出口集合"],
    ["栄駅東口集合"],
    ["伏見駅4番出口集合"],
    [""],
    [""],
  ]);
  const timeOptions = [];
  for (let h = 8; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 22 && m > 0) break;
      timeOptions.push([`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`]);
    }
  }
  masterSh.getRange(2, 3, timeOptions.length, 1).setValues(timeOptions);

  // Validation rules
  const eventNameRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(masterSh.getRange("A2:A"), true)
    .setAllowInvalid(false)
    .build();
  sh.getRange("A2:A").setDataValidation(eventNameRule);
  const dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build();
  sh.getRange("B2:B").setDataValidation(dateRule);
  const timeRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(masterSh.getRange(2, 3, timeOptions.length, 1), true)
    .setAllowInvalid(false)
    .build();
  sh.getRange("C2:C").setDataValidation(timeRule);

  const cohortRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["A", "B", "AB"], true)
    .setAllowInvalid(false)
    .build();
  sh.getRange("E2:E").setDataValidation(cohortRule);

  const lineIndexRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["0", "1"], true)
    .setAllowInvalid(false)
    .build();
  sh.getRange("F2:F").setDataValidation(lineIndexRule);

  // Make the layout stable on every setup run.
  sh.setColumnWidths(1, headers.length, 130);
  sh.setColumnWidth(1, 240); // eventName
  sh.setColumnWidth(2, 130); // eventDate
  sh.setColumnWidth(3, 120); // startTime
  sh.setColumnWidth(4, 140); // period(auto)
  sh.setColumnWidth(5, 130); // cohort
  sh.setColumnWidth(6, 130); // lineIndex
  sh.setColumnWidth(7, 320); // eventDetail
  sh.setColumnWidth(8, 120); // sendStatus
  sh.setColumnWidth(9, 300); // errorMessage
  sh.setColumnWidth(10, 180); // updatedAt
  sh.getRange("G:G").setWrap(true);
  sh.getRange("I:I").setWrap(true);
  sh.getRange("B2:B").setNumberFormat("yyyy-mm-dd");
  sh.getRange("C2:C").setNumberFormat("hh:mm");
  sh.getRange("D2:D").setHorizontalAlignment("center");
  sh.getRange("E2:F").setHorizontalAlignment("center");
  sh.getRange("H2:J").setHorizontalAlignment("center");

  setupLobbyOpsNotesSheet_(ss);

  masterSh.setColumnWidth(1, 280);
  masterSh.setColumnWidth(3, 120);
  masterSh.hideColumns(2, 2);
  showAlert_("EventInput setup complete.");
}

function setupLobbyOpsNotesSheet_(ss) {
  const sh = getOrCreateSheet_(ss, NOTES_SHEET_NAME);
  sh.clear();
  sh.setColumnWidth(1, 720);
  const lines = [
    ["Lobby イベント枠 — 運用メモ"],
    [""],
    ["■ Lobby Ops メニュー"],
    ["・Send Pending Rows … 入力済み行を Firestore に送信（日常運用で使う）"],
    ["・Setup EventInput Sheet … ⚠ 初回のみ。EventInput の内容を全消去して列を作り直す。本番データがあるときは押さない"],
    ["  （押すと確認ダイアログが出ます。「はい」で実行）"],
    [""],
    ["■ スプレッドシート（EventInput）"],
    ["・シーズン開始前に、シーズン分の eventDate / cohort / lineIndex を入力しておく（後から行追加も可）"],
    ["・Lobby Ops → Send Pending Rows で Firestore（events/.../slotChoices）に保存"],
    ["・送信直後もユーザーには見えない。Firestore にデータがあるだけ"],
    [""],
    ["■ ユーザーへの公開（毎週木曜 12:00 JST 頃・Vercel Cron）"],
    ["・次週の日曜〜土曜の1週間分だけ eventDisplayWindow/current が切り替わる"],
    ["・同タイミングで A/B コホート（users/{uid}/cohortWeeks/{weekKey}）を割当"],
    ["・先週 A だった人が今週 B になっても、先週の cohortWeeks レコードは書き換えない"],
    [""],
    ["■ 障害時"],
    ["・管理サイト /dashboard/events 最下部 → 週次処理の緊急手動実行"],
  ];
  sh.getRange(1, 1, lines.length, 1).setValues(lines);
  sh.getRange(1, 1).setFontWeight("bold").setFontSize(12);
  sh.getRange(3, 1, 1, 1).setFontWeight("bold");
  sh.getRange(5, 1, 2, 1).setFontColor("#b45309");
  sh.getRange(8, 1, 1, 1).setFontWeight("bold");
  sh.getRange(13, 1, 1, 1).setFontWeight("bold");
  sh.getRange(18, 1, 1, 1).setFontWeight("bold");
  sh.setFrozenRows(1);
}

function onEdit(e) {
  const range = e && e.range;
  if (!range) return;
  const sh = range.getSheet();
  if (sh.getName() !== SHEET_NAME) return;
  if (range.getRow() < 2) return;
  if (range.getColumn() !== 3) return;

  const startTime = normalizeStartTime_(range.getDisplayValue());
  const period = derivePeriodFromTime_(startTime);
  const periodCell = sh.getRange(range.getRow(), 4);
  if (period) {
    periodCell.setValue(period);
    return;
  }
  periodCell.clearContent();
  sh.getRange(range.getRow(), 8, 1, 3).setValues([["ERROR", "startTime は 08:00-22:00 の範囲で入力", new Date()]]);
}

function derivePeriodFromTime_(startTime) {
  const normalized = normalizeStartTime_(startTime);
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(normalized);
  if (!m) return "";
  const hour = Number(m[1]);
  const min = Number(m[2]);
  const total = hour * 60 + min;
  if (total >= 8 * 60 && total <= 10 * 60 + 59) return "morning";
  if (total >= 11 * 60 && total <= 16 * 60 + 59) return "afternoon";
  if (total >= 17 * 60 && total <= 22 * 60) return "evening";
  return "";
}

function normalizeStartTime_(value) {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || "Asia/Tokyo";
  if (value instanceof Date) {
    return Utilities.formatDate(value, tz, "HH:mm");
  }
  if (typeof value === "number" && isFinite(value)) {
    const totalMinutes = Math.round((value % 1) * 24 * 60);
    const h = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
    const m = String(totalMinutes % 60).padStart(2, "0");
    return `${h}:${m}`;
  }
  return String(value || "").trim();
}

function normalizeDateKey_(value) {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || "Asia/Tokyo";
  if (value instanceof Date) return Utilities.formatDate(value, tz, "yyyyMMdd");
  if (typeof value === "number" && isFinite(value)) {
    const base = new Date(Date.UTC(1899, 11, 30));
    base.setUTCDate(base.getUTCDate() + Math.floor(value));
    return Utilities.formatDate(base, tz, "yyyyMMdd");
  }
  const raw = String(value || "").trim();
  if (/^\d{8}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return Utilities.formatDate(d, tz, "yyyyMMdd");
  return "";
}

function sendPendingRows() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh) {
    showAlert_("Sheet not found.");
    return;
  }

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  const range = sh.getRange(2, 1, lastRow - 1, 10);
  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  let success = 0;
  let failure = 0;

  for (let i = 0; i < values.length; i++) {
    const rowNo = i + 2;
    const [eventName, eventDate, _startTimeRaw, period, cohort, lineIndex, eventDetail, sendStatus] = values[i];
    const startTimeDisplay = displayValues[i][2];

    if (!String(eventName || "").trim()) continue;

    const dateKey = normalizeDateKey_(eventDate);
    if (!dateKey) {
      sh.getRange(rowNo, 8, 1, 3).setValues([["ERROR", "eventDate は日付選択で入力してください", new Date()]]);
      failure++;
      continue;
    }

    const normalizedStartTime = normalizeStartTime_(startTimeDisplay);
    const computedPeriod = derivePeriodFromTime_(normalizedStartTime);
    if (!computedPeriod) {
      sh.getRange(rowNo, 8, 1, 3).setValues([["ERROR", "startTime は 08:00-22:00 の範囲で入力", new Date()]]);
      failure++;
      continue;
    }
    if (String(period || "") !== computedPeriod) {
      sh.getRange(rowNo, 4).setValue(computedPeriod);
    }

    const payload = {
      eventName: String(eventName || "").trim(),
      dateKey,
      startTime: normalizedStartTime,
      period: computedPeriod,
      cohort: String(cohort || "").trim(),
      lineIndex: Number(lineIndex),
      eventDetail: String(eventDetail || "").trim(),
    };

    const validationMessage = validateRowPayload_(payload);
    if (validationMessage) {
      sh.getRange(rowNo, 8, 1, 3).setValues([["ERROR", validationMessage, new Date()]]);
      failure++;
      continue;
    }

    const res = postJson_(`${PROJECT_CONFIG.BASE_URL}/api/staff/event-slots`, payload, {
      "x-lobby-intake-token": PROJECT_CONFIG.EVENT_INTAKE_TOKEN,
    });

    if (res.ok) {
      sh.getRange(rowNo, 8, 1, 3).setValues([["SENT", "", new Date()]]);
      success++;
    } else {
      const msg = res.message || `HTTP ${res.status}`;
      sh.getRange(rowNo, 8, 1, 3).setValues([["ERROR", msg, new Date()]]);
      failure++;
    }
  }

  showAlert_(`Done. success=${success}, failure=${failure}`);
}

/**
 * time-based trigger から呼ぶ用（UI なしでも失敗しない）。
 * Trigger はこの関数を指定する。
 */
function sendPendingRowsTrigger() {
  sendPendingRows();
}

function validateRowPayload_(p) {
  if (!p.eventName) return "eventName is required";
  if (!/^\d{8}$/.test(p.dateKey)) return "dateKey must be YYYYMMDD";
  if (!/^\d{2}:\d{2}$/.test(p.startTime)) return "startTime must be HH:mm";
  if (!["morning", "afternoon", "evening"].includes(p.period)) return "period is invalid";
  if (!["A", "B", "AB"].includes(p.cohort)) return "cohort must be A/B/AB";
  if (!(p.lineIndex === 0 || p.lineIndex === 1)) return "lineIndex must be 0 or 1";
  return "";
}

function postJson_(url, payload, headers) {
  try {
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      headers: headers || {},
    };
    const response = UrlFetchApp.fetch(url, options);
    const status = response.getResponseCode();
    const text = response.getContentText();
    let body = {};
    try {
      body = JSON.parse(text);
    } catch (_e) {
      body = { raw: text };
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      body,
      message: body.message || body.error || "",
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      body: {},
      message: String(e),
    };
  }
}

function getOrCreateSheet_(ss, name) {
  const s = ss.getSheetByName(name);
  return s || ss.insertSheet(name);
}

function showAlert_(message) {
  try {
    SpreadsheetApp.getUi().alert(String(message));
  } catch (_e) {
    // time-based trigger など UI コンテキストがない実行ではログ出力のみ
    Logger.log(String(message));
  }
}
