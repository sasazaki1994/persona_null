Feature: Case000 playable audit slice
  Persona Null must allow an auditor to inspect Case000, classify contradictions, make an irreversible decision, and save the result.

  Scenario: Reaching the final judgment gate
    Given the auditor starts at the title screen
    When the auditor proceeds through briefing, case selection, and case overview
    Then the investigation screen shows the Case000 memory network

  Scenario: Unlocking judgment
    Given the auditor is on the investigation screen
    When the auditor visits at least the required number of memory nodes
    And pins at least one node as judgment grounds
    And tags at least one eligible contradiction node
    Then the final judgment button becomes enabled

  Scenario: Saving the completed result
    Given the auditor has unlocked final judgment
    When the auditor selects a final decision
    Then the result screen shows final ruling, values, grounds, contradiction tags, analysis actions, city status deltas, audit notes, and the Case001 preview
    And localStorage contains caseId, decisionId, pinnedNodeIds, taggedNodes, executedActionIds, finalStats, and completedAt


  Scenario: Preventing analysis without audit resources
    Given the auditor is on the investigation screen
    And audit resources are zero
    Then unexecuted analysis action buttons are disabled
    And the auditor can still proceed to final judgment when judgment conditions are met

  Scenario: Resilient result persistence
    Given localStorage contains malformed saved result JSON
    When the auditor reaches the result screen
    Then the result screen remains available
    And the save failure is handled without throwing an application error
