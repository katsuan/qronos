// くろのす（Qronos）：見るページ（index.html）の入口。1件の「あと何日？」か、ボードを出す。計算・リンク・カードは js/ の部品（window.Countdown）
// 読まれるところ：index.html（いちばん最後。js/ の部品のあと）
(function () {
  "use strict";
  const C = window.Countdown;
  // id の要素を返す
  const $ = (id) => document.getElementById(id);
  const board = C.readBoard(location.search);
  const p = board ? null : C.readParams(location.search);
  const BOARD_KEY = "countdown:board";
  // 名前や誕生日が入ったページは、検索に出さない
  if (location.search) document.head.append(Object.assign(document.createElement("meta"), { name: "robots", content: "noindex" }));
  let boardCelebrated = false;
  // 語の途中で折り返さない文字（span）を作る
  const nowrap = (text) => Object.assign(document.createElement("span"), { className: "nw", textContent: text });

  // 共有するのはこのページの URL（パラメータ込み）
  // 古い長い形のリンクで開いたときも、共有するのは短い形（?z=）
  const shareUrl = C.shortUrl(location.href.split("#")[0]);
  $("editBtn").href = `create.html${location.search}`;
  // 2秒だけ「コピーしました！」にして、元のボタン名に戻す（Q キット）
  $("copyBtn").onclick = () => LineShareUI.copy(shareUrl, { button: $("copyBtn") });

  // 画面の内容を画像に（1件なら大きな日数、ボードなら一覧）
  $("snapBtn").onclick = () => window.CountdownSnapshot.open(board ? { board, fileName: board.name } : { p, fileName: p.title });

  // 渡されたリンク（ボード・1件どちらでも）：名前と、どこへ行くか（ドメイン）を出す
  const ext = board || p;
  if (ext?.link) {
    // 名前が絵文字ではじまるときは、そのまま（🔗 を重ねない）
    const label = ext.linkLabel || "リンクを開く";
    $("extLinkLabel").textContent = /^\p{Extended_Pictographic}/u.test(label) ? label : `🔗 ${label}`;
    $("extLinkHost").textContent = new URL(ext.link).host;
    $("extLink").href = ext.link;
    $("extLink").hidden = false;
  }

  if (board) {
    showBoard();
    return;
  }

  if (!p) {
    $("empty").hidden = false;
    return;
  }

  document.documentElement.style.setProperty("--accent", p.color);
  document.title = `${p.emoji} ${p.title}`;
  $("emoji").textContent = p.emoji;
  $("title").textContent = p.title;
  if (p.note) {
    $("note").textContent = p.note;
    $("note").hidden = false;
  }
  if (p.from) {
    $("from").textContent = `from ${p.from}`;
    $("from").hidden = false;
  }
  if (p.msg) {
    $("msg").textContent = p.msg;
    $("msgCard").hidden = false;
  }
  ["view", "countCard", "shareCard"].forEach((id) => ($(id).hidden = false));

  // ボードの行から開いたときは、ボードに戻れるようにする
  if (location.hash === "#b") {
    try {
      const from = JSON.parse(sessionStorage.getItem(BOARD_KEY) || "null");
      // 戻る先は、このページ（同じ所・同じパス）のボードだけ
      const back = from?.url ? new URL(from.url, location.href) : null;
      if (back && back.origin === location.origin && back.pathname === location.pathname) {
        $("backToBoard").href = back.href;
        $("backToBoard").textContent = `← 📋 ${String(from.name || "ボード").slice(0, 40)}に戻る`;
        $("backToBoard").hidden = false;
      }
    } catch (_) {
      // 戻るボタンを出さないだけ
    }
  }

  // その日・次の記念日を Google カレンダーに（LINE の中では外のブラウザで開く）
  const links = C.calendarLinks(p, shareUrl);
  $("calendarCard").hidden = links.length === 0;
  $("calendarLinks").replaceChildren(...links.flatMap((link) => {
    const a = Object.assign(document.createElement("a"), { className: "btn ghost", href: link.url, target: "_blank", rel: "noopener" });
    a.append(Object.assign(document.createElement("span"), { textContent: link.label }), Object.assign(document.createElement("small"), { textContent: link.sub }));
    if (!link.event.yearly) return [a];
    // 毎年くり返す予定は、スマホの Google カレンダーのアプリだとくり返しが外れることがあるので、ファイルでも入れられるように
    const file = Object.assign(document.createElement("button"), { type: "button", className: "ics-link", textContent: "📥 ファイルで追加（毎年くり返しを確実に）" });
    file.onclick = () => {
      const blob = new Blob([C.icsText(link.event)], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const dl = Object.assign(document.createElement("a"), { href: url, download: `${p.title}.ics` });
      document.body.append(dl);
      dl.click();
      dl.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    };
    return [a, file];
  }));
  const hasYearly = links.some((link) => link.event.yearly);
  $("calendarNote").hidden = !hasYearly;

  // すくすくへ：日付（と名前）を渡して、写真・動画に入れる（作り方は js/link.js の suqsuqLink）
  const suqsuq = C.suqsuqLink(p);
  $("suqsuqCard").hidden = !suqsuq;
  if (suqsuq) {
    $("suqsuqLink").href = suqsuq.url;
    $("suqsuqSub").textContent = suqsuq.sub;
  }

  // カードの日数は送る時点のものにする（開いたまま日付が変わっても、押したときに作りなおす）
  $("lineBtn").href = C.buildCardUrl(p, shareUrl);
  $("lineBtn").addEventListener("click", () => ($("lineBtn").href = C.buildCardUrl(p, shareUrl)));

  let celebrated = false;
  // いまの時刻で、数字・日付・時計・次の記念日を描きなおす（1秒ごと）
  function render() {
    const v = C.compute(p);
    $("lead").textContent = v.lead;
    $("lead").hidden = !v.lead;
    $("big").hidden = v.days == null;
    if (v.days != null) {
      $("big").innerHTML = "";
      $("big").append(v.prefix || "", Object.assign(document.createElement("b"), { textContent: v.days.toLocaleString() }), v.unit);
    }
    $("today").hidden = !v.today;
    $("today").textContent = v.today || "";
    // 「2015年6月20日(土)から 11年3か月24日」を語の途中で折り返さないよう、空白ごとに区切る
    $("date").replaceChildren(...(v.sub || "").split("\n").flatMap((line, i) => [
      ...(i ? [document.createElement("br")] : []),
      ...line.split(" ").flatMap((word, j) => [j ? " " : "", nowrap(word)])
    ]));

    // 1日を切ったら（時刻つきなら常に）時・分・秒まで出す
    const showClock = v.target && (p.hasTime || v.target - Date.now() < 864e5);
    $("clock").hidden = !showClock;
    if (showClock) {
      const t = C.parts(v.target);
      $("cd").textContent = t.d;
      $("ch").textContent = C.pad(t.h);
      $("cm").textContent = C.pad(t.m);
      $("cs").textContent = C.pad(t.s);
    }

    $("milestone").hidden = !v.milestone && !v.party;
    $("milestone").innerHTML = "";
    // お祝いの日（100日目・1年・あと100日など）は、そのことを先に
    if (v.party) $("milestone").append(nowrap(`🎉 ${/^(今日で|ちょうど)/.test(v.party) ? "" : "今日で "}${v.party}`), document.createElement("br"));
    if (v.milestone) {
      const m = v.milestone;
      $("milestone").append(
        nowrap(`次の記念日：${m.label}まで`),
        " ",
        nowrap(`あと${m.daysLeft}日`),
        Object.assign(document.createElement("small"), { textContent: m.dateText })
      );
    }

    if (v.celebrate && !celebrated) {
      celebrated = true;
      confetti();
    }
  }

  // 紙吹雪（数秒で止まる）
  function confetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = $("confetti");
    const ctx = canvas.getContext("2d");
    const dpr = devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = [p ? p.color : "#6c47ff", "#ffd23f", "#ff6fa8", "#3ec7a0", "#5aa9e6"];
    const pieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * innerWidth,
      y: -20 - Math.random() * innerHeight * 0.6,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vy: 2 + Math.random() * 3,
      vx: -1 + Math.random() * 2,
      r: Math.random() * Math.PI,
      vr: -0.15 + Math.random() * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)]
    }));
    // 5.5秒で止める。急に消えないよう、最後の1.5秒でだんだん薄くする
    const end = Date.now() + 5500;
    const FADE = 1500;
    (function frame() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.globalAlpha = Math.max(0, Math.min(1, (end - Date.now()) / FADE));
      let alive = false;
      for (const s of pieces) {
        s.x += s.vx;
        s.y += s.vy;
        s.r += s.vr;
        if (s.y < innerHeight + 20) alive = true;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.r);
        ctx.fillStyle = s.c;
        ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
        ctx.restore();
      }
      if (alive && Date.now() < end) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })();
  }

  render();
  setInterval(render, 1000);

  // ボード：近い順に並べ、行を押すとその日だけのページを開く。日数だけなので1分ごとに更新
  function showBoard() {
    document.title = `📋 ${board.name}`;
    $("boardName").textContent = board.name;
    if (board.from) {
      $("boardFrom").textContent = `from ${board.from}`;
      $("boardFrom").hidden = false;
    }
    if (board.msg) {
      $("msg").textContent = board.msg;
      $("msgCard").hidden = false;
    }
    ["board", "boardList", "shareCard"].forEach((id) => ($(id).hidden = false));
    $("lineBtn").href = C.buildBoardCardUrl(board, shareUrl);
    $("lineBtn").addEventListener("click", () => ($("lineBtn").href = C.buildBoardCardUrl(board, shareUrl)));
    renderBoard();
    setInterval(renderBoard, 60000);
  }

  // ボードの行を近い順に描きなおす（1分ごと）
  function renderBoard() {
    const rows = C.sortedRows(board);
    $("boardList").replaceChildren(...rows.map((row) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      // 今日の日と、お祝いの日（100日目・1年・あと100日など）は色を付ける
      a.className = `board-row${row.v.today ? " is-today" : row.celebrate ? " is-party" : ""}`;
      // #b ＝ボードから開いた印。開いた先に「ボードに戻る」を出す（共有するリンクには付けない）
      a.href = `${C.buildShareUrl("", Object.fromEntries(new URLSearchParams(row.search)))}#b`;
      a.addEventListener("click", () => {
        try {
          sessionStorage.setItem(BOARD_KEY, JSON.stringify({ url: shareUrl, name: board.name }));
        } catch (_) {
          // 戻るボタンが出ないだけ
        }
      });
      a.style.setProperty("--row", row.p.color);
      const text = document.createElement("span");
      text.append(
        Object.assign(document.createElement("span"), { className: "board-title", textContent: row.p.title }),
        Object.assign(document.createElement("span"), { className: "board-sub", textContent: row.sub })
      );
      text.style.display = "grid";
      a.append(
        Object.assign(document.createElement("span"), { className: "board-emoji", textContent: row.p.emoji }),
        text,
        Object.assign(document.createElement("span"), { className: "board-count", textContent: `${row.celebrate && !row.v.today ? "🎉 " : ""}${row.count}` })
      );
      if (row.p.note) a.append(Object.assign(document.createElement("span"), { className: "board-note", textContent: row.p.note }));
      li.append(a);
      return li;
    }));
    if (!boardCelebrated && rows.some((row) => row.celebrate)) {
      boardCelebrated = true;
      confetti();
    }
  }
})();
