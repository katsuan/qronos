// くろのす：画面・保存の画像に出す名前（自分の名前と、つなぐツールの名前）。名前はここにだけ書き、ほかは window.QronosNames から読む
// index.html・create.html でいちばん先に読む。直書きがないかは q-dev の test/service-names.test.mjs が見る（なかまの名前は q-oqrn の data/hub-links.json と同じか）
(function (window) {
  "use strict";
  // <service-names>
  window.QronosNames = {
    app: "くろのす",
    en: "Qronos",
    suqsuq: "SuQSuQ" // すくすくへのリンクの説明に出す（英語の名前）
  };
  // </service-names>
}(window));
