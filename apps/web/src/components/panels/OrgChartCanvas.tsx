'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, Sparkles } from 'lucide-react';
import { META, NodeIcon, type OrgNode } from './TeamsListContent';
import styles from './OrgChartCanvas.module.css';

interface Point { x: number; y: number }

const H_GAP = 232;
const V_GAP = 152;
const NODE_W = 96;
const NODE_H = 96;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2;
const DRAG_THRESHOLD = 3;

/** Layout simple de árbol: ancho de subárbol = suma de hijos (mínimo 1 hoja), horizontal (raíz a la izquierda). */
function computeLayout(nodes: OrgNode[]): Map<string, Point> {
  const byParent = new Map<string | null, OrgNode[]>();
  for (const node of nodes) {
    const list = byParent.get(node.parent_id) || [];
    list.push(node);
    byParent.set(node.parent_id, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.position - b.position);

  const positions = new Map<string, Point>();
  let cursor = 0;

  function layoutNode(node: OrgNode, depth: number): number {
    const kids = byParent.get(node.id) || [];
    let y: number;
    if (!kids.length) {
      y = cursor * V_GAP;
      cursor += 1;
    } else {
      const childYs = kids.map((child) => layoutNode(child, depth + 1));
      y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    }
    positions.set(node.id, { x: depth * H_GAP, y });
    return y;
  }

  for (const root of byParent.get(null) || []) layoutNode(root, 0);
  return positions;
}

interface OrgChartCanvasProps {
  nodes: OrgNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  canManage: boolean;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
}

/**
 * Mapa organizacional interactivo: paneable (arrastrar el fondo), con zoom
 * (rueda + botones) y nodos arrastrables (solo canManage) que persisten su
 * posición en properties.canvas_x/canvas_y del nodo (ver action
 * 'update_node_position' en /api/workspaces/[slug]/hierarchy). Los edges se
 * dibujan a mano en un <svg> porque no hay librería de grafos en el proyecto.
 */
export function OrgChartCanvas({ nodes, selectedId, onSelect, canManage, onNodeMove }: OrgChartCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ x: 96, y: 110, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const [dragOverride, setDragOverride] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragState = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);

  const computed = useMemo(() => computeLayout(nodes), [nodes]);
  const positions = useMemo(() => {
    const map = new Map<string, Point>();
    for (const node of nodes) {
      const props = node.properties || {};
      const persisted = typeof props.canvas_x === 'number' && typeof props.canvas_y === 'number'
        ? { x: props.canvas_x as number, y: props.canvas_y as number }
        : null;
      const base = persisted || computed.get(node.id) || { x: 0, y: 0 };
      map.set(node.id, dragOverride && dragOverride.id === node.id ? { x: dragOverride.x, y: dragOverride.y } : base);
    }
    return map;
  }, [nodes, computed, dragOverride]);

  const edges = useMemo(() => nodes
    .filter((node) => node.parent_id && positions.has(node.parent_id) && positions.has(node.id))
    .map((node) => {
      const from = positions.get(node.parent_id as string) as Point;
      const to = positions.get(node.id) as Point;
      const startX = from.x + NODE_W;
      const startY = from.y + NODE_H / 2;
      const endX = to.x;
      const endY = to.y + NODE_H / 2;
      const midX = (startX + endX) / 2;
      return { id: node.id, d: `M${startX},${startY} C${midX},${startY} ${midX},${endY} ${endX},${endY}` };
    }), [nodes, positions]);

  const bounds = useMemo(() => {
    let maxX = 400;
    let maxY = 300;
    for (const point of positions.values()) {
      maxX = Math.max(maxX, point.x + NODE_W + 120);
      maxY = Math.max(maxY, point.y + NODE_H + 120);
    }
    return { width: maxX, height: maxY };
  }, [positions]);

  // Rueda del mouse: listener nativo no-pasivo para poder hacer preventDefault
  // (los handlers onWheel de React no lo garantizan de forma consistente).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      setViewport((current) => {
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * (1 - e.deltaY * 0.0012)));
        const ratio = nextScale / current.scale;
        return { scale: nextScale, x: cursorX - (cursorX - current.x) * ratio, y: cursorY - (cursorY - current.y) * ratio };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (factor: number) => setViewport((current) => {
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
    const ratio = nextScale / current.scale;
    const cx = (viewportRef.current?.clientWidth || 0) / 2;
    const cy = (viewportRef.current?.clientHeight || 0) / 2;
    return { scale: nextScale, x: cx - (cx - current.x) * ratio, y: cy - (cy - current.y) * ratio };
  });
  const resetView = () => setViewport({ x: 96, y: 110, scale: 1 });

  const onBackgroundPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    panState.current = { startX: e.clientX, startY: e.clientY, originX: viewport.x, originY: viewport.y };
    setIsPanning(true);
  };
  const onBackgroundPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = panState.current;
    if (!state) return;
    const x = state.originX + (e.clientX - state.startX);
    const y = state.originY + (e.clientY - state.startY);
    setViewport((current) => ({ ...current, x, y }));
  };
  const endPan = () => { panState.current = null; setIsPanning(false); };

  const onNodePointerDown = (e: React.PointerEvent<HTMLButtonElement>, node: OrgNode) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = positions.get(node.id) || { x: 0, y: 0 };
    dragState.current = { id: node.id, startX: e.clientX, startY: e.clientY, originX: point.x, originY: point.y, moved: false };
  };
  const onNodePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current;
    if (!state) return;
    const dxScreen = e.clientX - state.startX;
    const dyScreen = e.clientY - state.startY;
    if (Math.abs(dxScreen) > DRAG_THRESHOLD || Math.abs(dyScreen) > DRAG_THRESHOLD) state.moved = true;
    if (!canManage || !state.moved) return;
    setDragOverride({ id: state.id, x: state.originX + dxScreen / viewport.scale, y: state.originY + dyScreen / viewport.scale });
  };
  const onNodePointerUp = () => {
    const state = dragState.current;
    dragState.current = null;
    if (!state) return;
    if (state.moved && canManage) {
      const finalPoint = positions.get(state.id);
      setDragOverride(null);
      if (finalPoint) onNodeMove(state.id, Math.round(finalPoint.x), Math.round(finalPoint.y));
    } else {
      setDragOverride(null);
      onSelect(state.id);
    }
  };
  const onNodePointerCancel = () => { dragState.current = null; setDragOverride(null); };

  return (
    <div
      ref={viewportRef}
      className={`${styles.viewport} ${isPanning ? styles.panning : ''}`}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onBackgroundPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      <div className={styles.hint}><Sparkles size={14} /> Arrastra nodos para organizarlos · rueda para acercar</div>
      <div className={styles.controls}>
        <button type="button" onClick={() => zoomBy(0.85)} aria-label="Alejar"><Minus size={15} /></button>
        <span className={styles.zoomLabel}>{Math.round(viewport.scale * 100)}%</span>
        <button type="button" onClick={() => zoomBy(1 / 0.85)} aria-label="Acercar"><Plus size={15} /></button>
        <button type="button" onClick={resetView} aria-label="Restablecer vista"><Maximize2 size={14} /></button>
      </div>
      <div className={styles.content} style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
        <svg className={styles.edges} width={bounds.width} height={bounds.height}>
          {edges.map((edge) => <path key={edge.id} d={edge.d} className={styles.edge} />)}
        </svg>
        {nodes.map((node) => {
          const point = positions.get(node.id) || { x: 0, y: 0 };
          return (
            <div
              key={node.id}
              className={styles.nodeWrap}
              data-kind={node.type}
              style={{ left: point.x, top: point.y }}
            >
              <button
                type="button"
                className={`${styles.node} ${selectedId === node.id ? styles.nodeSelected : ''}`}
                data-draggable={canManage}
                aria-label={`${META[node.type]?.label || node.type}: ${node.name}, ${node.memberCount} ${node.memberCount === 1 ? 'persona' : 'personas'}`}
                onPointerDown={(e) => onNodePointerDown(e, node)}
                onPointerMove={onNodePointerMove}
                onPointerUp={onNodePointerUp}
                onPointerCancel={onNodePointerCancel}
              >
                <NodeIcon type={node.type} size={28} />
                <span className={styles.nodeCount}>{node.memberCount}</span>
              </button>
              <div className={styles.nodeLabel}>
                <small>{META[node.type]?.label || node.type}</small>
                <strong>{node.name}</strong>
                <em>{node.memberCount} {node.memberCount === 1 ? 'persona' : 'personas'}</em>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
