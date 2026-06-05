Feature: Persona Null Case000 playable audit slice
  Persona Null must allow an auditor from 監査室 to inspect KASUMI-GATE-09 / Case000「誰が撃ったのか」, classify contradictions, make an irreversible decision, and save the submitted audit structure locally.
  Case001「焼却されなかった声」 must remain locked preview content only.

  Background:
    Given the app is running as a React Vite TypeScript single page app
    And the playable case dataset contains only Case000
    And Case000 has 6 memory nodes, 3 audit resources, 3 analysis actions, and 3 final decisions

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
    And visited nodes become visually more stable than unvisited nodes

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

  Scenario: Classifying contradiction tags
    Given the auditor selected a node with hasContradiction true or importance critical
    When the auditor applies a contradiction tag
    Then the tag is recorded for that node
    And the classification action appends a system log entry
    And the contradiction tag count increases
    And the available tag set is body_auth, persona_signature, memory_origin, operation_subject, legal_persona, and record_integrity

  Scenario: Rejecting contradiction tags on ineligible nodes
    Given the auditor selected a node with hasContradiction false and importance standard or high
    Then contradiction tag buttons are disabled
    And no contradiction tag is recorded for that node

  Scenario: Spending audit resources
    Given the auditor has audit resources remaining
    When the auditor executes an analysis action
    Then one audit resource is consumed
    And the action result is added to the system log
    And the same action is disabled after execution

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
