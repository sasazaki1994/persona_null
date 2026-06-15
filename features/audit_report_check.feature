Feature: 最終判断前に監査報告書の整理状態を確認する
  監査官は正解判定や裁定禁止を受けず、未整理の争点と不足している調査操作を確認できる。

  Scenario: 調査開始直後の報告状態を表示する
    Given Case000 または Case001 の調査を開始した
    Then JUDGMENT CONSOLE に「監査報告書チェック」が表示される
    And 報告状態は「裁定条件未達」である
    And 未確認争点、根拠未登録、矛盾分類未登録、追加解析なしが監査上の注意に表示される

  Scenario: 調査操作を報告書へ反映する
    Given 監査報告書チェックが表示されている
    When 記憶ノードを確認する
    Then 記録確認数と関連争点の確認数が更新される
    When 判断根拠を登録する
    Then 提出根拠数が更新される
    When 矛盾分類を登録する
    Then 矛盾分類数が更新される

  Scenario: 未整理の争点を残したまま裁定する
    Given 既存の最終判断解放条件を満たした
    And 未確認または weak の争点が残っている
    Then 報告状態は「裁定可能」である
    And 監査上の注意は裁定を禁止しない
    When 最終判断へ進む
    Then DecisionScreen に監査報告書状態の summary が表示される

  Scenario: 保存互換性を維持する
    When 監査報告書チェックを確認して裁定を確定する
    Then ResultScreen に監査報告書チェックを保存しない
    And SavedCaseResult と localStorage の保存形式は変更されない
