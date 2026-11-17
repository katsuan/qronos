// くろのす：URL の受け渡し（?date=・?z= の短い形・ボードの e=・共有リンク・すくすくへのリンク）。受けとる中身は形と長さを決めて読む
// 部品は index.html・create.html で js/count.js → js/link.js → js/card.js → js/calendar.js の順に読み、window.Countdown にまとめる
// 読まれるところ：index.html・create.html（js/count.js のあと）
(function (C) {
  "use strict";
  const { COLORS, DAY, TYPES, defaultTitle, pad, parseDate } = C;
  const N = window.QronosNames;

  // URL で受けとる文字の長さ（作る画面の上限より少し長め。古いリンクも読めるように）
  const LIMITS = { title: 60, emoji: 16, from: 40, msg: 300, name: 40, link: 1500, linkLabel: 20 };
  const Z_MAX = 6000; // ?z= の長さの上限（12件まで入れても 2000 字ほど）
  // 文字の前後の空白を消し、max 文字まで（絵文字を半分に切らない）
  const cut = (text, max) => Array.from(String(text || "").trim()).slice(0, max).join("");
  // ほかのページへのリンク（大会の見る人用リンクなど）。https で、長すぎないものだけ。ちがえば ""
  const linkIn = (text) => {
    const v = String(text || "").trim();
    if (!v || v.length > LIMITS.link) return "";
    try {
      return new URL(v).protocol === "https:" ? v : "";
    } catch (_) {
      return "";
    }
  };

  /** URL のパラメータを読む。日付がなければ null */
  function readParams(search) {
    const q = new URLSearchParams(expandSearch(search));
    const parsed = parseDate(q.get("date"));
    if (!parsed) return null;
    let type = q.get("type");
    if (!TYPES[type]) type = parsed.date > new Date() ? "until" : "since";
    if (parsed.noYear) type = "yearly";
    const color = COLORS.find((c) => c.key === q.get("color"))?.hex
      || (/^#?[0-9a-f]{6}$/i.test(q.get("color") || "") ? `#${q.get("color").replace("#", "")}` : COLORS[0].hex);
    return {
      type,
      date: parsed.date,
      hasTime: parsed.hasTime,
      noYear: parsed.noYear,
      dateText: q.get("date"),
      title: cut(q.get("title"), LIMITS.title) || defaultTitle(type),
      note: cut(q.get("note"), NOTE_MAX),
      emoji: cut(q.get("emoji"), LIMITS.emoji) || TYPES[type].emoji,
      color,
      colorParam: q.get("color") || "",
      from: cut(q.get("from"), LIMITS.from),
      msg: cut(q.get("msg"), LIMITS.msg),
      link: linkIn(q.get("link")),
      linkLabel: cut(q.get("linkLabel"), LIMITS.linkLabel)
    };
  }

  /** 共有用の URL（入力したものだけをパラメータにする） */
  // 共有用の URL は短い形（?z=）で作る。読むときは expandSearch で元の形に戻す
  function buildShareUrl(base, values) {
    return `${base}?z=${packZ({ name: "", from: values.from, msg: values.msg, link: values.link, linkLabel: values.linkLabel, entries: [values] })}`;
  }
  // ---- ボード（いくつかの日をまとめて表示） ----
  // ?name=ボードの名前&e=種類~日付~名前~絵文字~色&e=…（from・msg はボード全体に1つ）
  const SEP = "~";
  const MAX_ENTRIES = 12;
  const ENTRY_KEYS = ["type", "date", "title", "emoji", "color", "note"];
  // 日ごとのひとこと。ボードの行で、名前と日数の下に1行で収まる長さ（幅 320px のスマホで全角16文字ほど）
  const NOTE_MAX = 15;

  // 1件をボードの e= の形（~ でつなぐ）にする
  function encodeEntry(values) {
    return ENTRY_KEYS.map((key) => String(values[key] ?? "").replaceAll(SEP, "").trim()).join(SEP);
  }

  // 1件分を単体のページのパラメータに直す（readParams にそのまま渡せる）
  function entrySearch(text) {
    const q = new URLSearchParams();
    String(text).split(SEP).forEach((value, i) => {
      if (ENTRY_KEYS[i] && value) q.set(ENTRY_KEYS[i], value);
    });
    return `?${q}`;
  }

  /** ボードを読む。e が2つ以上あるときだけボード（1つなら単体のページとして扱う） */
  function readBoard(search) {
    const q = new URLSearchParams(expandSearch(search));
    const entries = q.getAll("e").slice(0, MAX_ENTRIES)
      .map((text) => ({ search: entrySearch(text), p: readParams(entrySearch(text)) }))
      .filter((entry) => entry.p);
    if (entries.length < 2) return null;
    return {
      name: cut(q.get("name"), LIMITS.name) || "記念日ボード",
      from: cut(q.get("from"), LIMITS.from),
      msg: cut(q.get("msg"), LIMITS.msg),
      link: linkIn(q.get("link")),
      linkLabel: cut(q.get("linkLabel"), LIMITS.linkLabel),
      entries
    };
  }

  // ボードのページのリンク（?z= の短い形）
  function buildBoardUrl(base, board) {
    return `${base}?z=${packZ(board)}`;
  }

  // ---- 短い URL（?z=） ----
  // 日本語は URL に入れると1文字9文字（%E3%81%8A…）になるので、中身をまとめて UTF-8 → base64url にする（1文字およそ4文字）。
  // 中身：[ボードの名前, 送る人, ひとこと, リンク, リンクの名前] と、1件ごとの [種類, 日付, 名前, 絵文字, 色]。
  //   区切りは 項目＝\x1f・行＝\x1e。種類は u/y/s、色は 0〜4（むらさきは空）、日付は数字だけ（20261224・202612241900・1103）。
  //   絵文字は種類の決まりの絵文字なら空。後ろの空の項目は省く
  // 1件ならその日のページ、2件以上ならボード。z がないときは今までのパラメータ（type・date…／e=…）をそのまま読む
  const TYPE_CODES = { until: "u", yearly: "y", since: "s" };
  const FS = "\x1f";
  const RS = "\x1e";

  // 項目を \x1f でつなぐ（後ろの空の項目は省く）
  const trimEnd = (fields) => {
    const out = fields.map((v) => String(v ?? "").replaceAll(FS, " ").replaceAll(RS, " ").trim());
    while (out.length && !out[out.length - 1]) out.pop();
    return out.join(FS);
  };

  // 日付を数字だけにする（2026-12-24T19:00 → 202612241900）
  function packDate(text) {
    return String(text || "").replace(/[-T:]/g, "");
  }

  // packDate の逆
  function unpackDate(text) {
    const d = String(text || "");
    if (d.length === 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
    const ymd = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    return d.length === 12 ? `${ymd}T${d.slice(8, 10)}:${d.slice(10, 12)}` : ymd;
  }

  // ボード（または1件）を ?z= の短い形の文字にする
  function packZ({ name, from, msg, link, linkLabel, entries }) {
    const rows = [trimEnd([name, from, msg, link, linkLabel])];
    for (const e of entries) {
      const type = TYPES[e.type] ? e.type : "";
      const colorIndex = COLORS.findIndex((c) => c.key === e.color);
      rows.push(trimEnd([
        TYPE_CODES[type] || "",
        packDate(e.date),
        e.title,
        type && e.emoji === TYPES[type].emoji ? "" : e.emoji,
        colorIndex > 0 ? String(colorIndex) : colorIndex === 0 ? "" : e.color,
        e.note
      ]));
    }
    const bytes = new TextEncoder().encode(rows.join(RS));
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // ?z= の文字を中身に戻す（読めないときは null）
  function unpackZ(z) {
    if (typeof z !== "string" || z.length > Z_MAX || !/^[A-Za-z0-9_-]+$/.test(z)) return null;
    try {
      const binary = atob(String(z).replace(/-/g, "+").replace(/_/g, "/"));
      const text = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
      const [head, ...rows] = text.split(RS);
      const [name = "", from = "", msg = "", link = "", linkLabel = ""] = head.split(FS);
      const typeOf = Object.fromEntries(Object.entries(TYPE_CODES).map(([k, v]) => [v, k]));
      const entries = rows.slice(0, MAX_ENTRIES).map((row) => {
        const [t = "", d = "", title = "", emoji = "", c = "", note = ""] = row.split(FS);
        return {
          type: typeOf[t] || "",
          date: unpackDate(d),
          title,
          emoji,
          color: /^\d$/.test(c) ? COLORS[+c]?.key || "" : c || COLORS[0].key,
          note
        };
      });
      return { name, from, msg, link, linkLabel, entries };
    } catch {
      return null;
    }
  }

  /** ?z= を今までのパラメータの形に戻す（1件なら type・date…、2件以上なら name・e=…）。z がなければそのまま */
  function expandSearch(search) {
    const q = new URLSearchParams(search);
    const z = q.get("z");
    if (!z) return q.toString();
    const data = unpackZ(z);
    if (!data || !data.entries.length) return "";
    const out = new URLSearchParams();
    if (data.entries.length === 1) {
      for (const [key, value] of Object.entries(data.entries[0])) if (value) out.set(key, value);
    } else {
      if (data.name) out.set("name", data.name);
      for (const entry of data.entries) out.append("e", encodeEntry(entry));
    }
    if (data.from) out.set("from", data.from);
    if (data.msg) out.set("msg", data.msg);
    if (data.link) out.set("link", data.link);
    if (data.linkLabel) out.set("linkLabel", data.linkLabel);
    return out.toString();
  }

  /** 今のページの URL を短い形に直す（古い長いリンクで開いたときも、共有するのは短い形） */
  function shortUrl(href) {
    const url = new URL(href);
    const base = `${url.origin}${url.pathname}`;
    const q = new URLSearchParams(expandSearch(url.search));
    const from = q.get("from") || "";
    const msg = q.get("msg") || "";
    const link = q.get("link") || "";
    const linkLabel = q.get("linkLabel") || "";
    if (q.getAll("e").length >= 2) {
      const entries = q.getAll("e").map((text) => Object.fromEntries(new URLSearchParams(entrySearch(text))));
      return buildBoardUrl(base, { name: q.get("name") || "", from, msg, link, linkLabel, entries });
    }
    return q.get("date") ? buildShareUrl(base, Object.fromEntries(q)) : href;
  }

  // ---- すくすく（SuQSuQ）へのリンク ----
  // 日付を渡して、すくすくで写真・動画に入れる。リンクの形（?birth=・?due=・?since=&title=・&name=）はすくすくと同じ
  //   赤ちゃん・子どもの生まれた日（7年以内）→「生まれて◯日」（birth）、出産予定日 →「妊娠◯週」（due）
  //   そのほかのはじまりの日（付き合った日・結婚記念日など）→「◯◯から◯日目」（since）
  //   すくすくから作ったページ（「はるとの誕生日」「ひなに会える日」など）なら、名前も返す
  const SUQSUQ_URL = "https://katsuan.github.io/suqsuq/";
  const KID_TITLE = /^(.{1,16}?)(?:の(?:誕生日|生後\d+か月|生まれて\d+日|お七夜|お食い初め|お宮参りのころ|ハーフバースデー|\d+さいの誕生日)|に会える日)$/u;
  const BABY_WORDS = /出産|予定日|赤ちゃん|ベビー|誕生|生まれ|お食い初め|お七夜|ハーフバースデー|👶|🍼|🤰/;
  // 「その日まで」が出産予定日のときだけ「妊娠◯週」にする（すくすくの節目「3さいの誕生日まで」などは、生まれた日がわからないので出さない）
  const DUE_WORDS = /出産|予定日|に会える日|🤰/;
  const SUQSUQ_SUBS = {
    birth: `生まれて◯日目を写真・動画に（${N.suqsuq}）`,
    due: `「妊娠◯週」を写真・動画に（${N.suqsuq}）`,
    since: `この日から◯日目を写真・動画に（${N.suqsuq}）`
  };

  /** すくすくへのリンク { kind, url, sub }。出さないときは null */
  function suqsuqLink(p, now = new Date()) {
    const day = `${p.date.getFullYear()}-${pad(p.date.getMonth() + 1)}-${pad(p.date.getDate())}`;
    const past = !p.noYear && p.date <= now;
    const kid = (p.title || "").match(KID_TITLE);
    const baby = Boolean(kid) || BABY_WORDS.test(`${p.title} ${p.emoji}`);
    const young = past && now - p.date < 7 * 365.25 * DAY;
    const startDay = p.type === "since" || p.type === "yearly";
    let kind = null;
    if (baby && young && startDay) kind = "birth";
    else if (past && startDay) kind = "since";
    else if (!past && p.type === "until" && DUE_WORDS.test(`${p.title} ${p.emoji}`)) kind = "due";
    if (!kind) return null;
    const q = new URLSearchParams({ [kind]: day });
    // 名前は16文字まで（絵文字を半分に切らないよう、文字で数える）
    if (kind === "since") q.set("title", cut(p.title, 16));
    else if (kid && kid[1] !== "赤ちゃん") q.set("name", kid[1]);
    return { kind, url: `${SUQSUQ_URL}?${q}`, sub: SUQSUQ_SUBS[kind] };
  }

  // ほかのファイル・画面から使うもの
  Object.assign(C, { MAX_ENTRIES, NOTE_MAX, buildBoardUrl, buildShareUrl, expandSearch, readBoard, readParams, shortUrl, suqsuqLink });
})((window.Countdown = window.Countdown || {}));
