// くろのす：URL の中身（?date=・?z=・e=）を読む・カレンダーのファイルのテスト（画面に触らない部分）
//   node --test test/
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const XSS = "<img src=x onerror=alert(1)>"; // qcheck-ok: W8 外からの文字の見本
const ctx = { window: {}, URLSearchParams, URL, TextEncoder, TextDecoder, atob, btoa, Intl, console };
vm.createContext(ctx);
for (const f of ["count", "link", "card", "calendar"]) vm.runInContext(fs.readFileSync(path.join(__dirname, `../js/${f}.js`), "utf8"), ctx);
const C = ctx.window.Countdown;
const b64 = (text) => Buffer.from(text, "utf8").toString("base64url");

test("ふつうのリンクを読む", () => {
  const p = C.readParams("?type=until&date=2030-12-24&title=" + encodeURIComponent("沖縄旅行") + "&color=sky");
  assert.equal(p.type, "until");
  assert.equal(p.title, "沖縄旅行");
  assert.equal(p.color, "#2f8fe0");
});

test("日付がない・壊れた日付は読まない", () => {
  assert.equal(C.readParams(""), null);
  assert.equal(C.readParams("?date=" + encodeURIComponent(XSS)), null);
  assert.equal(C.readParams("?date=2030-02-30"), null);
});

test("名前などの HTML は、文字のまま残る（画面は textContent で出す）。長さには上限", () => {
  const long = "あ".repeat(1000);
  const p = C.readParams(`?date=2030-01-01&title=${encodeURIComponent(XSS)}&emoji=${encodeURIComponent(long)}&msg=${encodeURIComponent(long)}&from=${encodeURIComponent(long)}&note=${encodeURIComponent(long)}`);
  assert.equal(p.title, XSS);
  assert.equal(Array.from(p.emoji).length, 16);
  assert.equal(p.msg.length, 300);
  assert.equal(p.from.length, 40);
  assert.equal(p.note.length, 15);
});

test("色は決まった色か #rrggbb だけ（CSS に入るので）", () => {
  assert.equal(C.readParams("?date=2030-01-01&color=" + encodeURIComponent("red;background:url(x)")).color, "#6c47ff");
  assert.equal(C.readParams("?date=2030-01-01&color=ff0000").color, "#ff0000");
});

test("短い形（?z=）：作って読むと同じ中身。ボードは2件から", () => {
  const board = { name: "わが家", from: "", msg: "", entries: [
    { type: "yearly", date: "2015-06-20", title: "結婚記念日", emoji: "💍", color: "berry", note: "" },
    { type: "until", date: "2030-12-24T19:00", title: XSS, emoji: "", color: "purple", note: "" }
  ] };
  const url = C.buildBoardUrl("https://katsuan.github.io/countdown/", board);
  const read = C.readBoard(new URL(url).search);
  assert.equal(read.name, "わが家");
  assert.equal(read.entries.length, 2);
  assert.ok(read.entries.some((e) => e.p.title === XSS));
});

test("壊れた ?z=（base64 でない・長すぎる・中身がちがう）でも落ちない", () => {
  for (const z of ["%%%", "!!!", "a", "a".repeat(7000), b64("\x1e\x1e\x1e"), b64("\x1f".repeat(100)), b64(XSS)]) {
    assert.doesNotThrow(() => C.expandSearch("?z=" + encodeURIComponent(z)));
    assert.equal(C.readParams("?z=" + encodeURIComponent(z)), null, z.slice(0, 10));
    assert.equal(C.readBoard("?z=" + encodeURIComponent(z)), null);
  }
});

test("ボードの件数は 12 件まで", () => {
  const rows = Array.from({ length: 50 }, (_, i) => `u\x1f2030010${(i % 9) + 1}\x1fn${i}`);
  const board = C.readBoard("?z=" + b64(["名前", ...rows].join("\x1e")));
  assert.equal(board.entries.length, 12);
});

test("カレンダーのファイル：名前に改行やカンマが入っても行が崩れない", () => {
  const ics = C.icsText({ title: "a\r\nATTACH:x,;", date: new Date(2030, 0, 1), details: "b\rc" });
  const lines = ics.split("\r\n");
  assert.ok(lines.every((l) => !l.startsWith("ATTACH")));
  assert.ok(lines.includes(String.raw`SUMMARY:a\nATTACH:x\,\;`));
  assert.ok(lines.includes("DESCRIPTION:b\\nc"));
});

