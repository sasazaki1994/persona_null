Feature: 事件をまたぐ監査傾向を蓄積表示する
  Case000 と Case001 の確定済み裁定から、監査室が優先・軽視した価値と都市への影響を参照できる。

  Background:
    Given 監査端末を起動して都市OS通知を確認した

  Scenario: 裁定記録がない
    Given persona-null:case-results に有効な裁定記録がない
    When 事件ファイル選択を開く
    Then 「監査傾向：未記録」と表示される

  Scenario: Case000 または Case001 の裁定を集計する
    Given Case000 または Case001 の最終裁定が保存されている
    When 事件ファイル選択を開く
    Then 「監査傾向」パネルが事件ファイル一覧より前に表示される
    And 人格断片保護と記録整合性優先と危険源隔離と証拠保全の優先回数が表示される
    And 各価値の軽視回数が表示される
    And 保存された finalStats に基づく都市ステータス累積変動が表示される

  Scenario: 結果から事件選択へ戻る
    Given Case000 または Case001 の裁定を確定した
    Then 結果画面に「この裁定は、以後の未確定人格案件における参照基準として保存されます。」と表示される
    When 事件選択へ戻る
    Then 直前の裁定が監査傾向に反映される

  Scenario: 保存データが破損している
    Given persona-null:case-results が不正な JSON または未知の事件・裁定を含む
    When 事件ファイル選択を開く
    Then 画面は継続して表示される
    And 集計可能な有効裁定がなければ「監査傾向：未記録」と表示される
