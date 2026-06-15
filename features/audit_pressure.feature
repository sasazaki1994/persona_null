Feature: 行動に応じた処理圧力を監査記録へ残す
  監査官はリアルタイム制限を受けず、行政圧力の上昇を確認しながら裁定できる。

  Scenario: 調査行動で処理圧力が上昇する
    Given 処理圧力が 0 / 100 の事件調査を開始した
    When 未読の記憶ノードを初回確認する
    Then 処理圧力は 4 上昇する
    When 矛盾タグを登録する
    Then 処理圧力は 3 上昇する
    When 解析アクションを実行する
    Then 処理圧力は 8 上昇する
    But 同じノードの再確認とタグ解除では上昇しない

  Scenario: 裁定可能状態を一度だけ記録する
    Given 必要ノード確認と判断根拠登録を完了した
    When 矛盾分類によって JUDGMENT READY に初回到達する
    Then 処理圧力は 5 上昇する
    And 都市OSが裁定提出を待機するログが記録される

  Scenario: 高圧下でも裁定できる
    Given 処理圧力が HIGH または CRITICAL である
    Then JUDGMENT CONSOLE に行政裁定圧力の警告が表示される
    And 最終判断は禁止されない
    When 裁定を確定する
    Then 結果画面に最終処理圧力と直近5件のイベントが表示される
    And 保存結果に処理圧力の値と状態が記録される

  Scenario: 旧保存結果を読み込む
    Given auditPressure を持たない既存の SavedCaseResult が保存されている
    When 事件ファイル選択を開く
    Then 既存結果は有効な処理済み記録として読み込まれる
