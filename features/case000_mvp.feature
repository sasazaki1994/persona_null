Feature: Persona Null Case000 playable audit slice
  Persona Null must allow an auditor from 監査室 to inspect KASUMI-GATE-09 / Case000, classify contradictions, make an irreversible decision, and save the result.

  Scenario: Reaching investigation from title
    Given the auditor starts at the Persona Null title screen
    When the auditor starts the audit terminal
    And confirms the city OS briefing
    And selects Case000
    And starts the investigation
    Then the investigation screen shows the Case000 status panes and memory network

  Scenario: Inspecting memory nodes
    Given the auditor is on the investigation screen
    When the auditor selects a memory node in the Three.js network
    Then the node becomes selected
    And its summary, log, simpleFact, and warning are shown
    And the investigation progress increases if it was not previously visited

  Scenario: Blocking judgment before conditions are met
    Given the auditor is on the investigation screen
    When fewer than the required nodes are visited
    Then the final judgment button is disabled
    And judgment blocker reasons are shown

  Scenario: Pinning judgment grounds
    Given the auditor is on the investigation screen
    When the auditor pins evidence nodes
    Then the pinned count is shown as x / 3
    And no more than three pinned nodes can be submitted

  Scenario: Classifying contradiction tags
    Given the auditor selected a node with hasContradiction true or importance critical
    When the auditor applies a contradiction tag
    Then the tag is recorded for that node
    And the contradiction tag count increases

  Scenario: Spending audit resources
    Given the auditor has audit resources remaining
    When the auditor executes an analysis action
    Then one audit resource is consumed
    And the action result is added to the system log
    And the same action is disabled after execution

  Scenario: Preventing analysis without audit resources
    Given audit resources are zero
    Then unexecuted analysis action buttons are disabled
    And the UI reports audit resource insufficiency
    And the auditor can still proceed to final judgment when judgment conditions are met

  Scenario: Unlocking judgment
    Given the auditor is on the investigation screen
    When the auditor visits at least the required number of memory nodes
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

  Scenario: Reporting the submitted audit structure
    Given the auditor has reached the result screen
    Then the result screen shows final ruling, processing, prioritized value, disregarded value, submitted grounds, classified contradictions, city status changes, audit notes, a short ending text, and the Case001 preview

  Scenario: Resilient result persistence
    Given localStorage contains malformed saved result JSON
    When the auditor reaches the result screen
    Then the result screen remains available
    And the save failure is handled without throwing an application error
