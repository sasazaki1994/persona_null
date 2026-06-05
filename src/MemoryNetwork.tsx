import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { MemoryNode } from './types';

type Props = {
  nodes: MemoryNode[];
  selectedNodeId?: string;
  visitedNodeIds: string[];
  onSelectNode: (nodeId: string) => void;
};

export function MemoryNetwork({ nodes, selectedNodeId, visitedNodeIds, onSelectNode }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelectNode);

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

    const ambient = new THREE.AmbientLight('#9fdcff', 1.1);
    scene.add(ambient);
    const point = new THREE.PointLight('#8cf7ff', 18, 20);
    point.position.set(0, 2, 5);
    scene.add(point);

    const nodeMeshes = new Map<string, THREE.Mesh>();
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
        scene.add(new THREE.Line(geometry, material));
      });
    });

    nodes.forEach((node) => {
      const geometry = new THREE.SphereGeometry(node.importance === 'critical' ? 0.2 : 0.16, 32, 16);
      const color = node.importance === 'critical' ? '#ff476f' : node.hasContradiction ? '#ffb84d' : '#5ee7ff';
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: node.importance === 'critical' ? 1.2 : 0.65,
        roughness: 0.28,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...node.position);
      mesh.userData.nodeId = node.id;
      scene.add(mesh);
      nodeMeshes.set(node.id, mesh);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects([...nodeMeshes.values()]);
      const nodeId = intersects[0]?.object.userData.nodeId as string | undefined;
      if (nodeId) onSelectRef.current(nodeId);
    };
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
        const material = mesh.material as THREE.MeshStandardMaterial;
        const selected = nodeId === selectedNodeId;
        const visited = visitedNodeIds.includes(nodeId);
        const criticalNoise = node.importance === 'critical' ? Math.sin(elapsed * 17 + node.position[2] * 9) * 0.045 : 0;
        const pulse = node.hasContradiction ? Math.sin(elapsed * 5 + node.position[0]) * 0.08 : 0;
        mesh.position.x = node.position[0] + criticalNoise;
        mesh.position.y = node.position[1] + Math.sin(elapsed * 1.4 + node.position[0]) * 0.06 + criticalNoise;
        mesh.position.z = node.position[2] + (node.importance === 'critical' ? Math.cos(elapsed * 13 + node.position[1]) * 0.035 : 0);
        mesh.scale.setScalar(selected ? 1.55 : visited ? 1.18 : 1 + pulse + Math.abs(criticalNoise));
        material.emissiveIntensity = selected ? 1.8 : node.importance === 'critical' ? 1.25 + Math.abs(pulse) + Math.abs(criticalNoise) * 6 : 0.55;
      });
      scene.rotation.y = Math.sin(elapsed * 0.22) * 0.08;
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleResize);
      host.removeChild(renderer.domElement);
      renderer.dispose();
      nodeMeshes.forEach((mesh) => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
    };
  }, [nodes, selectedNodeId, visitedNodeIds]);

  return <div className="network" ref={hostRef} aria-label="記憶ノードネットワーク" />;
}
