Feature: Case001 焼却されなかった声を監査する
  Case000 の監査フローと保存互換性を維持しながら、監査官は Case001 を選択して最終裁定まで進められる。

  Background:
    Given 監査端末を起動して都市OS通知を確認した

  Scenario: Case000 と Case001 が事件選択に表示される
    When 事件ファイル選択を開く
    Then Case000「誰が撃ったのか」は監査可能である
    And Case001「焼却されなかった声」も監査可能である
    And Case001 に previewOnly または凍結中の表示はない

  Scenario: Case001 の調査記録を確認する
    Given Case001 を開いて調査を開始した
    Then Memory Network に Case001 の7記憶ノードが表示される
    And 3つの争点が表示される
    When 記憶ノードを選択する
    Then 単純事実と監査官メモと重要警告と詳細ログが表示される
    And 解放条件を満たした追加解析を実行できる

  Scenario: 「私は、見ていました」の対象を照合する
    Given Case001 の反復発話ログと断片記憶を確認した
    Then 発話は犯人の顔を見たという記録ではない
    And 発砲直前に右腕義体の制御表示が通常認証から KASUMI-GATE-09 へ切り替わった記録が表示される
    And 間宮怜司の表情と視線と生体反応には発砲意図が記録されていない
    And 発砲命令ログは間宮怜司の人格署名で処理されている
    And 記録は右腕義体による発砲と間宮本人の発砲意図不在を同時に示す
    But 外部制御命令の発行元と真犯人は確定されない

  Scenario: Case001 の最終判断を解放する
    Given Case001 の必要ノードを確認した
    And 判断根拠を1件以上登録した
    And 矛盾分類を1件以上登録した
    When 最終判断へ進む
    Then 焼却承認と証拠保全と異常記録隔離の3裁定が表示される

  Scenario: Case001 の結果を保存して事件選択へ戻る
    Given Case001 の最終判断画面を開いている
    When いずれかの裁定を確定する
    Then 結果画面に「優先された価値」と「軽視された価値」が表示される
    And 提出根拠と矛盾分類と解析履歴を含む行政処理ログが表示される
    And persona-null:case-results に caseId "case001" の結果が保存される
    When 「事件選択へ戻る」を選択する
    Then 事件選択で Case001 が処理済みとして表示される
    And Case000 または Case001 を再び開ける

  Scenario: Case000 の互換性を維持する
    When Case000 を選択して既存の判断条件を満たす
    Then Case000 の既存3裁定から最終判断できる
    And 既存形式の Case000 保存結果を読み込める
