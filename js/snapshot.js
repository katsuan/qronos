// くろのす：画面の内容を保存用の画像（1080×1350 の縦長）に描く。表示中の画面をそのまま写すとスマホでは崩れやすいので、
// 同じ内容を canvas に描き直す。1件なら大きく日数を、ボードなら近い順の一覧を描く。
// 保存は「画像を長押し」（LINE のブラウザでも使える）か、共有メニュー（端末が対応していれば）から。
// 読まれるところ：index.html（app.js の前）。「📷 画像で保存」で app.js が呼ぶ（window.CountdownSnapshot）
(function () {
  "use strict";
  const C = window.Countdown;
  const W = 1080;
  const H = 1350;
  const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", system-ui, sans-serif';
  const INK = "#2f2a44";
  const SOFT = "#6b6680";

  // ボタンの前の線アイコン（Q キットの ui.css の .ls-icon）
  function lineIcon(name) {
    const el = Object.assign(document.createElement("span"), { className: "ls-icon" });
    el.dataset.icon = name;
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  // 画像の文字の書体（大きさ・太さ）
  function font(size, weight = 800) {
    return `${weight} ${size}px ${FONT}`;
  }

  // 絵文字はカラー絵文字のフォントを先に使い、色は文字色にする。
  // （カラー絵文字がない端末では単色の字として描かれ、直前の塗りの色＝背景の色になって見えなくなるため）
  const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", ' + FONT;
  // 絵文字を描く（絵文字の書体で）
  function drawEmoji(ctx, emoji, x, y, size) {
    ctx.font = `400 ${size}px ${EMOJI_FONT}`;
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.fillText(emoji, x, y);
  }

  // 幅に収まるまで文字を小さくして1行で描く
  function fitText(ctx, text, x, y, maxWidth, size, { weight = 800, color = INK, align = "center", min = 24 } = {}) {
    let s = size;
    ctx.font = font(s, weight);
    while (s > min && ctx.measureText(text).width > maxWidth) {
      s -= 2;
      ctx.font = font(s, weight);
    }
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y, maxWidth);
    return s;
  }

  // 角の丸い四角の道を作る
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 背景（選んだ色のグラデーション）を描く
  function background(ctx, color) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, mix(color, 0.22));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // 色を白に寄せる（#rrggbb と 0〜1）
  function mix(hex, amount) {
    const n = parseInt(hex.replace("#", ""), 16);
    // 色の1つの成分（R・G・B）を白に寄せる
    const ch = (shift) => Math.round(255 - (255 - ((n >> shift) & 255)) * amount);
    return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
  }

  // 画像の下に、いつの時点かと、くろのすの名前・アドレスを描く
  function footer(ctx, now) {
    ctx.font = font(26, 700);
    ctx.fillStyle = SOFT;
    ctx.textAlign = "center";
    ctx.fillText(`🕒 ${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} 時点`, W / 2, H - 92);
    ctx.font = font(24, 700);
    ctx.fillText("くろのす 〜Qronos〜 ｜ katsuan.github.io/countdown", W / 2, H - 52);
  }

  // 1件の画像（大きな日数・名前・日付）を描く
  function drawSingle(ctx, p, now) {
    const v = C.compute(p, now);
    background(ctx, p.color);
    // 白いカード
    ctx.save();
    ctx.shadowColor = "rgba(60, 40, 120, 0.15)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 80, 150, W - 160, 980, 56);
    ctx.fill();
    ctx.restore();

    ctx.textBaseline = "alphabetic";
    drawEmoji(ctx, p.emoji, W / 2, 330, 150);
    fitText(ctx, p.title, W / 2, 440, W - 260, 72);
    let y = 500;
    if (p.note) {
      fitText(ctx, p.note, W / 2, y, W - 260, 40, { color: p.color, weight: 700 });
      y += 20;
    }

    if (v.today) {
      fitText(ctx, v.today, W / 2, 760, W - 240, 84, { color: p.color });
    } else {
      fitText(ctx, v.lead, W / 2, y + 90, W - 260, 46, { weight: 700 });
      // 「あと 20 日」：数字だけ大きく
      const num = v.days.toLocaleString();
      ctx.font = font(240, 800);
      const numW = ctx.measureText(num).width;
      ctx.font = font(64, 700);
      const preW = v.prefix ? ctx.measureText(v.prefix).width + 24 : 0;
      const unitW = ctx.measureText(v.unit).width + 24;
      let scale = Math.min(1, (W - 240) / (preW + numW + unitW));
      const x0 = W / 2 - ((preW + numW + unitW) * scale) / 2;
      const base = y + 380;
      ctx.textAlign = "left";
      ctx.fillStyle = INK;
      ctx.font = font(64 * scale, 700);
      if (v.prefix) ctx.fillText(v.prefix, x0, base);
      ctx.font = font(240 * scale, 800);
      ctx.fillStyle = p.color;
      ctx.fillText(num, x0 + preW * scale, base);
      ctx.font = font(64 * scale, 700);
      ctx.fillStyle = INK;
      ctx.fillText(v.unit, x0 + (preW + numW + 24) * scale, base);
    }
    const lines = String(v.sub || "").split("\n").filter(Boolean);
    lines.forEach((line, i) => fitText(ctx, line, W / 2, 1000 + i * 50, W - 260, 36, { color: SOFT, weight: 700 }));
    footer(ctx, now);
  }

  // ボードの画像（近い順の一覧）を描く
  function drawBoard(ctx, board, now) {
    background(ctx, "#6c47ff");
    ctx.textBaseline = "alphabetic";
    drawEmoji(ctx, "📋", W / 2, 150, 84);
    fitText(ctx, board.name, W / 2, 250, W - 200, 64);
    const rows = C.sortedRows(board, now);
    const area = 300;
    const bottom = H - 140;
    const gap = 16;
    const rowH = Math.min(150, (bottom - area - gap * (rows.length - 1)) / rows.length);
    // 件数が少ないときは、一覧を少し下げて上下の空きをならす
    const total = rows.length * rowH + gap * (rows.length - 1);
    const top = area + Math.max(0, (bottom - area - total) / 3);
    rows.forEach((row, i) => {
      const y = top + i * (rowH + gap);
      ctx.save();
      ctx.shadowColor = "rgba(60, 40, 120, 0.12)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = row.v.today ? mix(row.p.color, 0.14) : "#ffffff";
      roundRect(ctx, 70, y, W - 140, rowH, 28);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = row.p.color;
      roundRect(ctx, 70, y, 14, rowH, 7);
      ctx.fill();
      const mid = y + rowH / 2;
      const k = rowH / 150; // 行が低いときは全体を小さく
      drawEmoji(ctx, row.p.emoji, 150, mid + 22 * k, 64 * k);
      // 右：日数
      ctx.textAlign = "right";
      ctx.font = font(52 * k, 800);
      ctx.fillStyle = row.p.color;
      ctx.fillText(row.count, W - 110, mid + 18 * k);
      const countW = ctx.measureText(row.count).width;
      // 中：名前と日付（ひとことがあれば日付の代わりに）
      const textW = W - 110 - countW - 30 - 210;
      fitText(ctx, row.p.title, 210, mid - 6 * k, textW, 44 * k, { align: "left", min: 18 });
      fitText(ctx, row.p.note || row.sub, 210, mid + 40 * k, textW, 30 * k, { align: "left", weight: 700, color: row.p.note ? row.p.color : SOFT, min: 16 });
    });
    footer(ctx, now);
  }

  /** 画像を作って、長押しで保存できる画面を出す */
  async function open({ p, board, fileName }) {
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const now = new Date();
    if (board) drawBoard(ctx, board, now);
    else drawSingle(ctx, p, now);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const url = URL.createObjectURL(blob);
    const file = new File([blob], `${fileName || "countdown"}.png`, { type: "image/png" });
    showSheet(url, file);
  }

  // できた画像を見せる窓（長押しで保存・共有・ダウンロード）を出す
  function showSheet(url, file) {
    document.getElementById("snapSheet")?.remove();
    const sheet = document.createElement("div");
    sheet.id = "snapSheet";
    sheet.className = "snap-sheet";
    sheet.innerHTML = `
      <div class="snap-card" role="dialog" aria-modal="true" aria-label="画像で保存">
        <img alt="保存用の画像">
        <p class="note">画像を長押しすると保存できます。</p>
        <div class="snap-actions"></div>
        <button type="button" class="btn ghost snap-close">閉じる</button>
      </div>`;
    sheet.querySelector("img").src = url;
    const actions = sheet.querySelector(".snap-actions");
    if (navigator.canShare?.({ files: [file] })) {
      const share = Object.assign(document.createElement("button"), { type: "button", className: "btn" });
      share.append(lineIcon("share"), "共有・保存");
      share.onclick = () => navigator.share({ files: [file] }).catch(() => {});
      actions.append(share);
    }
    const download = Object.assign(document.createElement("a"), { className: "btn ghost", href: url, download: file.name });
    download.append(lineIcon("save"), "ダウンロード");
    actions.append(download);
    // 窓を閉じて、画像の URL を片づける
    const close = () => {
      sheet.remove();
      URL.revokeObjectURL(url);
    };
    sheet.querySelector(".snap-close").onclick = close;
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet) close();
    });
    document.body.append(sheet);
  }

  window.CountdownSnapshot = { open };
})();
