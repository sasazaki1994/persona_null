# Persona Null MVP Spec — Case000

## Scope
- Implement a playable vertical slice for `Persona Null` handled by `監査室` under record `KASUMI-GATE-09`.
- Flow: TitleScreen → AuthBriefingScreen → CaseSelectScreen → CaseOverviewScreen → InvestigationScreen → DecisionScreen → ResultScreen.
- Implement only `Case000: 誰が撃ったのか` / `操作主体が確定できません`.
- Do not implement Case001. Display only a preview notice on the result screen.
- External APIs are not used. Case data is fixed in `src/data/cases.ts`.

## Domain Model
- Case data is managed as TypeScript objects shaped like JSON records.
- Memory nodes include title, type, importance, summary, log, simpleFact, inspectorNote, warning, metrics, hasContradiction, position, and links.
- Game state tracks visited nodes, pinned nodes, tagged contradictions, executed analysis actions, audit resources, decision, final city stats, completed cases, and read flags.
- Save data and read flags are stored in localStorage; malformed JSON, invalid saved result entries, or storage failures are logged and do not crash the game.

## Rules
- Visiting a node adds the node id to `visitedNodeIds` and updates investigation progress.
- Up to three nodes may be pinned as judgment grounds.
- Contradiction tags may be added only to nodes with `hasContradiction: true` or `importance: critical`.
- Tags are selected from `body_auth`, `persona_signature`, `memory_origin`, `operation_subject`, `legal_persona`, and `record_integrity`.
- Each case starts with 3 audit resources.
- Analysis actions consume one audit resource each.
- Final judgment remains possible even when resources are zero.
- Analysis action buttons are disabled when the action is already executed or audit resources are zero.
- When audit resources are zero, the UI shows `監査リソース不足：追加解析を実行できません`.
- Final judgment unlocks when required visited node count is met, at least one pinned node exists, and at least one eligible node is tagged.
- Result arrival saves the completed case to localStorage. Completion indicators update only after persistence succeeds.
- Case001「焼却されなかった声」は selectable contentではなく、locked/preview noticeとしてのみ表示する。

## UI
- Investigation view uses four areas: left case/status pane, center Three.js memory network, right node detail/action pane, and bottom judgment/log pane.
- Left pane shows case number, overview, investigation progress, audit resources remaining/max, judgment grounds count out of 3, and contradiction tag count.
- Center pane shows floating memory nodes connected with lines. Clicking a node selects it. Critical nodes have stronger jitter/noise/glow, selected nodes are clearly enlarged, visited nodes stabilize, hover is highlighted, and the `KASUMI-GATE-09` node behaves more erratically than ordinary nodes.
- Right pane shows the selected node summary, log, simpleFact, warning, pin/unpin controls, eligible contradiction tags, and analysis actions.
- Bottom pane shows judgment blockers as a checklist with remaining counts, a judgment button, system logs, and irreversible judgment warning copy.
- Result screen is formatted as an administrative processing log with separated sections for final ruling, processing, protected value, discarded value, submitted grounds, contradiction classifications, executed analysis, city status deltas, audit note, and ending text.
- Tone is administrative and audit-log oriented. Visual design uses black/gray/white/cyan with restrained warning colors.

## Acceptance Spec (Gherkin)

```gherkin
Feature: Persona Null Case000 MVP
  Scenario: Player can reach investigation from title
    Given the player opens the app
    When the player starts the audit terminal
    And confirms the city OS briefing
    And selects Case000
    And starts the investigation
    Then the investigation screen shows Case000 status panes and the memory network

  Scenario: Player can inspect memory nodes
    Given the player is on the investigation screen
    When the player clicks a memory node
    Then that node becomes selected
    And its summary, log, simpleFact, and warning are shown
    And the investigation progress increases if the node was not visited before

  Scenario: Judgment is blocked until audit conditions are met
    Given the player is on the investigation screen
    When fewer than the required nodes are visited
    Then the final judgment button is disabled
    And judgment blocker messages are shown

  Scenario: Player can pin up to three judgment grounds
    Given the player is on the investigation screen
    When the player pins evidence nodes
    Then the pinned count is shown as x / 3
    And a fourth unpinned node cannot be added until one pin is removed

  Scenario: Player can classify contradictions on eligible nodes
    Given the player selected a node with hasContradiction true or importance critical
    When the player chooses a contradiction tag
    Then the tag is recorded for that node
    And the contradiction tag count increases

  Scenario: Player can spend audit resources on analysis actions
    Given the player has audit resources remaining
    When the player executes an analysis action
    Then one audit resource is consumed
    And the action result is appended to system logs
    And the same action cannot be executed again

  Scenario: Resource depletion does not block final judgment
    Given the player has spent all audit resources
    Then the UI shows audit resource insufficiency for additional analysis
    But final judgment can unlock when node, pin, and tag requirements are satisfied

  Scenario: Player can choose one of three final rulings
    Given the required node, pin, and tag conditions are satisfied
    When the player opens final judgment
    Then choices A, B, and C are available
    When the player selects a choice
    Then the result screen is shown
    And localStorage receives the completed case result

  Scenario: Result screen reports the player's submitted audit structure
    Given the player reached the result screen
    Then the screen shows final ruling, processing, prioritized value, disregarded value, submitted judgment grounds, classified contradictions, city status changes, and a short ending text
```
