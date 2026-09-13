# ゲーム内容のカスタマイズ

このフォルダのJSONを書き換えると、**再ビルドするだけ**でゲームの文言もバランスも変えられる。
ロジック（イベントの発生条件や効果の計算式）はJS側にあるが、名前・説明・数値はすべてここにある。

| ファイル | 中身 |
|---|---|
| `facilities.json` | 施設。名前・説明・アイコン・費用・維持費・必要聖職者・効果・見た目・手引き文 |
| `businesses.json` | 事業（出版/教育/財団/政党）。名前・説明・費用・解禁条件 |
| `missions.json` | 布教施策。名前・説明・レイヤー・費用・効果 |
| `synergies.json` | 配置シナジー。隣接ペアと区画ゾーンの定義 |
| `regions.json` | 7地方。名前・紹介文・人口・人口構成・地方補正・教義バイアス・支部費用 |
| `clusters.json` | 信者クラスタ。名前・性格文・色・お布施額・離脱率・教義への感応度 |
| `doctrine.json` | 教義4軸の名前と両端のラベル、説明 |
| `events.json` | ランダムイベントの名前・本文・抽選重み（発生条件と効果は `src/game/data/events.js`） |
| `endings.json` | 決着の条件と文言（勝利4種・敗北3種）。到達に必要な金額や割合もここ |
| `quests.json` | 「導きの書」の手順の文言（達成判定は `src/components/QuestPanel.jsx`） |
| `investments.json` | 投資の運用先。利回り・変動幅・元本割れ確率・受け入れ容量・副作用 |
| `tips.json` | 各画面の手引きカード |

## 施設（facilities.json）

```jsonc
"press": {
  "name": "出版局",
  "icon": "📰",
  "desc": "新聞・書籍を刷る。…",
  "tip": "教団最初の安定収入。…",        // 詳細パネルに出る手引き
  "cost": 10000000,                     // 建設費（円）
  "upkeep": 95000,                      // 維持費（円/日）。停止中は4割だけかかる
  "priests": 3,                         // 聖職者ロックに必要な人数
  "requires": "publishing",             // この事業の設立が前提（省略可）
  "unique": true,                       // 教団に一つだけ（省略可）
  "alwaysActive": true,                 // ロック不要で常時稼働（教会本部のみ）
  "effect": { "growth": 0.18, "income": 210000 },
  "look": { "height": 42, "color": "#b08a4a", "roof": "flat" }
}
```

`effect` に書けるキー：

| キー | 意味 |
|---|---|
| `growth` | 信者獲得倍率への加算（0.18 = +18%） |
| `donation` | お布施倍率への加算 |
| `faith` | 信仰度の日次回復 |
| `churn` | 離脱率倍率への加算（マイナスが良い） |
| `wariness` | 警戒度の日次変化（マイナスが良い） |
| `income` | 固定の日次収入（円） |
| `incomePerPriest` | 聖職者1人あたりの日次収入（円） |
| `convertCap` | 1日に聖職者へ転向できる人数 |
| `votePower` | 得票係数への加算 |
| `underworld` | 闇度の日次変化（裏の事業の施設だけが持つ） |

`look` は等角表示の見た目。`roof` は `flat` / `gable` / `dome` / `tower` / `antenna`。

## 配置シナジー（synergies.json）

```jsonc
"adjacency": [
  {
    "id": "mediaPair",
    "pair": ["press", "broadcast"],   // 直交（上下左右）で隣接すると成立
    "name": "紙と電波",
    "desc": "…",
    "effect": { "growth": 0.12, "income": 60000 }
  }
],
"zones": [
  { "id": "halo",   "kind": "halo",     "mult": 1.15 },              // 本部に接する8区画の施設の効果を倍率で強化
  { "id": "hqCenter","kind": "hqCenter", "mult": 1.04 },             // 本部が都市中央なら全施設を強化
  { "id": "edgeMission", "kind": "edge", "types": ["missionPost"], "effect": { "growth": 0.07 } }
]
```

`adjacency` は同じ種類どうし（`["missionPost","missionPost"]`）も書ける。
ペアは成立するたびに加算されるので、3棟を並べれば2組ぶん効く。

## 決着の条件（endings.json）

```jsonc
"conglomerate": {
  "kind": "victory",
  "title": "コングロマリット",
  "text": "…{businesses}…{funds}…",   // {share} {party} {order} {businesses} {funds} を差し込める
  "hint": "一覧に出る一行説明",
  "requireAllBusinesses": true,
  "requireFunds": 30000000000000      // ここを 100000000000000 にすれば100兆円エンドになる
}
```

`requireShare`（全人口比）、`requireUnderworld`・`requireFollowers`・`requireBusiness`（裏ルート）も同様に調整できる。
敗北側（`bankrupt` / `raid` / `assassinated`）は文言のみ。

## 投資（investments.json）

```jsonc
"equity": {
  "name": "国内株式ファンド",
  "dailyReturn": 0.0030,     // 1日の基準利回り
  "volatility": 0.0090,      // 日々の振れ幅
  "crashChance": 0.0060,     // 元本割れの発生確率（1日あたり）
  "crashLoss": 0.22,         // 起きたときに失う割合
  "capacity": 2000000000000, // これを超えて預けた分は働かず、ただ寝ている
  "wariness": 0.03,          // 総資産に占める割合に比例して乗る
  "underworld": 0,
  "shadow": false            // true にすると「裏の運用」の枠に並ぶ
}
```

期待値は `dailyReturn − crashChance × crashLoss`。これが負にならないよう気をつけること。

## 地方の土地柄×シナジー（synergies.json の `regional`）

```jsonc
"regional": {
  "wordScaled":  { "rules": ["gatherTrain", "openGate", ...] },      // 口コミ係数を乗算
  "mediaScaled": { "rules": ["mediaPair"], "zones": ["edgeMedia"] }, // 広報係数を乗算
  "doctrineBoost": {
    "scale": 0.5,
    "axes": { "asceticism": ["dojo"], "hierarchy": ["school"], ... }
  }
}
```

`doctrineBoost` は、地方の土地柄補正（例：東北の禁欲+0.20）に応じて
該当施設の効果を `1 + 補正値 × scale` 倍する。都市は拠点に一つなので、拠点地方の係数が使われる。

## 注意

- 施設・事業・施策・地方・クラスタ・教義軸の **キー（id）はJS側から参照している**ので、
  名前や数値は自由に変えてよいが、キーの追加・削除・改名はコード側の対応が要る。
- イベントは `events.json` にある文言だけが使われ、`id` が `src/game/data/events.js` の
  `LOGIC` に無いものは読み込まれない。
- バランスを大きく変えたら `node tools/balance-sim.mjs` で通しプレイを確認するとよい。