test("「その日から」の◯か月◯日：月の終わり・うるう日でもマイナスにならない", () => {
  const p = C.readParams("?type=since&date=2026-01-31&title=a");
  const span = (y, m, d) => C.compute(p, new Date(y, m - 1, d, 12)).sub.split(" ").pop();
  assert.equal(span(2026, 2, 27), "27日");
  assert.equal(span(2026, 2, 28), "1か月");
  assert.equal(span(2026, 3, 1), "1か月1日");
  assert.equal(span(2027, 1, 31), "1年");
  const leap = C.readParams("?type=since&date=2024-02-29&title=a");
  assert.equal(C.compute(leap, new Date(2025, 1, 28, 12)).sub.split(" ").pop(), "1年");
  assert.equal(C.compute(leap, new Date(2025, 2, 1, 12)).sub.split(" ").pop(), "1年1日");
});

test("おくるんの部品が読めない（電波なし）ときも、カードの URL で止まらない", () => {
  const p = C.readParams("?type=until&date=2030-12-24&title=a");
  assert.equal(C.buildCardUrl(p, "https://example.com/"), "#");
  const board = C.readBoard("?e=u~2030-12-24~a&e=s~2020-01-01~b");
  assert.equal(C.buildBoardCardUrl(board, "https://example.com/"), "#");
});

test("かぞく（KazoQ）のリンクの形を読む", () => {
  const due = C.readParams("?type=until&date=2027-03-01&title=" + encodeURIComponent("出産予定日") + "&emoji=" + encodeURIComponent("👶") + "&color=sunset");
  assert.equal(due.type, "until");
  assert.equal(due.title, "出産予定日");
  assert.equal(due.color, "#f2711c");
  const bd = C.readParams("?type=yearly&date=2026-07-14&title=" + encodeURIComponent("誕生日") + "&emoji=" + encodeURIComponent("🎂") + "&color=sunset");
  assert.equal(bd.type, "yearly");
  assert.equal(bd.noYear, false);
  assert.equal(C.compute(bd, new Date(2027, 6, 14, 9)).nth, 1);
});

test("すくすくへのリンク：生まれた日・出産予定日・そのほかの記念日（名前も返す）", () => {
  const now = new Date(2026, 9, 24, 12);
  const link = (search) => C.suqsuqLink(C.readParams(search), now);
  assert.equal(link("?type=yearly&date=2026-07-14&title=" + encodeURIComponent("はるとの誕生日")).url, "https://katsuan.github.io/suqsuq/?birth=2026-07-14&name=" + encodeURIComponent("はると"));
  assert.equal(link("?type=until&date=2027-03-01&title=" + encodeURIComponent("ひなに会える日")).url, "https://katsuan.github.io/suqsuq/?due=2027-03-01&name=" + encodeURIComponent("ひな"));
  assert.equal(link("?type=until&date=2027-03-01&title=" + encodeURIComponent("出産予定日")).kind, "due");
  assert.equal(link("?type=until&date=2027-03-01&title=" + encodeURIComponent("赤ちゃんに会える日")).url, "https://katsuan.github.io/suqsuq/?due=2027-03-01");
  const anniv = link("?type=since&date=2020-04-01&title=" + encodeURIComponent("付き合った日"));
  assert.equal(anniv.kind, "since");
  assert.equal(anniv.url, "https://katsuan.github.io/suqsuq/?since=2020-04-01&title=" + encodeURIComponent("付き合った日"));
  // すくすくの節目（生まれた日がわからない「その日まで」）は、出産予定日にしない
  assert.equal(link("?type=until&date=2027-01-02&title=" + encodeURIComponent("ひなの3さいの誕生日") + "&emoji=" + encodeURIComponent("🎉")), null);
  assert.equal(link("?type=until&date=2026-12-01&title=" + encodeURIComponent("はるとの生後6か月")), null);
  assert.equal(link("?type=until&date=2026-12-24&title=" + encodeURIComponent("赤ちゃんとはじめてのクリスマス") + "&emoji=" + encodeURIComponent("👶")), null);
  // 7年より前の「誕生日」は記念日として
  assert.equal(link("?type=yearly&date=2010-05-05&title=" + encodeURIComponent("たろうの誕生日")).kind, "since");
  // 先の日の記念日・年なしは出さない
  assert.equal(link("?type=until&date=2027-03-01&title=" + encodeURIComponent("旅行")), null);
  assert.equal(link("?type=yearly&date=11-03&title=" + encodeURIComponent("記念日")), null);
});

