// くろのす（Qronos）：作るページ（create.html）の入口。入れた日からリンクを作り、カードで送る。計算・リンク・カードは js/ の部品（window.Countdown）
// 読まれるところ：create.html（いちばん最後。js/ の部品のあと）
(function () {
  "use strict";
  const C = window.Countdown;
  // id の要素を返す
  const $ = (id) => document.getElementById(id);
  const form = $("form");
  const EMOJIS = {
    until: ["⏳", "✈️", "🎉", "🏖️", "🎄", "🎓", "⚽", "🎤"],
    yearly: ["🎂", "💍", "💐", "🎁", "🥂", "👶", "🌸", "⭐"],
    since: ["💞", "🌱", "🚭", "🏃", "🐶", "🏠", "💼", "📚"]
  };
  const PLACEHOLDERS = { until: "例：沖縄旅行", yearly: "例：結婚記念日", since: "例：付き合った日" };
  const MAX_URL = C.LINE_URI_MAX;

  let type = "until";
  let emoji = "";
  let color = C.COLORS[0].key;
  // ボードにまとめる日（2つ以上でボードになる）
  let entries = [];

  // 種類
  $("types").append(...Object.entries(C.TYPES).map(([key, t]) => {
    const label = document.createElement("label");
    // qcheck-ok: W1 決まった一覧（TYPES）の文字だけ
    label.innerHTML = `<input type="radio" name="type" value="${key}"><span><em>${t.emoji}</em><b>${t.label}<small>${t.hint}</small></b></span>`;
    label.querySelector("input").addEventListener("change", () => setType(key));
    return label;
  }));

  // 色
  $("colors").append(...C.COLORS.map((c) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color";
    button.style.background = c.hex;
    button.dataset.key = c.key;
    button.setAttribute("aria-label", c.label);
    button.addEventListener("click", () => {
      color = c.key;
      update();
    });
    return button;
  }));

  // 絵文字：名前の入力枠の中の左。押したとき・名前を入れているあいだは、下に選べる絵文字（Q キットの pickField。ui.js は defer なので読み終わってから）
  let emojiPick = null;
  document.addEventListener("DOMContentLoaded", () => {
    emojiPick = window.LineShareUI?.pickField?.({ field: $("titleField"), button: $("emojiBtn"), input: $("title"), picker: $("emojis") }) || null;
    // Q キットが古い・読めないときは、押して開く・たたむだけ
    if (!emojiPick) $("emojiBtn").addEventListener("click", () => ($("emojis").hidden = !$("emojis").hidden));
  });
  // 絵文字（候補から選ぶか、自分で入れる）
  const emojiInput = Object.assign(document.createElement("input"), { className: "ls-picker-custom", maxLength: 4, placeholder: "✏️" });
  emojiInput.setAttribute("aria-label", "ほかの絵文字");
  emojiInput.addEventListener("input", () => {
    emoji = emojiInput.value.trim();
    update();
  });
  // いまの種類の絵文字の候補（と、自分で入れる欄）を描く
  function renderEmojis() {
    const buttons = EMOJIS[type].map((e) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ls-picker-item";
      button.textContent = e;
      button.addEventListener("click", () => {
        emoji = e;
        emojiInput.value = "";
        update();
        // 選んだらたたむ（名前を入れているあいだは開いたまま）
        if (document.activeElement !== $("title")) emojiPick ? emojiPick.close() : ($("emojis").hidden = true);
      });
      return button;
    });
    $("emojis").replaceChildren(...buttons, emojiInput);
  }

  // 種類（その日まで・毎年・その日から）を切りかえる
  function setType(key) {
    // 種類の絵文字のままなら、新しい種類の絵文字に替える
    if (!emoji || EMOJIS[type].includes(emoji)) emoji = EMOJIS[key][0];
    type = key;
    $("title").placeholder = PLACEHOLDERS[key];
    renderEmojis();
    update();
  }

  // 毎年の記念日で「年は出さない」なら、月日だけ（"11-03"）にする
  const noYear = () => type === "yearly" && $("noYear").checked;

  // 入れた中身（種類・日付・名前・絵文字・色・ひとこと）を返す
  function values() {
    const date = $("date").value;
    const time = $("time").value;
    return {
      type,
      date: noYear() ? date.slice(5) : date && time ? `${date}T${time}` : date,
      title: $("title").value.trim(),
      note: $("note").value.trim(),
      emoji,
      color,
      from: "",
      msg: $("msg").value.trim()
    };
  }

  // このページと同じ所の、見るページの URL
  const baseUrl = () => new URL("./", location.href).href;

  // 入れた中身で見本の文と欄の状態を描きなおし、作りかけを端末に残す
  function update() {
    form.querySelector(`input[value="${type}"]`).checked = true;
    $("noYearRow").hidden = type !== "yearly";
    $("time").disabled = noYear();
    document.documentElement.style.setProperty("--accent", C.COLORS.find((c) => c.key === color).hex);
    for (const b of $("colors").children) b.setAttribute("aria-pressed", String(b.dataset.key === color));
    for (const b of $("emojis").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.textContent === emoji));
    // 名前の入力枠の中の絵文字（カスタムで入れたものも）
    $("emojiNow").textContent = emoji;
    $("emojiBtn").setAttribute("aria-label", `絵文字を選ぶ（いま：${emoji}）`);
    emojiInput.classList.toggle("is-selected", !!emoji && !EMOJIS[type].includes(emoji));
    $("msgCount").textContent = `${$("msg").value.length} / 120`;

    // いまの時点での見え方
    const v = values();
    const p = C.readParams(new URL(C.buildShareUrl(baseUrl(), v)).search);
    let line = "日付を入れると、ここに「あと何日？」が出ます";
    if (p) {
      const r = C.compute(p);
      line = r.today ? `${p.emoji} ${r.today}` : `${p.emoji} ${r.lead} ${r.prefix || ""}${r.days.toLocaleString()}${r.unit}`;
    }
    const total = entries.length + (v.date ? 1 : 0);
    const boardLine = total >= 2 ? `📋 ボード：${total}件をまとめて表示` : "📋 もう1つ入れるとボードになります";
    $("preview").textContent = entries.length ? `${boardLine}\n${p ? line : ""}`.trim() : line;
    $("addEntry").hidden = entries.length >= C.MAX_ENTRIES;
    $("msgNote").hidden = entries.length === 0;
    $("out").hidden = true;
    $("makeErr").hidden = true;
    if ($("date").value) $("dateErr").hidden = true;
    saveDraft();
  }

  // ---- 作りかけ：変えたらすぐこの端末に残し、次に開いたら続きから ----
  const DRAFT_KEY = "qronos:draft";
  // 作りかけを端末（qronos:draft）に残す。空なら消す
  function saveDraft() {
    const draft = {
      type, emoji, color, entries,
      date: $("date").value, time: $("time").value, noYear: $("noYear").checked,
      title: $("title").value, note: $("note").value, msg: $("msg").value, boardName: $("boardName").value
    };
    const empty = !draft.date && !draft.title && !draft.note && !draft.msg && !entries.length;
    try {
      if (empty) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (_) {
      // 残せない環境（プライベートブラウズなど）では、そのまま使える
    }
  }
  // 前回の作りかけをフォームに戻す。戻せたら true
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (!d || typeof d !== "object") return false;
      type = C.TYPES[d.type] ? d.type : "until";
      if (C.COLORS.some((c) => c.key === d.color)) color = d.color;
      emoji = String(d.emoji || EMOJIS[type][0]);
      // 読めない日（日付が壊れているもの）は外す
      entries = (Array.isArray(d.entries) ? d.entries : [])
        .filter((e) => e && typeof e === "object" && C.parseDate(e.date))
        .slice(0, C.MAX_ENTRIES)
        .map((e) => Object.fromEntries(["type", "date", "title", "emoji", "color", "note"].map((k) => [k, String(e[k] ?? "")])));
      for (const id of ["date", "time", "title", "note", "msg", "boardName"]) $(id).value = String(d[id] || "");
      $("noYear").checked = Boolean(d.noYear);
      emojiInput.value = Object.values(EMOJIS).flat().includes(emoji) ? "" : emoji;
      $("title").placeholder = PLACEHOLDERS[type];
      renderEmojis();
      return true;
    } catch (_) {
      return false;
    }
  }

  form.addEventListener("input", update);

  // ---- ボード ----
  const entryValues = (v) => ({ type: v.type, date: v.date, title: v.title, emoji: v.emoji, color: v.color, note: v.note });

  // 日付が入っているか。ないときは欄の下に赤い文字を出す
  function checkDate() {
    const ok = Boolean($("date").value);
    $("dateErr").hidden = ok;
    if (!ok) $("date").focus();
    return ok;
  }

  // 入れ終わった日を一覧に移し、フォームを次の日のために空ける（種類と色はそのまま）
  $("addEntry").addEventListener("click", () => {
    if (!checkDate()) return;
    entries.push(entryValues(values()));
    $("title").value = "";
    $("note").value = "";
    $("date").value = "";
    $("time").value = "";
    emojiInput.value = "";
    emoji = EMOJIS[type][0];
    renderEntries();
    update();
    $("title").focus();
  });

  // ボードに入れた日の一覧を描く（押すと直せる・× で外せる）
  function renderEntries() {
    $("boardBox").hidden = entries.length === 0;
    $("entryCount").textContent = `${entries.length}件`;
    $("entryList").replaceChildren(...entries.map((entry, index) => {
      const p = C.readParams(new URL(C.buildShareUrl(baseUrl(), entry)).search);
      const li = document.createElement("li");
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "entry-edit";
      edit.style.setProperty("--row", p.color);
      edit.innerHTML = "<em></em><span><b></b><small></small></span>";
      edit.querySelector("em").textContent = p.emoji;
      edit.querySelector("b").textContent = p.title;
      edit.querySelector("small").textContent = `${C.TYPES[p.type].label}・${p.noYear ? `毎年 ${C.monthDay(p.date)}` : C.fmtDate(p.date, p.hasTime)}${p.note ? `・${p.note}` : ""}`;
      // 押すとフォームに戻して直せる（いまフォームにある日は一覧に入れかえる）
      edit.addEventListener("click", () => {
        const current = values();
        entries.splice(index, 1);
        if (current.date) entries.push(entryValues(current));
        fillForm(new URLSearchParams(C.expandSearch(C.buildShareUrl("", entry))));
        renderEntries();
        update();
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "entry-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `${p.title}をボードから外す`);
      // すぐ外して、トーストの「元に戻す」で戻せる
      remove.addEventListener("click", () => {
        const [removed] = entries.splice(index, 1);
        renderEntries();
        update();
        LineShareUI.toast(`「${p.title}」をボードから外しました`, {
          actionLabel: "元に戻す",
          onAction: () => {
            entries.splice(Math.min(index, entries.length), 0, removed);
            renderEntries();
            update();
          }
        });
      });
      li.append(edit, remove);
      return li;
    }));
  }

  // できたページのリンクと送るボタンを出す
  function showOut(shareUrl, cardUrl) {
    $("lineBtn").href = cardUrl;
    $("openBtn").href = shareUrl;
    // 季節の絵文字をときどき
    $("copyBtn").onclick = () => LineShareUI.copy(shareUrl, { done: window.QSeason ? QSeason.decorate("🔗 リンクをコピーしました") : "🔗 リンクをコピーしました" });
    $("out").hidden = false;
    $("out").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // 作れない理由を、作るボタンのすぐ上に出す
  function showMakeErr(text) {
    $("makeErr").textContent = text;
    $("makeErr").hidden = false;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = values();
    // ボード：一覧の日（＋フォームに日付があればその日）をまとめる
    const list = v.date ? [...entries, entryValues(v)] : [...entries];
    if (list.length >= 2) {
      $("dateErr").hidden = true;
      const shareUrl = C.buildBoardUrl(baseUrl(), { name: $("boardName").value, from: v.from, msg: v.msg, ...keptLink, entries: list });
      if (shareUrl.length > MAX_URL) {
        showMakeErr("長すぎて作れません。日を減らすか、名前を短くしてね。");
        return;
      }
      showOut(shareUrl, C.buildBoardCardUrl(C.readBoard(new URL(shareUrl).search), shareUrl));
      return;
    }
    const single = { ...(list.length === 1 && !v.date ? { ...list[0], from: v.from, msg: v.msg } : v), ...keptLink };
    if (!single.date) {
      checkDate();
      return;
    }
    const shareUrl = C.buildShareUrl(baseUrl(), single);
    // LINE のボタンにのせられる長さ（ふつうは届かない。長い名前・ひとことのときだけ）
    if (shareUrl.length > MAX_URL) {
      showMakeErr("長すぎて作れません。名前やひとことを、少し短くしてね。");
      return;
    }
    showOut(shareUrl, C.buildCardUrl(C.readParams(new URL(shareUrl).search), shareUrl));
  });

  // 1件分をフォームに入れる（種類・日付・名前・絵文字・色）
  function fillForm(q) {
    type = C.TYPES[q.get("type")] ? q.get("type") : "until";
    const start = C.parseDate(q.get("date"));
    $("date").value = "";
    $("time").value = "";
    $("noYear").checked = Boolean(start?.noYear);
    if (start?.noYear) type = "yearly";
    if (start) {
      const d = start.date;
      // 年なしは日付の入力欄に年が要るので、仮に2000年（うるう年）で入れておく
      $("date").value = `${d.getFullYear()}-${C.pad(d.getMonth() + 1)}-${C.pad(d.getDate())}`;
      if (start.hasTime) $("time").value = `${C.pad(d.getHours())}:${C.pad(d.getMinutes())}`;
    }
    $("title").value = q.get("title") || "";
    $("note").value = q.get("note") || "";
    if (C.COLORS.some((c) => c.key === q.get("color"))) color = q.get("color");
    emoji = q.get("emoji") || EMOJIS[type][0];
    emojiInput.value = Object.values(EMOJIS).flat().includes(emoji) ? "" : emoji;
    $("title").placeholder = PLACEHOLDERS[type];
    renderEmojis();
  }

  // 表示ページの「自分でも作る」から来たときは、その内容を入れておく（ボードなら一覧に）
  // 短い形（?z=）のリンクから来たときも、今までのパラメータの形に戻して読む
  const q = new URLSearchParams(C.expandSearch(location.search));
  const board = C.readBoard(location.search);
  // 名前や誕生日が入ったページは、検索に出さない
  if (location.search) document.head.append(Object.assign(document.createElement("meta"), { name: "robots", content: "noindex" }));
  if (board) {
    entries = board.entries.map((entry) => {
      const e = new URLSearchParams(entry.search);
      return { type: e.get("type") || "", date: e.get("date") || "", title: e.get("title") || "", emoji: e.get("emoji") || "", color: e.get("color") || "", note: e.get("note") || "" };
    });
    $("boardName").value = q.get("name") || "";
    renderEmojis();
  } else {
    fillForm(q);
  }
  $("msg").value = q.get("msg") || "";
  // 渡されたリンク（くみあわせの大会など）は、直して作りなおしても残す（画面には出さない）
  const keptLink = { link: q.get("link") || "", linkLabel: q.get("linkLabel") || "" };
  // リンクで中身を渡されていないときは、前回の作りかけから
  const resumed = !location.search && loadDraft();
  renderEntries();
  update();

  // Q キット（ui.js）は defer なので、読み終わってから
  document.addEventListener("DOMContentLoaded", () => {
    if (resumed) {
      LineShareUI.toast("前回の続きから開きました", {
        actionLabel: "新しく作る",
        onAction: () => {
          try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
          location.reload();
        }
      });
    }
    LineShareUI.firstTip(
      "qronos",
      ["何を数えるか選んで、名前と日付を入れます", "「＋ もう1つの日を足す」で、いくつかの日を1つのボードにまとめられます", "「⏳ ページを作る」→「カードでおくるん」で、受け取った人がいつでも「あと何日？」を見られます"],
      form
    );
  });
})();
