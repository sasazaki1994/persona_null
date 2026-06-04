# Persona Null MVP Spec — Case000

## Scope
- Implement a playable vertical slice for `Case000: 誰が撃ったのか`.
- Flow: TitleScreen → AuthBriefingScreen → CaseSelectScreen → CaseOverviewScreen → InvestigationScreen → DecisionScreen → ResultScreen.
- Do not implement Case001. Display only a preview notice on the result screen.

## Domain Model
- Case data is managed as TypeScript objects.
- Memory nodes include title, type, importance, summary, log, simpleFact, inspectorNote, warning, metrics, and hasContradiction.
- Game state tracks visited nodes, pinned nodes, tagged contradictions, executed analysis actions, resources, decision, and final city stats.

## Rules
- Visiting a node adds the node id to `visitedNodeIds` and updates investigation progress.
- Up to three nodes may be pinned as judgment grounds.
- Contradiction tags may be added only to nodes with `hasContradiction: true` or `importance: critical`.
- Analysis actions consume one audit resource each. Final judgment remains possible even when resources are zero.
- Final judgment unlocks when required visited node count is met, at least one pinned node exists, and at least one eligible node is tagged.
- Result arrival saves the completed case to localStorage.

## UI
- Investigation view uses four areas: left case/status pane, center Three.js memory network, right node detail/action pane, and bottom judgment/log pane.
- Tone is administrative and audit-log oriented.
