import type { AnalysisAction, TaggedNodes } from './types';

export function isAnalysisActionUnlocked(params: {
  action: AnalysisAction;
  visitedNodeIds: string[];
  pinnedNodeIds: string[];
  taggedNodes: TaggedNodes;
}): boolean {
  const taggedNodeIds = Object.entries(params.taggedNodes)
    .filter(([, tags]) => tags.length > 0)
    .map(([nodeId]) => nodeId);

  return (params.action.unlockConditions ?? []).every((condition) => {
    switch (condition.type) {
      case 'visited_nodes':
        return condition.nodeIds.every((nodeId) => params.visitedNodeIds.includes(nodeId));
      case 'pinned_any':
        return params.pinnedNodeIds.length >= condition.count;
      case 'tagged_any':
        return taggedNodeIds.length >= condition.count;
      case 'tagged_node':
        return taggedNodeIds.includes(condition.nodeId);
    }
  });
}

export type JudgmentRequirement = {
  id: 'nodes' | 'pins' | 'tags';
  label: string;
  completed: boolean;
  detail: string;
};

export function hasTaggedContradiction(taggedNodes: TaggedNodes): boolean {
  return Object.values(taggedNodes).some((tags) => tags.length > 0);
}

export function getJudgmentRequirements(params: {
  visitedNodeCount: number;
  requiredNodesToJudge: number;
  pinnedNodeCount: number;
  taggedNodes: TaggedNodes;
}): JudgmentRequirement[] {
  const taggedNodeCount = Object.values(params.taggedNodes).filter((tags) => tags.length > 0).length;

  return [
    {
      id: 'nodes',
      label: '記憶ノード確認',
      completed: params.visitedNodeCount >= params.requiredNodesToJudge,
      detail: `${Math.min(params.visitedNodeCount, params.requiredNodesToJudge)}/${params.requiredNodesToJudge} 完了`,
    },
    {
      id: 'pins',
      label: '提出根拠の登録',
      completed: params.pinnedNodeCount > 0,
      detail: `${params.pinnedNodeCount}/1 必須（最大3）`,
    },
    {
      id: 'tags',
      label: '矛盾分類タグ',
      completed: taggedNodeCount > 0,
      detail: `${taggedNodeCount}/1 必須`,
    },
  ];
}

export function canUnlockJudgment(params: {
  visitedNodeCount: number;
  requiredNodesToJudge: number;
  pinnedNodeCount: number;
  taggedNodes: TaggedNodes;
}): boolean {
  return getJudgmentRequirements(params).every((requirement) => requirement.completed);
}

export type CurrentGuidance = {
  phase: 'review' | 'pin' | 'tag' | 'judge';
  title: string;
  instruction: string;
  action: string;
  resourceNote: string;
};

export function getCurrentGuidance(params: {
  visitedNodeCount: number;
  requiredNodesToJudge: number;
  pinnedNodeCount: number;
  taggedNodeCount: number;
  resources: number;
  canJudge: boolean;
}): CurrentGuidance {
  const resourceNote = params.resources > 0
    ? `任意解析：監査リソース残り${params.resources}件`
    : '任意解析：監査リソース消費済み';

  if (params.visitedNodeCount < params.requiredNodesToJudge) {
    return {
      phase: 'review',
      title: '記憶記録の確認',
      instruction: `記憶ノードを${params.requiredNodesToJudge}件以上確認してください`,
      action: 'Memory Network から未確認ノードを選択',
      resourceNote,
    };
  }

  if (params.pinnedNodeCount < 1) {
    return {
      phase: 'pin',
      title: '判断根拠の登録',
      instruction: '最終判断に使用する根拠を1件以上登録してください',
      action: '選択ノードの「提出根拠に登録」を実行',
      resourceNote,
    };
  }

  if (params.taggedNodeCount < 1) {
    return {
      phase: 'tag',
      title: '矛盾記録の分類',
      instruction: '矛盾対象ノードを1件以上分類してください',
      action: 'halo が強い矛盾ノードを選び、矛盾分類を登録',
      resourceNote,
    };
  }

  return {
    phase: 'judge',
    title: params.canJudge ? '最終判断の提出' : '判断条件の再照合',
    instruction: params.canJudge ? '判断条件に必要な操作は完了しています' : '未完了の判断条件を確認してください',
    action: params.canJudge ? '画面下部の「最終判断へ進む」を選択' : '画面下部の進行チェックリストを確認',
    resourceNote,
  };
}
