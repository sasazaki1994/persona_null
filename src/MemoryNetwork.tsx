import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { case000 } from './case000';
import type { MemoryNode, NodeImportance, TaggedNodes } from './types';

type Props = {
  nodes: MemoryNode[];
  selectedNodeId?: string | null;
  visitedNodeIds: string[];
  pinnedNodeIds: string[];
  taggedNodes: TaggedNodes;
  executedActionIds: string[];
  onSelectNode: (nodeId: string) => void;
};

const importanceColors = {
  standard: '#5ee7ff',
  high: '#ffb84d',
  critical: '#ff476f',
} as const;

const importanceLabels: Record<NodeImportance, string> = {
  standard: '標準',
  high: '高',
  critical: '重大',
};

function requiresContradictionReview(node: MemoryNode) {
  return node.requiresContradictionReview ?? (node.suggestedTags?.length ?? 0) > 0;
}

export function MemoryNetwork({
  nodes,
  selectedNodeId,
  visitedNodeIds,
  pinnedNodeIds,
  taggedNodes,
  executedActionIds,
  onSelectNode,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelectNode);
  const hoverRef = useRef<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const analyzedNodeIds = useMemo(() => new Set(
    case000.analysisActions
      .filter((action) => executedActionIds.includes(action.id))
      .flatMap((action) => action.targetNodeIds ?? []),
  ), [executedActionIds]);
  const labelNode = nodes.find((node) => node.id === (hoveredNodeId ?? selectedNodeId)) ?? null;

  useEffect(() => {
    onSelectRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#03070d');
    scene.fog = new THREE.FogExp2('#03070d', 0.052);

    const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.domElement.className = 'network-canvas';
    host.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight('#9fdcff', 1.15);
    scene.add(ambient);
    const point = new THREE.PointLight('#8cf7ff', 20, 22);
    point.position.set(0, 2, 5);
    scene.add(point);

    const grid = new THREE.GridHelper(14, 28, '#315d73', '#153243');
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -2.3;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.16;
      material.depthWrite = false;
    });
    scene.add(grid);

    const particlePositions = new Float32Array(210 * 3);
    for (let index = 0; index < 210; index += 1) {
      const offset = index * 3;
      particlePositions[offset] = ((index * 47) % 211) / 211 * 12 - 6;
      particlePositions[offset + 1] = ((index * 83) % 223) / 223 * 7 - 3.5;
      particlePositions[offset + 2] = -2.7 - ((index * 31) % 100) / 42;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: '#79b4c5',
      opacity: 0.3,
      transparent: true,
      size: 0.018,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const networkGroup = new THREE.Group();
    scene.add(networkGroup);
    const nodeMeshes = new Map<string, THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>>();
    const stateObjects = new Map<string, THREE.Object3D[]>();
    const linkLines: THREE.Line[] = [];
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    nodes.forEach((node) => {
      node.links.forEach((targetId) => {
        const target = nodeById.get(targetId);
        if (!target || node.id > targetId) return;
        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(...node.position),
          new THREE.Vector3(...target.position),
        ]);
        const material = new THREE.LineBasicMaterial({ color: '#5cced0', transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false });
        const line = new THREE.Line(geometry, material);
        networkGroup.add(line);
        linkLines.push(line);
      });
    });

    nodes.forEach((node) => {
      const color = importanceColors[node.importance];
      const radius = node.importance === 'critical' ? 0.22 : 0.16;
      const geometry = new THREE.SphereGeometry(radius, 32, 16);
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: node.importance === 'critical' ? 1.5 : 0.7,
        roughness: 0.24,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...node.position);
      mesh.userData.nodeId = node.id;
      networkGroup.add(mesh);
      nodeMeshes.set(node.id, mesh);

      const objects: THREE.Object3D[] = [];
      const makeRing = (ringRadius: number, tube = 0.009, opacity = 0.7) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(ringRadius, tube, 8, 48),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
        );
        ring.position.copy(mesh.position);
        ring.visible = false;
        networkGroup.add(ring);
        objects.push(ring);
        return ring;
      };

      const baseHalo = new THREE.Mesh(
        new THREE.SphereGeometry(radius + 0.08, 24, 12),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, wireframe: true, depthWrite: false }),
      );
      baseHalo.position.copy(mesh.position);
      networkGroup.add(baseHalo);
      objects.push(baseHalo);

      const selectedInner = makeRing(radius + 0.11, 0.012, 0.9);
      selectedInner.userData.state = 'selected-inner';
      const selectedOuter = makeRing(radius + 0.2, 0.008, 0.58);
      selectedOuter.userData.state = 'selected-outer';
      const classifiedRing = makeRing(radius + 0.14, 0.006, 0.58);
      classifiedRing.userData.state = 'classified';
      const criticalRing = makeRing(radius + 0.27, 0.008, 0.64);
      criticalRing.material.color.set('#ff5c72');
      criticalRing.userData.state = 'critical';
      const contradictionRing = makeRing(radius + 0.2, 0.006, 0.38);
      contradictionRing.material.color.set('#ff405f');
      contradictionRing.userData.state = 'contradiction';

      const evidenceGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry((radius + 0.17) * 2, (radius + 0.17) * 2, 0.02));
      const evidenceFrame = new THREE.LineSegments(
        evidenceGeometry,
        new THREE.LineBasicMaterial({ color: '#b7d6dd', transparent: true, opacity: 0.76 }),
      );
      evidenceFrame.position.copy(mesh.position);
      evidenceFrame.rotation.z = Math.PI / 4;
      evidenceFrame.visible = false;
      evidenceFrame.userData.state = 'evidence';
      networkGroup.add(evidenceFrame);
      objects.push(evidenceFrame);

      const warningHalo = new THREE.Mesh(
        new THREE.SphereGeometry(radius + 0.17, 24, 12),
        new THREE.MeshBasicMaterial({ color: '#ff476f', transparent: true, opacity: 0.22, wireframe: true, depthWrite: false }),
      );
      warningHalo.position.copy(mesh.position);
      warningHalo.visible = false;
      warningHalo.userData.state = 'warning';
      networkGroup.add(warningHalo);
      objects.push(warningHalo);

      const analysisMarker = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.OctahedronGeometry(radius + 0.2, 0)),
        new THREE.LineBasicMaterial({ color: '#d8f4f7', transparent: true, opacity: 0.46 }),
      );
      analysisMarker.position.copy(mesh.position);
      analysisMarker.visible = false;
      analysisMarker.userData.state = 'analysis';
      networkGroup.add(analysisMarker);
      objects.push(analysisMarker);
      stateObjects.set(node.id, objects);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects([...nodeMeshes.values()]);
    };

    const updateHoveredNode = (nodeId: string | null) => {
      if (hoverRef.current === nodeId) return;
      hoverRef.current = nodeId;
      setHoveredNodeId(nodeId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      const nodeId = updatePointer(event)[0]?.object.userData.nodeId as string | undefined;
      updateHoveredNode(nodeId ?? null);
      renderer.domElement.style.cursor = nodeId ? 'pointer' : 'default';
    };
    const handlePointerLeave = () => updateHoveredNode(null);
    const handlePointerDown = (event: PointerEvent) => {
      const nodeId = updatePointer(event)[0]?.object.userData.nodeId as string | undefined;
      if (nodeId) onSelectRef.current(nodeId);
    };
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    const handleResize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      nodeMeshes.forEach((mesh, nodeId) => {
        const node = nodeById.get(nodeId);
        if (!node) return;
        const selected = nodeId === selectedNodeId;
        const hovered = nodeId === hoverRef.current;
        const visited = visitedNodeIds.includes(nodeId);
        const pinned = pinnedNodeIds.includes(nodeId);
        const classified = (taggedNodes[nodeId]?.length ?? 0) > 0;
        const unclassified = requiresContradictionReview(node) && !classified;
        const analyzed = analyzedNodeIds.has(nodeId);
        const baseColor = importanceColors[node.importance];
        const unreadPulse = reduceMotion || visited ? 1 : 1 + Math.sin(elapsed * 1.8 + mesh.position.x) * 0.045;
        const contradictionPulse = reduceMotion || !node.hasContradiction ? 1 : 1 + Math.sin(elapsed * 2.4 + mesh.position.y) * 0.035;
        const selectedScale = selected ? 1.5 : hovered ? 1.26 : 1;
        mesh.scale.setScalar(selectedScale * unreadPulse * contradictionPulse * (visited && !selected && !hovered ? 0.93 : 1));
        mesh.material.color.set(visited && !selected ? '#38535a' : node.hasContradiction ? '#d9495f' : baseColor);
        mesh.material.emissive.set(node.hasContradiction ? '#ff314f' : baseColor);
        mesh.material.emissiveIntensity = selected ? 2.8 : hovered ? 1.9 : visited ? 0.2 : 0.92 + (reduceMotion ? 0 : Math.sin(elapsed * 1.8 + mesh.position.x) * 0.16);

        stateObjects.get(nodeId)?.forEach((object) => {
          object.position.copy(mesh.position);
          const state = object.userData.state as string | undefined;
          if (!state) {
            const halo = object as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
            halo.material.opacity = visited ? 0.06 : 0.13;
            halo.rotation.set(elapsed * 0.08, elapsed * 0.06, 0);
          } else if (state.startsWith('selected')) {
            object.visible = selected;
            object.rotation.z = reduceMotion ? 0 : elapsed * (state === 'selected-outer' ? -0.24 : 0.18);
          } else if (state === 'evidence') object.visible = pinned;
          else if (state === 'warning') object.visible = unclassified;
          else if (state === 'classified') object.visible = classified;
          else if (state === 'critical') {
            object.visible = node.importance === 'critical';
            object.rotation.z = reduceMotion ? 0 : elapsed * 0.11;
          } else if (state === 'contradiction') {
            object.visible = node.hasContradiction;
            const ring = object as THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
            ring.material.opacity = reduceMotion ? 0.32 : 0.25 + (Math.sin(elapsed * 2.2 + mesh.position.x) + 1) * 0.1;
            object.rotation.z = reduceMotion ? 0 : Math.sin(elapsed * 0.9 + mesh.position.y) * 0.16;
          } else if (state === 'analysis') object.visible = analyzed;
        });
      });
      linkLines.forEach((line, index) => {
        const material = line.material as THREE.LineBasicMaterial;
        material.opacity = reduceMotion ? 0.3 : 0.28 + (Math.sin(elapsed * 0.7 + index) + 1) * 0.06;
      });
      const drift = reduceMotion ? 0 : Math.sin(elapsed * 0.12) * 0.025;
      networkGroup.rotation.y = drift;
      particles.position.x = reduceMotion ? 0 : Math.sin(elapsed * 0.06) * 0.12;
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleResize);
      hoverRef.current = null;
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
      scene.traverse((object) => {
        const disposable = object as THREE.Mesh;
        if (disposable.geometry) disposable.geometry.dispose();
        const materials = disposable.material ? (Array.isArray(disposable.material) ? disposable.material : [disposable.material]) : [];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
    };
  }, [analyzedNodeIds, nodes, pinnedNodeIds, selectedNodeId, taggedNodes, visitedNodeIds]);

  const labelStates = labelNode ? [
    visitedNodeIds.includes(labelNode.id) ? '確認済' : '未確認',
    labelNode.id === selectedNodeId ? '選択中' : null,
    pinnedNodeIds.includes(labelNode.id) ? '根拠提出済' : '根拠未提出',
    requiresContradictionReview(labelNode)
      ? ((taggedNodes[labelNode.id]?.length ?? 0) > 0 ? '矛盾分類済' : '矛盾未分類')
      : '矛盾分類対象外',
    analyzedNodeIds.has(labelNode.id) ? '解析結果あり' : '解析結果なし',
  ].filter((state): state is string => Boolean(state)) : [];

  return (
    <div className="network" ref={hostRef} aria-label="記憶ノードネットワーク">
      <div className="network-scanlines" aria-hidden="true" />
      {labelNode && (
        <aside className="network-node-label" aria-live="polite">
          <p>{hoveredNodeId ? 'HOVER RECORD' : 'SELECTED RECORD'} / {labelNode.id}<span>{labelNode.id === selectedNodeId ? 'SCAN LOCKED' : 'SIGNAL TRACE'}</span></p>
          <h3>{labelNode.title}</h3>
          <dl>
            <div><dt>記録種別</dt><dd>{labelNode.type}</dd></div>
            <div><dt>重要度</dt><dd>{importanceLabels[labelNode.importance]}</dd></div>
            <div><dt>記録状態</dt><dd>{visitedNodeIds.includes(labelNode.id) ? '確認済' : '未確認'}</dd></div>
          </dl>
          <div className="network-node-states">
            {labelStates.map((state) => <span key={state}>{state}</span>)}
          </div>
        </aside>
      )}
    </div>
  );
}
