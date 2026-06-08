Feature: Persona Null Case000 playable audit slice
  Persona Null must allow an auditor from 監査室 to inspect KASUMI-GATE-09 / Case000「誰が撃ったのか」, classify contradictions, make an irreversible decision, and save the submitted audit structure locally.
  Case001「焼却されなかった声」 must remain locked preview content only.

  Background:
    Given the app is running as a React Vite TypeScript single page app
    And the playable case dataset contains only Case000
    And Case000 has 7 memory nodes, 3 audit resources, 3 analysis actions, and 3 final decisions

  Scenario: Reaching investigation from title
    Given the auditor starts at the Persona Null title screen
    When the auditor starts the audit terminal
    And confirms the city OS briefing
    And selects Case000
    And starts the investigation
    Then the investigation screen shows the Case000 status panes and memory network
    And the Case001 card is shown only as locked preview content

  Scenario: Inspecting memory nodes in the Three.js network
    Given the auditor is on the investigation screen
    When the auditor selects a memory node in the Three.js network
    Then the node becomes selected
    And its summary, log, simpleFact, inspectorNote, warning, and metrics are shown
    And the investigation progress increases if it was not previously visited
    And node importance is identified by labeled colors: standard cyan, high amber, and critical red or pink
    And critical nodes do not use jitter, flashing, or positional noise to communicate importance

  Scenario: Distinguishing reviewed memory nodes from unreviewed nodes
    Given the auditor is on the investigation screen
    Then no memory node is selected initially
    And the right pane asks the auditor to select a memory node from the issue list or Memory Network
    And the left pane lists every memory node as 未確認, 確認済, or 選択中
    And the remaining unreviewed node count is visible at a glance
    When the auditor selects an unreviewed node from the left pane list
    Then the same node is selected in the investigation workspace
    And the selected node is added to visitedNodeIds
    And the previously selected reviewed node is shown as 確認済 after another node is selected
    And the node detail header shows its 記録状態 and 記録種別
    And the memory network renders unreviewed nodes slightly brighter than reviewed nodes
    And selected nodes remain more strongly emphasized than either review state

  Scenario: Keeping the desktop investigation workspace in one viewport
    Given the auditor is on the investigation screen with a desktop viewport at least 900 pixels wide
    Then the four investigation regions remain arranged within one viewport
    And the page itself does not require vertical scrolling
    And overflow is contained within the relevant pane when necessary

  Scenario: Blocking judgment before conditions are met
    Given the auditor is on the investigation screen
    When fewer than 4 memory nodes have been visited
    Then the final judgment button is disabled
    And judgment blocker reasons are shown as a checklist
    And the checklist includes node visit count, pinned ground count, and contradiction classification status

  Scenario: Pinning judgment grounds
    Given the auditor is on the investigation screen
    When the auditor pins evidence nodes
    Then the pinned count is shown as x / 3
    And no more than three pinned nodes can be submitted
    And a fourth node cannot be pinned until one existing pin is removed
    And pinning or unpinning evidence appends a system log entry

  Scenario: Building an audit report from issue-grouped records
    Given the auditor is on the investigation screen
    Then the left pane groups memory nodes under operation subject, legal persona, and public order issues
    And each issue shows a short description and its related clickable memory nodes
    And each issue shows reviewed and submitted evidence counts for its related nodes
    And each related node shows 未確認 or 確認済 together with any applicable 選択中, 根拠提出済, and 矛盾分類済 badges
    When the auditor selects an important memory node with an auditHint
    Then the node detail shows a "監査官メモ" without asserting a final answer
    And the evidence registration control is labeled "提出根拠に登録"

  Scenario: Showing only node-specific contradiction candidates
    Given the auditor selected a memory node with suggested contradiction tags
    Then only that node's suggestedTags are shown as contradiction classification buttons
    And tags not suggested for that node are not shown
    When the auditor applies a shown contradiction tag
    Then the tag is recorded for that node
    And the classification action appends a system log entry
    And the contradiction tag count increases

  Scenario: Hiding classification controls for a record without candidates
    Given the auditor selected a memory node whose suggestedTags are empty or undefined
    Then no contradiction classification button is shown
    And the UI reports "この記録に分類可能な矛盾は検出されていません"

  Scenario: Unlocking analysis actions through record review
    Given the auditor is on the investigation screen
    Then unmet analysis actions are disabled
    And each unmet analysis action shows its required records or operations
    When every unlock condition for an analysis action is satisfied
    Then that analysis action becomes enabled
    And other analysis actions remain disabled until their own conditions are satisfied

  Scenario: Spending audit resources
    Given the auditor has audit resources remaining
    When the auditor executes an analysis action
    Then one audit resource is consumed
    And the action result is added to the system log
    And the same action is disabled after execution
    And the action report is shown as an additional analysis result on each target memory node

  Scenario: Preventing analysis without audit resources
    Given audit resources are zero
    Then unexecuted analysis action buttons are disabled
    And the UI reports "監査リソース不足：追加解析を実行できません。"
    And the auditor can still proceed to final judgment when judgment conditions are met

  Scenario: Unlocking judgment
    Given the auditor is on the investigation screen
    When the auditor visits at least 4 memory nodes
    And pins at least one node as judgment grounds
    And tags at least one eligible contradiction node
    Then the final judgment button becomes enabled

  Scenario: Choosing a final decision
    Given the auditor has unlocked final judgment
    When the auditor opens the final judgment screen
    Then choices A, B, and C are available
    And every choice shows adopted evidence, ignored or deferred issues, and city status effects
    And adopted evidence indicates whether it is 根拠提出済 or 未提出
    And every choice summarizes how many adopted evidence nodes match the submitted grounds
    And a choice with adopted evidence but zero matching submitted grounds warns that its adopted evidence is unsubmitted
    And the warning does not disable that choice
    When the auditor selects a final decision
    Then the result screen is shown
    And localStorage contains caseId, decisionId, pinnedNodeIds, taggedNodes, executedActionIds, finalStats, and completedAt
    And the completed case indicator updates only after persistence succeeds

  Scenario: Reporting the submitted audit structure
    Given the auditor has reached the result screen
    Then the result screen shows separated administrative-log sections for final ruling, processing, prioritized value, disregarded value, submitted judgment grounds, classified contradictions, executed analysis actions, city status changes, audit notes, a short ending text, and the Case001 preview
    And the result screen does not introduce a playable Case001 route

  Scenario: Resilient result persistence
    Given localStorage contains malformed saved result JSON
    When the auditor reaches the result screen
    Then the result screen remains available
    And invalid saved result entries are ignored
    And the save failure is handled without throwing an application error

  Scenario: Read flag persistence
    Given the auditor confirms the city OS briefing
    Then localStorage stores the read flag "city-os-briefing" under "persona-null:read-flags"
    And a malformed read flag payload does not prevent the app from opening

  Scenario: Loading the strengthened Case000 scenario data
    Given the auditor opens Case000
    Then Case000 has exactly 7 memory nodes
    And the nodes include "七瀬未織の媒体" and "都市警備局の処理要求"
    And every memory node contains summary, log, simpleFact, warning, and metrics
    And the scenario exposes one short person log for 間宮怜司
    And 間宮怜司 is identified as a 都市警備局 捜査官
    And 操作主体, 操作経路, and 操作源 remain control-system terms
    And no deprecated urban-security investigator title remains in source, specs, or documentation
    And the scenario exposes exactly 3 operation subject candidates
    And the Case001 preview is connected from 七瀬未織の媒体 without creating a playable Case001 route
    And MVP cut items are separated from expansion backlog items

  Scenario: Jam submission readiness checklist
    Given the maintainer prepares the Case000 Jam submission build
    Then Jam submission documentation describes the title, summary, overview, controls, implemented scope, unimplemented scope, start, build, test, technology stack, MVP acceptance conditions, and future expansion candidates
    And the repository README links to docs/jam-submission.md for the detailed Jam checklist
    And Markdown files are forced to text diffs and the root README is stored as UTF-8 text so GitHub and review tools can render it instead of treating it as a binary file
    And package-lock.json is committed for reproducible npm installs
    And npm ci succeeds without changing the package.json scripts
    And GitHub Actions CI runs npm ci, npm run lint, npm run test, and npm run build on push and pull_request using Node.js 20
    And the README links to Vercel deployment instructions that use the Vite preset, npm run build, and the dist output directory
    And the deployment documentation states that no environment variables are required
    And the README has a Demo / Play URL field near the top even before the Production URL is finalized
    And the README screenshot section references docs/images/title.png, docs/images/case000-investigation.png, and docs/images/case000-result.png with short captions
    And the screenshot capture plan explains how to replace those three files before submission
    And Production verification details are authoritative in docs/deploy.md instead of being duplicated across README and the Jam checklist
    And the submission checklist requires title, investigation, and result screenshots before the final Jam submission
    And npm run build succeeds
    And npm run lint succeeds
    And npm run test succeeds
    And Case000 remains playable from title screen to result screen
    And Case001 remains previewOnly locked preview content without a playable route

  Scenario: Final pre-submission verification
    Given the maintainer has a Vercel Production URL for the Jam build
    Then the title screen is visible at that URL
    And Case000 can be played through to the result screen
    And all 7 nodes, evidence pinning, contradiction tagging, and final judgment can be verified
    And the result shows the ruling, processing, values, audit note, and Case001 preview
    And reloading after completion allows the Case000 processed indicator to be verified
    And Case001 remains previewOnly without a playable route
    And the checklist states that mobile is minimally readable while a PC browser is recommended
    And at widths up to 899px the investigation panes stack into one column
    And at widths up to 520px headings, controls, captions, and logs remain readable without page-level horizontal overflow

  Scenario: Restoring audit text with accessible glossary annotations
    Given the auditor opens the city OS briefing or a Case000 record
    Then registered terms such as 義体, 都市OS, 人格署名, 法的人格, 間宮怜司, and 七瀬未織 expose glossary annotations
    And annotations can be opened by pointer hover, keyboard focus, or click and tap
    When the auditor switches the selected investigation node
    Then the selected node summary and inspector note restart a lightweight typewriter presentation
    And only the latest system log uses the typewriter presentation
    And the auditor can reveal the full text immediately by clicking the presentation or its full-text button
    And reduced-motion users receive the full text without typing or cursor animation
    And Case000 progression, judgment conditions, persistence, and the Case001 preview-only restriction remain unchanged

  Scenario: Guiding the auditor through the next required investigation action
    Given the auditor is on the investigation screen
    Then the left pane shows the next audit procedure
    And node review is guided before evidence pinning
    And evidence pinning is guided before contradiction classification
    And final judgment is guided after all judgment conditions are complete
    And remaining audit resources are shown only as optional analysis information

  Scenario: Explaining selected-node actions and final judgment progress
    Given the auditor is on the investigation screen
    When a memory node is selected
    Then the right pane states whether the node is reviewed, pinnable, or eligible for contradiction classification
    And the bottom pane is titled "最終判断まで"
    And node review, evidence pinning, and contradiction classification are shown as a progress checklist

  Scenario: Distinguishing actionable memory nodes without excessive motion
    Given the auditor is on the investigation screen
    Then unreviewed nodes use the normal glow
    And reviewed nodes are dimmed
    And the selected node is emphasized
    And a node requiring contradiction review uses a slightly stronger halo until classified
    And no flashing, jitter, or positional noise is added

  Scenario: Reading audit state directly from the Memory Network
    Given the auditor is on the investigation screen
    Then importance remains encoded by the existing standard, high, and critical colors
    And selected nodes use a double ring
    And submitted evidence nodes use an angular evidence frame
    And unclassified contradiction nodes use a stronger non-flashing warning halo
    And classified contradiction nodes use a closed thin ring
    And reviewed nodes remain visible with reduced glow
    And analysis target nodes expose an analysis-result marker
    When the auditor hovers or selects a memory node
    Then the center pane shows its title, record type, importance, review state, evidence state, contradiction state, and analysis-result state

  Scenario: Presenting a restrained administrative audit terminal
    Given the auditor opens Case000
    Then panels use thin rules, clipped corners, and low-saturation blue-white text
    And red is reserved for warnings and irreversible processing
    And actionable controls are visually distinct from informational displays
    And the Memory Network background contains a subtle grid, distant particles, and weak scanlines
    And ambient movement is slow and does not flash, jitter, or obstruct operation

  Scenario: Stamping the final administrative ruling
    Given the auditor confirms a final judgment
    Then the result screen shows a translucent ruling stamp matching 暫定拘束, 証拠凍結, or 媒体起因処理
    And the ruling stamp remains visually prominent without obscuring the administrative log

  Scenario: 調査画面の右ペインは監査情報を固定順で表示する
    Given プレイヤーが Case000 の調査画面を開いている
    When inspectorNote を持つ記憶ノードを1件選択する
    Then 右ペインが選択したノードの内容へ更新される
    And ノードタイトル、summary、単純事実、監査官メモ、警告の順に初期表示される
    And 監査官メモは単純事実の直下かつ警告と詳細ログより上に表示される
    And 詳細ログは「詳細記録を表示」に格納される
    And metrics と追加解析結果などの追加情報は詳細ログより後に表示される
    And 解析アクション一覧は「解析メニューを表示」に格納される
    And システムログは最新1件だけ初期表示される

  Scenario: inspectorNote がない記憶ノードでは監査官メモを省略する
    Given プレイヤーが Case000 の調査画面を開いている
    When inspectorNote がない記憶ノードを1件選択する
    Then 監査官メモのセクションは表示されない
    And 単純事実の次に警告が表示される

  Scenario: 展開操作で下部の詳細情報を確認できる
    Given プレイヤーが Case000 の調査画面を開いている
    When 「詳細記録を表示」を展開する
    Then 詳細ログと metrics と追加情報をこの順で確認できる
    When 「解析メニューを表示」を展開する
    Then 各解析アクションと未解放条件を確認できる

  Scenario: 最終判断カードは要約から詳細へ段階表示する
    Given プレイヤーが最終判断条件を満たしている
    When 最終判断画面を開く
    Then 各裁定案の価値と都市ステータス変動と確定ボタンが初期表示される
    And 採用根拠と提出根拠との一致と保留疑点は「裁定詳細を表示」に格納される

  Scenario: MemoryNode本文で事実と監査解釈を分離する
    Given プレイヤーが Case000 の対象記憶ノードを選択する
    Then simpleFact は2文から3文で構成される
    And simpleFact は当該記録から確実に確認できる事実だけを示す
    And inspectorNote は2文から4文で構成される
    And inspectorNote は監査上の注意点と次に疑うべき矛盾軸と裁定上の含意を示す
    And summary と log と warning の情報量は従来の表示密度を維持する
    And 七瀬未織の媒体と最後の通信は未焼却音声を Case001 へ保全する含意を示す
