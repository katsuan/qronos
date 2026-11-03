// くろのす：日付を読む・いまの時刻での「あと何日・何日目」を数える・ボードの並べ方（画面には触らない）
// 部品は index.html・create.html で js/count.js → js/link.js → js/card.js → js/calendar.js の順に読み、window.Countdown にまとめる
// 読まれるところ：index.html・create.html（js/ の部品のいちばん先）
(function (C) {
  "use strict";

  // おくるん（お知らせカード）。パラメータを渡すと、その内容のカードを LINE で送れる
  const LINE_URI_MAX = 1000; // LINE のリンクの長さの上限

  // 種類。until＝その日まで / yearly＝毎年の記念日 / since＝その日から
  const TYPES = {
    until: { label: "その日まで", emoji: "⏳", hint: "旅行・イベント・締め切りなど" },
    yearly: { label: "毎年の記念日", emoji: "🎂", hint: "誕生日・結婚記念日など" },
    since: { label: "その日から", emoji: "💞", hint: "付き合った日・禁煙・入社など" }
  };

  // 色（おくるんと同じ並び。先頭はおくるんの紫）
  const COLORS = [
    { key: "purple", label: "むらさき", hex: "#6c47ff" },
    { key: "sky", label: "そら", hex: "#2f8fe0" },
    { key: "leaf", label: "みどり", hex: "#22a86a" },
    { key: "sunset", label: "ゆうやけ", hex: "#f2711c" },
    { key: "berry", label: "ベリー", hex: "#e0457b" }
  ];

  // お祝いの日（SQriptable の cd と同じ決まり）
  //   その日から … ○周年、その前の日の「○年（365日目）」（暦で数えるので、うるう年をまたぐと366日目）、
  //                 節目の日数（MILESTONE_DAYS）、キリのいい日（KIRI_STEP の倍数）
  //   その日まで・毎年の記念日 … 「あと100日」のようなキリのいい日
  const MILESTONE_DAYS = [100, 200, 300, 500, 700, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7000, 10000];
  const KIRI_STEP = 100;

  const DAY = 864e5;
  const WEEK = "日月火水木金土";
  // 2けたにそろえる（9 → "09"）
  const pad = (n) => String(n).padStart(2, "0");

  // "2026-12-24" または "2026-12-24T19:00" を端末の時刻として読む。
  // 毎年の記念日は "11-03" のように年なしでもよい（年齢や「○回目」を出したくないとき。noYear）
  function parseDate(value) {
    const text = String(value || "").trim();
    const md = /^(\d{2})-(\d{2})$/.exec(text);
    if (md) {
      // 2月29日も入れられるよう、うるう年（2000年）の日付として持つ
      const date = new Date(2000, +md[1] - 1, +md[2]);
      if (date.getMonth() !== +md[1] - 1) return null;
      return { date, hasTime: false, noYear: true };
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(text);
    if (!m) return null;
    const date = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    if (date.getMonth() !== +m[2] - 1) return null; // 2月30日など
    return { date, hasTime: m[4] != null, noYear: false };
  }

  // ボードの行は幅が狭いので「2015/6/20(土)」の短い形にする
  const shortDate = (d, hasTime) =>
    `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${WEEK[d.getDay()]})${hasTime ? ` ${d.getHours()}:${pad(d.getMinutes())}` : ""}`;
  // 「11月3日」の形
  const monthDay = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
  // その日の 0 時
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // a から b まで何日か（日付だけで数える）
  const dayDiff = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

  // 「2026年12月24日(木)」の形（hasTime なら時刻も）
  function fmtDate(d, hasTime) {
    const text = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEK[d.getDay()]})`;
    return hasTime ? `${text} ${d.getHours()}:${pad(d.getMinutes())}` : text;
  }

  // その年の記念日（2月29日は、うるう年でない年は2月28日）
  function inYear(base, year) {
    const last = new Date(year, base.getMonth() + 1, 0).getDate();
    return new Date(year, base.getMonth(), Math.min(base.getDate(), last), base.getHours(), base.getMinutes());
  }

  // n か月あとの日（31日の「1か月」は、その月の終わりの日。inYear と同じ考え方）
  function addMonths(d, n) {
    const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
    return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
  }

  // ○年○か月○日（start から end まで）。いちばん近い「○か月の日」から何日たったか
  function ymd(start, end) {
    const s = startOfDay(start), e = startOfDay(end);
    let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    if (addMonths(s, months) > e) months -= 1;
    const y = Math.floor(months / 12), m = months % 12, d = dayDiff(addMonths(s, months), e);
    return [y && `${y}年`, m && `${m}か月`, d && `${d}日`].filter(Boolean).join("") || "0日";
  }

  // start から n 日目（start が1日目）の日
  const nthDate = (start, n) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + n - 1);

  // n 日目が、ちょうど何年たった日か（その次の日が○周年なら○年）。ちがえば 0
  function yearsAt(start, n) {
    const next = nthDate(start, n + 1);
    const years = next.getFullYear() - start.getFullYear();
    return years > 0 && dayDiff(next, inYear(start, next.getFullYear())) === 0 ? years : 0;
  }

  // 「○日目」の言い方。ちょうど○年たった日は「1年（365日目）」
  function dayLabel(start, n) {
    const years = yearsAt(start, n);
    return years ? `${years}年（${n.toLocaleString()}日目）` : `${n.toLocaleString()}日目`;
  }

  // n 日目がお祝いの日数か（○周年は日数では決まらないので別）
  const isMarkDay = (start, n) => MILESTONE_DAYS.includes(n) || n % KIRI_STEP === 0 || yearsAt(start, n) > 0;

  // n 日目（たった日数）が、日数で決まるお祝いの日（節目・キリのいい日）か
  const isCountDay = (n) => n > 1 && (MILESTONE_DAYS.includes(n) || n % KIRI_STEP === 0);

  // 「あと n 日」がキリのいい日か
  const isKiriLeft = (n) => n > 0 && n % KIRI_STEP === 0;

  // 名前を入れなかったときの名前
  function defaultTitle(type) {
    return { until: "その日", yearly: "記念日", since: "はじまりの日" }[type];
  }

  /**
   * いまの時刻での表示内容。
   * target … 数える先の日時（その日まで・毎年の記念日）
   * days / unit … 大きく出す数字とその前後の言葉
   */
  function compute(p, now = new Date()) {
    if (p.type === "until") {
      const isToday = dayDiff(now, p.date) === 0;
      const passed = p.date <= now;
      if (passed && !isToday) {
        const days = dayDiff(p.date, now);
        // 過ぎたあとのカウントアップも、100日たった日などはお祝い
        const party = isCountDay(days) ? `${days.toLocaleString()}日たちました` : "";
        return { lead: `${p.title}から`, days, unit: "日たちました", target: null, celebrate: !!party, party, sub: fmtDate(p.date, p.hasTime) };
      }
      if (passed || (isToday && !p.hasTime)) {
        return { lead: "", days: null, today: `今日は ${p.title}！`, target: null, celebrate: true, sub: fmtDate(p.date, p.hasTime) };
      }
      // 当日で時刻がまだのときは「あと0日」ではなく、時・分・秒だけで数える
      if (isToday) return { lead: "", days: null, today: `今日は ${p.title}！`, target: p.date, celebrate: false, sub: fmtDate(p.date, p.hasTime) };
      const left = dayDiff(now, p.date);
      return { lead: `${p.title}まで`, prefix: "あと", days: left, unit: "日", target: p.date, celebrate: isKiriLeft(left), party: isKiriLeft(left) ? `ちょうど あと${left.toLocaleString()}日` : "", sub: fmtDate(p.date, p.hasTime) };
    }

    if (p.type === "yearly") {
      const year = now.getFullYear();
      let next = inYear(p.date, year);
      const today = dayDiff(now, next) === 0;
      if (!today && next < now) next = inYear(p.date, year + 1);
      // 年なしのときは「○回目」「○日目」を出さない
      const count = p.noYear ? 0 : next.getFullYear() - p.date.getFullYear();
      const nth = count > 0 ? `${count}回目の` : "";
      const since = !p.noYear && p.date <= now ? `${fmtDate(p.date)}から ${dayDiff(p.date, now) + 1}日目` : "";
      if (today) {
        return { lead: "", days: null, today: `今日は ${nth}${p.title}！`, target: null, celebrate: true, sub: since, nth: count };
      }
      const left = dayDiff(now, next);
      // 年を書いた記念日は、はじまりの日から数えた日（生まれて10000日目など）もお祝い
      const nthDay = !p.noYear && p.date <= now ? dayDiff(p.date, now) + 1 : 0;
      const party = isCountDay(nthDay) ? `今日で ${nthDay.toLocaleString()}日目` : isKiriLeft(left) ? `ちょうど あと${left.toLocaleString()}日` : "";
      return {
        lead: `${nth}${p.title}まで`,
        prefix: "あと",
        days: left,
        unit: "日",
        target: next,
        celebrate: !!party,
        party,
        sub: `${fmtDate(next)}${since ? `\n${since}` : ""}`,
        nth: count
      };
    }

    // since：はじまりの日を1日目として数える
    if (p.date > now) {
      return { lead: `${p.title}まで`, prefix: "あと", days: dayDiff(now, p.date), unit: "日", target: p.date, celebrate: false, sub: fmtDate(p.date, p.hasTime) };
    }
    const nthDay = dayDiff(p.date, now) + 1;
    const milestone = nextMilestone(p.date, now);
    const years = now.getFullYear() - p.date.getFullYear();
    const party = isMarkDay(p.date, nthDay) ? dayLabel(p.date, nthDay) : years > 0 && dayDiff(inYear(p.date, now.getFullYear()), now) === 0 ? `${years}周年` : "";
    return {
      lead: `${p.title}から`,
      prefix: "今日で",
      days: nthDay,
      unit: "日目",
      target: null,
      celebrate: !!party,
      party,
      sub: `${fmtDate(p.date, false)}から ${ymd(p.date, now)}`,
      milestone
    };
  }

  // 次の「○日目」のお祝いの日（節目・キリのいい日・○年）。{ n, label, date }
  function nextDayMark(start, now) {
    const nthDay = dayDiff(start, now) + 1;
    const ns = [...MILESTONE_DAYS.filter((n) => n > nthDay), (Math.floor(nthDay / KIRI_STEP) + 1) * KIRI_STEP];
    let year = now.getFullYear();
    while (dayDiff(now, inYear(start, year)) <= 1) year++;
    ns.push(dayDiff(start, inYear(start, year)));
    const n = Math.min(...ns);
    return { n, label: dayLabel(start, n), date: nthDate(start, n) };
  }

  // 次のお祝いの日（○日目・○年・○周年のうち近いほう）
  function nextMilestone(start, now) {
    const candidates = [nextDayMark(start, now)];
    let year = now.getFullYear();
    let anniv = inYear(start, year);
    if (dayDiff(now, anniv) <= 0) anniv = inYear(start, ++year);
    candidates.push({ label: `${year - start.getFullYear()}周年`, date: anniv });
    candidates.sort((a, b) => a.date - b.date);
    const pick = candidates[0];
    return { label: pick.label, date: pick.date, daysLeft: dayDiff(now, pick.date), dateText: fmtDate(pick.date) };
  }

  // 残りを 日・時間・分・秒 に分ける
  function parts(target, now = Date.now()) {
    let ms = Math.max(0, target - now);
    const d = Math.floor(ms / DAY);
    ms -= d * DAY;
    const h = Math.floor(ms / 36e5);
    ms -= h * 36e5;
    const m = Math.floor(ms / 6e4);
    ms -= m * 6e4;
    return { d, h, m, s: Math.floor(ms / 1e3), done: target - now <= 0 };
  }

  /** ボードの1行分。近い順に並べるための sortKey（ミリ秒）と、右に大きく出す数字 */
  function rowView(p, now = new Date()) {
    const v = compute(p, now);
    let count;
    let sortKey;
    if (v.today) {
      count = "今日！";
      sortKey = 0;
    } else if (v.prefix === "あと") {
      // 年を書いた記念日が、はじまりから数えたお祝いの日（12,000日目など）なら、その日数を出す
      count = /^今日で /.test(v.party || "") ? v.party.slice(4) : `あと${v.days.toLocaleString()}日`;
      // キリのいい日（あと100日など）は、今日のもののすぐ後ろに
      sortKey = v.celebrate ? 1 : v.target - now;
    } else if (p.type === "since") {
      count = `${v.days.toLocaleString()}日目`;
      // お祝いの日は今日のもののすぐ後ろに。ふだんは次のお祝いの日が近いものほど上に
      sortKey = v.celebrate ? 1 : v.milestone ? v.milestone.date - now : Infinity;
    } else {
      count = `${v.days.toLocaleString()}日前`;
      sortKey = v.celebrate ? 1 : Infinity;
    }
    const sub = p.type === "yearly"
      ? `毎年 ${monthDay(p.date)}${v.nth > 0 ? `・${v.nth}回目` : ""}`
      : p.type === "since" && p.date <= now
        ? `${shortDate(p.date)}から`
        : shortDate(p.date, p.hasTime);
    return { v, count, sortKey, sub, celebrate: v.celebrate };
  }

  // ボードの行を、近い順（今日・あと何日の少ないもの・次の節目が近いもの）に並べて返す
  function sortedRows(board, now = new Date()) {
    return board.entries
      .map((entry) => ({ ...entry, ...rowView(entry.p, now) }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }

  // ほかのファイル・画面から使うもの
  Object.assign(C, { COLORS, DAY, KIRI_STEP, LINE_URI_MAX, MILESTONE_DAYS, TYPES, compute, dayLabel, nextDayMark, dayDiff, defaultTitle, fmtDate, inYear, monthDay, pad, parseDate, parts, sortedRows });
})((window.Countdown = window.Countdown || {}));
