import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { MemoryNode, TaggedNodes } from './types';

type Props = {
  nodes: MemoryNode[];
  selectedNodeId?: string;
  visitedNodeIds: string[];
  taggedNodes: TaggedNodes;
  onSelectNode: (nodeId: string) => void;
};

const importanceColors = {
  standard: '#5ee7ff',
  high: '#ffb84d',
  critical: '#ff476f',
} as const;

export function MemoryNetwork({ nodes, selectedNodeId, visitedNodeIds, taggedNodes, onSelectNode }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelectNode);
  const hoverRef = useRef<string | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050911');

    const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight('#9fdcff', 1.25);
    scene.add(ambient);
    const point = new THREE.PointLight('#8cf7ff', 24, 22);
    point.position.set(0, 2, 5);
    scene.add(point);

    const nodeMeshes = new Map<string, THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>>();
    const haloMeshes = new Map<string, THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>();
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
        const material = new THREE.LineBasicMaterial({ color: '#315d73', transparent: true, opacity: 0.55 });
        const line = new THREE.Line(geometry, material);
        scene.add(line);
        linkLines.push(line);
      });
    });

    nodes.forEach((node) => {
      const geometry = new THREE.SphereGeometry(node.importance === 'critical' ? 0.22 : 0.16, 32, 16);
      const color = importanceColors[node.importance];
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: node.importance === 'critical' ? 1.6 : 0.65,
        roughness: 0.2,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...node.position);
      mesh.userData.nodeId = node.id;
      scene.add(mesh);
      nodeMeshes.set(node.id, mesh);

      const haloGeometry = new THREE.SphereGeometry(node.importance === 'critical' ? 0.31 : 0.24, 24, 12);
      const haloMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, wireframe: true });
      const halo = new THREE.Mesh(haloGeometry, haloMaterial);
      halo.position.copy(mesh.position);
      scene.add(halo);
      haloMeshes.set(node.id, halo);
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

    const handlePointerMove = (event: PointerEvent) => {
      const intersects = updatePointer(event);
      const nodeId = intersects[0]?.object.userData.nodeId as string | undefined;
      hoverRef.current = nodeId ?? null;
      renderer.domElement.style.cursor = nodeId ? 'pointer' : 'default';
    };

    const handlePointerDown = (event: PointerEvent) => {
      const intersects = updatePointer(event);
      const nodeId = intersects[0]?.object.userData.nodeId as string | undefined;
      if (nodeId) onSelectRef.current(nodeId);
    };
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    const handleResize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener('resize', handleResize);

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
        const unclassifiedContradiction = (node.hasContradiction || node.importance === 'critical') && (taggedNodes[nodeId]?.length ?? 0) === 0;
        mesh.position.set(...node.position);

        const selectedScale = selected ? 1.95 : hovered ? 1.55 : 1;
        const visitedScale = visited && !selected && !hovered ? 0.94 : 1;
        mesh.scale.setScalar(selectedScale * visitedScale);
        mesh.material.emissiveIntensity = selected ? 2.8 : hovered ? 2.25 : visited ? 0.32 : 0.95;

        const halo = haloMeshes.get(nodeId);
        if (halo) {
          halo.position.copy(mesh.position);
          halo.scale.setScalar(selected ? 2.2 : hovered ? 1.7 : 1);
          halo.material.opacity = selected ? 0.42 : hovered ? 0.32 : unclassifiedContradiction ? (visited ? 0.18 : 0.24) : visited ? 0.05 : 0.14;
          halo.rotation.x = elapsed * 0.35;
          halo.rotation.y = elapsed * 0.25;
        }
      });
      scene.rotation.y = Math.sin(elapsed * 0.22) * 0.08;
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleResize);
      hoverRef.current = null;
      host.removeChild(renderer.domElement);
      renderer.dispose();
      nodeMeshes.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      haloMeshes.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      linkLines.forEach((line) => {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      });
    };
  }, [nodes, selectedNodeId, taggedNodes, visitedNodeIds]);

  return <div className="network" ref={hostRef} aria-label="記憶ノードネットワーク" />;
}