test("すくすくへのリンク：名前が16文字目で絵文字にかかっても止まらない（絵文字を半分に切らない）", () => {
  const now = new Date(2026, 9, 24, 12);
  const title = "あ".repeat(15) + "🎉おめでとう";
  const res = C.suqsuqLink(C.readParams("?type=since&date=2020-04-01&title=" + encodeURIComponent(title)), now);
  assert.equal(new URL(res.url).searchParams.get("title"), "あ".repeat(15) + "🎉");
});

test("リンク（大会の見る人用リンクなど）：https だけ。短い形で残り、名前は20文字まで", () => {
  const link = "https://katsuan.github.io/qumiawase/?view=abc";
  const board = { name: "大会", from: "", msg: "", link, linkLabel: "🏆 大会を見る", entries: [
    { type: "until", date: "2030-12-24T09:00", title: "1試合目", emoji: "⚽", color: "", note: "" },
    { type: "until", date: "2030-12-24T10:00", title: "決勝", emoji: "🏆", color: "", note: "" }
  ] };
  const read = C.readBoard(new URL(C.buildBoardUrl("https://katsuan.github.io/countdown/", board)).search);
  assert.equal(read.link, link);
  assert.equal(read.linkLabel, "🏆 大会を見る");
  const one = C.readParams(new URL(C.buildShareUrl("https://katsuan.github.io/countdown/", { ...board.entries[0], link, linkLabel: "x".repeat(40) })).search);
  assert.equal(one.link, link);
  assert.equal(one.linkLabel.length, 20);
  for (const bad of ["javascript:void(0)", "http://example.com/", "data:text/html,x", "not a url"]) {
    assert.equal(C.readParams("?date=2030-01-01&link=" + encodeURIComponent(bad)).link, "", bad);
  }
  assert.equal(C.shortUrl("https://katsuan.github.io/countdown/?date=2030-01-01&title=a&link=" + encodeURIComponent(link)).includes("?z="), true);
});

test("お祝いの日：キリのいい日・暦で数える○年（うるう年）・○周年（SQriptable の cd と同じ）", () => {
  const since = (date, now) => C.compute({ type: "since", title: "X", date: new Date(date + "T00:00"), hasTime: false }, new Date(now + "T10:00"));
  const until = (date, now) => C.compute({ type: "until", title: "X", date: new Date(date + "T00:00"), hasTime: false }, new Date(now + "T10:00"));
  assert.equal(since("2025-09-30", "2026-11-03").party, "400日目");
  assert.equal(since("2025-11-04", "2026-11-03").party, "1年（365日目）");
  // うるう年をまたぐと 365日目はふつうの日、366日目が1年
  assert.equal(since("2023-11-04", "2024-11-02").party, "");
  assert.equal(since("2023-11-04", "2024-11-03").party, "1年（366日目）");
  assert.equal(since("2023-11-04", "2024-11-02").milestone.label, "1年（366日目）");
  // 2月29日はじまり：ほかの年は2月28日が周年なので、2月27日が1年
  assert.equal(since("2024-02-29", "2025-02-27").party, "1年（365日目）");
  assert.equal(since("2024-02-29", "2025-02-28").party, "1周年");
  assert.equal(since("2025-10-05", "2026-11-03").milestone.label, "400日目");
  const u = until("2027-02-11", "2026-11-03");
  assert.equal(u.celebrate, true);
  assert.equal(u.party, "ちょうど あと100日");
  assert.equal(until("2027-02-12", "2026-11-03").celebrate, false);
});

test("お祝いの日：年を書いた記念日と、過ぎたその日までのカウントアップ", () => {
  const at = (p, now) => C.compute({ title: "X", hasTime: false, ...p, date: new Date(p.date + "T00:00") }, new Date(now + "T10:00"));
  // 1993-12-27 から 2026-11-03 は 12000日目
  const y = at({ type: "yearly", date: "1993-12-27" }, "2026-11-03");
  assert.equal(y.celebrate, true);
  assert.equal(y.party, "今日で 12,000日目");
  assert.equal(at({ type: "yearly", date: "1993-12-28" }, "2026-11-03").celebrate, false);
  // 年なしの記念日は数えない
  assert.equal(at({ type: "yearly", date: "12-27", noYear: true }, "2026-11-03").celebrate, false);
  const u = at({ type: "until", date: "2026-07-26" }, "2026-11-03");
  assert.equal(u.days, 100);
  assert.equal(u.party, "100日たちました");
});
