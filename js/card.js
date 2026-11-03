// くろのす：おくるんのお知らせカードで送るリンク（1件・ボード）
// 部品は index.html・create.html で js/count.js → js/link.js → js/card.js → js/calendar.js の順に読み、window.Countdown にまとめる
// 読まれるところ：index.html・create.html（js/link.js のあと）
(function (C) {
  "use strict";
  const { COLORS, compute, fmtDate, monthDay, sortedRows } = C;

  /**
   * おくるんのお知らせカードで送るリンク。カウントダウン（その日まで・毎年の記念日）とカウントアップ（その日から）で見せ方を変える。
   *   カウントダウン … ⏳ 見出し「カウントダウン」、日付の下に「あと○日」のバッジ。当日は「今日は○○！」
   *   カウントアップ … 📈 見出し「カウントアップ」、「○日目」と「○年○か月○日」のバッジ。節目の日はお祝いの言葉
   *   その日まで（過ぎたあと） … ページと同じくカウントアップに切り替える。📈 見出し「カウントアップ」、「○日たちました」のバッジ
   * 日数は送ったあとに変わるので、送った日の時点だとわかるように書き、最新はボタンの先（このページ）で見てもらう。
   */
  function buildCardUrl(p, shareUrl, now = new Date()) {
    const v = compute(p, now);
    const up = p.type === "since" && p.date <= now;
    // その日まで：日を過ぎたあと（当日を除く）は、ページと同じく「○日たちました」のカウントアップにする
    const after = p.type === "until" && !v.today && v.prefix !== "あと" && v.days != null;
    const stamp = `🕒 ${now.getMonth() + 1}/${now.getDate()} 時点`;
    let title;
    let date;
    const badges = [];
    if (p.type === "yearly") {
      const nth = v.nth > 0 ? `${v.nth}回目の` : "";
      title = v.today ? `🎉 今日は ${nth}${p.title}！` : `${v.celebrate ? "🎉" : p.emoji} ${nth}${p.title}まで`;
      date = `毎年 ${monthDay(p.date)}`;
    } else if (up) {
      title = v.celebrate ? `🎉 ${p.title}から ${v.party}！` : `${p.emoji} ${p.title}から`;
      date = `${fmtDate(p.date, false)}から`;
    } else if (after) {
      title = `${p.emoji} ${p.title}から`;
      date = `${fmtDate(p.date, p.hasTime)}から`;
    } else {
      title = v.today ? `🎉 今日は ${p.title}！` : `${v.celebrate ? "🎉" : p.emoji} ${p.title}まで`;
      date = fmtDate(p.date, p.hasTime);
    }
    if (up) {
      badges.push(`${v.days.toLocaleString()}日目`);
      const span = (v.sub || "").split(" ").pop();
      if (span && span !== "0日") badges.push(span);
    } else if (v.today) {
      badges.push("今日！");
    } else if (v.days != null) {
      badges.push(v.prefix === "あと" ? `あと${v.days.toLocaleString()}日` : `${v.days.toLocaleString()}${v.unit}`);
    }
    const detail = [p.note, p.msg, p.from ? `from ${p.from}` : "", stamp].filter(Boolean).join("\n");
    const q = new URLSearchParams({
      headerTitle: up || after ? "📈 カウントアップ" : p.type === "yearly" ? "🎂 記念日カウントダウン" : "⏳ カウントダウン",
      date,
      title,
      detail,
      showDate: "true",
      theme: "custom",
      customColor: p.color,
      bubbleSize: "mega",
      showAction: "true",
      // 当日は残りがないので、お祝いのページ（紙吹雪）を開いてもらう
      actionLabel: v.today ? "🎉 お祝いページを開く" : up ? "📈 今日で何日目？" : after ? "📈 何日たった？" : "⏳ 最新の残りを見る",
      actionUrl: shareUrl
    });
    for (const badge of badges) q.append("badge", badge);
    q.set("from", "countdown"); // おくるん側で、記念日・カウントダウンから来たと数える（流入口）
    return okuruUrl(q);
  }

  // おくるんのカードの URL。部品（oqrn.js）が読めない（電波なしなど）ときは、送るボタンだけ使えない
  const okuruUrl = (q) => (window.OQRN ? window.OQRN.cardUrl(q) : "#");

  /** ボードをおくるんのカードで送るリンク。近い順に1行ずつ「絵文字 名前　あと○日」を並べる */
  function buildBoardCardUrl(board, shareUrl, now = new Date()) {
    // 日数を先に置く（名前が長くても日数が途中で折り返されないように）
    const lines = sortedRows(board, now).map((row) => `${row.count}｜${row.p.emoji} ${row.p.title}`);
    const detail = [lines.join("\n"), board.msg, board.from ? `from ${board.from}` : ""].filter(Boolean).join("\n\n");
    const q = new URLSearchParams({
      headerTitle: "📋 記念日ボード",
      date: `🕒 ${now.getMonth() + 1}/${now.getDate()} 時点`,
      title: board.name,
      detail,
      showDate: "true",
      theme: "custom",
      customColor: COLORS[0].hex,
      bubbleSize: "mega",
      showAction: "true",
      actionLabel: "📋 ボードを開く",
      actionUrl: shareUrl
    });
    q.set("from", "countdown"); // おくるん側で、記念日・カウントダウンから来たと数える（流入口）
    return okuruUrl(q);
  }

  // ほかのファイル・画面から使うもの
  Object.assign(C, { buildBoardCardUrl, buildCardUrl });
})((window.Countdown = window.Countdown || {}));
