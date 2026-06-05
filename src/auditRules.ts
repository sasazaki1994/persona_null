import type { TaggedNodes } from './types';

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
      label: '判断根拠ピン留め',
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
