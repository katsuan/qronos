// くろのす：Google カレンダーのリンクと、カレンダーのファイル（.ics）
// 部品は index.html・create.html で js/count.js → js/link.js → js/card.js → js/calendar.js の順に読み、window.Countdown にまとめる
// 読まれるところ：index.html・create.html（js/card.js のあと）
(function (C) {
  "use strict";
  const { dayDiff, inYear, nextDayMark, pad } = C;

  // ---- Google カレンダーに追加 ----
  const ymdText = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  // 日時を Google カレンダーの形（YYYYMMDDTHHmm00）にする
  const timeText = (d) => `${ymdText(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

  /** Google カレンダーの予定作成画面のリンク。時刻なしは終日、時刻ありは1時間。yearly で毎年くり返す */
  function calendarUrl({ title, date, hasTime = false, yearly = false, details = "" }) {
    const end = hasTime ? new Date(date.getTime() + 36e5) : new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const q = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: hasTime ? `${timeText(date)}/${timeText(end)}` : `${ymdText(date)}/${ymdText(end)}`,
      details
    });
    if (hasTime) q.set("ctz", Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo");
    if (yearly) q.set("recur", "RRULE:FREQ=YEARLY");
    return `https://calendar.google.com/calendar/render?${q}`;
  }

  /**
   * カレンダーのファイル（.ics）。スマホの Google カレンダーのアプリで開くと、リンクの「毎年くり返し」（recur）が
   * 外れて1回だけの予定になることがあるので、くり返しを確実に入れたいときはこちら（iPhone・Android のカレンダーで開ける）
   */
  function icsText({ title, date, hasTime = false, yearly = false, details = "" }) {
    // カレンダーのファイルに入れる文字（\ ; , と改行を書きかえる）
    const esc = (t) => String(t).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n|\r/g, "\\n");
    const end = hasTime ? new Date(date.getTime() + 36e5) : new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//katsuan//countdown//JA",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@katsuan.github.io`,
      `DTSTAMP:${stamp}`,
      hasTime ? `DTSTART:${timeText(date)}` : `DTSTART;VALUE=DATE:${ymdText(date)}`,
      hasTime ? `DTEND:${timeText(end)}` : `DTEND;VALUE=DATE:${ymdText(end)}`,
      ...(yearly ? ["RRULE:FREQ=YEARLY"] : []),
      `SUMMARY:${esc(title)}`,
      ...(details ? [`DESCRIPTION:${esc(details)}`] : []),
      "END:VEVENT",
      "END:VCALENDAR",
      ""
    ].join("\r\n");
  }

  /**
   * その日の種類に合わせたカレンダーのボタン（該当日・次の記念日への導線）。
   * label はボタンの1行目（短く）、sub は2行目（日付など）。スマホの幅で変なところで折り返さないように分ける
   *   その日まで … その日（時刻があればその時刻）
   *   毎年の記念日 … 次の日を毎年くり返す予定で
   *   その日から … 次のお祝いの日（100日目・1年など）と、毎年の○周年
   */
  function calendarLinks(p, pageUrl, now = new Date()) {
    // event はカレンダーのファイル（icsText）用に同じ中身を持っておく
    const ev = (spec) => ({ url: calendarUrl(spec), event: spec });
    const details = [p.note, pageUrl].filter(Boolean).join("\n");
    // ボタンに出す短い日付（「12/24」）
    const label = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    if (p.type === "yearly") {
      let next = inYear(p.date, now.getFullYear());
      if (dayDiff(now, next) < 0) next = inYear(p.date, now.getFullYear() + 1);
      return [{ label: "🗓️ 毎年の予定として追加", sub: `次は ${label(next)}・Googleカレンダー`, ...ev({ title: `${p.emoji} ${p.title}`, date: next, yearly: true, details }) }];
    }
    if (p.type === "since" && p.date <= now) {
      const links = [];
      // 次の「○日目」のお祝いの日（周年のほうが近くても出す）
      const mark = nextDayMark(p.date, now);
      links.push({ label: `🗓️ ${mark.label}を追加`, sub: `${mark.date.getFullYear()}/${label(mark.date)}・Googleカレンダー`, ...ev({ title: `${p.emoji} ${p.title}から${mark.label}`, date: mark.date, details }) });
      let anniv = inYear(p.date, now.getFullYear());
      if (dayDiff(now, anniv) <= 0) anniv = inYear(p.date, now.getFullYear() + 1);
      links.push({ label: "🗓️ 毎年の記念日を追加", sub: `次は ${label(anniv)}・Googleカレンダー`, ...ev({ title: `${p.emoji} ${p.title}の記念日`, date: anniv, yearly: true, details }) });
      return links;
    }
    if (dayDiff(now, p.date) < 0) return [];
    const when = `${p.date.getFullYear()}/${label(p.date)}${p.hasTime ? ` ${p.date.getHours()}:${pad(p.date.getMinutes())}` : ""}`;
    return [{ label: "🗓️ カレンダーに追加", sub: `${when}・Googleカレンダー`, ...ev({ title: `${p.emoji} ${p.title}`, date: p.date, hasTime: p.hasTime, details }) }];
  }

  // ほかのファイル・画面から使うもの
  Object.assign(C, { calendarLinks, icsText });
})((window.Countdown = window.Countdown || {}));
