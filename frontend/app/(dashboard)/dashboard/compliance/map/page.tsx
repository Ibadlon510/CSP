"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";

/* ═══════════════════════ Types ═══════════════════════ */

interface GraphNodeData {
  contact_id: string;
  name: string;
  contact_type: string;
  risk_band?: string | null;
  kyc_status?: string | null;
  isRoot?: boolean;
  isUbo?: boolean;
  uboEffectivePct?: number | null;
}

interface GraphEdgeData {
  percentage?: number | null;
  link_type?: string;
  voting_pct?: number | null;
}

interface GraphResponse {
  nodes: Array<{ id: string; type?: string; data: GraphNodeData; position?: { x: number; y: number } }>;
  edges: Array<{ id: string; source: string; target: string; label?: string | null; data?: GraphEdgeData }>;
  root_contact_id?: string | null;
}

interface Contact {
  id: string;
  name: string;
  contact_type: string;
  email?: string | null;
  nationality?: string | null;
  passport_no?: string | null;
  jurisdiction?: string | null;
  trade_license_no?: string | null;
}

interface RiskInfo { risk_band: string | null; risk_score: number | null; }

interface UBOItem { contact_id: string; name: string; effective_pct: number; is_control: boolean; is_senior_manager_fallback: boolean; }
interface UBOResponse { ubos: UBOItem[]; effective_ownership: Record<string, number>; cycles: string[][]; warnings: string[]; }
interface ValidationResponse { ownership_sum_valid: boolean; total_percentage: number; dead_ends: Array<{ contact_id: string; name: string }>; cycles: string[][]; warnings: string[]; }

/* ═══════════════════════ Constants ═══════════════════════ */

const RISK_COLORS: Record<string, string> = { high: "var(--danger)", medium: "var(--warning)", low: "var(--success)" };
const KYC_COLORS: Record<string, string> = { complete: "var(--success)", incomplete: "var(--danger)", expiry_warning: "var(--warning)" };

const EDGE_STYLE_BY_TYPE: Record<string, { stroke: string; strokeDasharray?: string; label: string }> = {
  ownership: { stroke: "#475569", label: "Ownership" },
  control: { stroke: "#7c3aed", strokeDasharray: "6 3", label: "Control" },
  director: { stroke: "#16a34a", label: "Director" },
  manages: { stroke: "#ea580c", strokeDasharray: "3 3", label: "Manages" },
  family: { stroke: "#94a3b8", label: "Family" },
  employee: { stroke: "#94a3b8", strokeDasharray: "2 2", label: "Employee" },
};

const NODE_W = 220;
const NODE_H = 80;

/* ═══════════════════════ Dagre Auto Layout ═══════════════════════ */

function applyDagreLayout(nodes: Node[], edges: Edge[], direction: "TB" | "LR" = "TB"): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

/* ═══════════════════════ Custom Node ═══════════════════════ */

function CustomNode({ data, selected }: { data: GraphNodeData; selected?: boolean }) {
  const isCompany = data.contact_type === "company";
  const kycColor = data.kyc_status ? KYC_COLORS[data.kyc_status] : undefined;
  const riskColor = data.risk_band ? RISK_COLORS[data.risk_band] : undefined;
  const isRoot = data.isRoot;
  const isUbo = data.isUbo;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10,
      minWidth: NODE_W - 20, maxWidth: NODE_W,
      border: `2px solid ${selected ? "var(--brand-primary)" : isRoot ? "var(--accent-blue)" : isUbo ? "#d97706" : isCompany ? "var(--border-primary)" : "var(--border-secondary)"}`,
      background: selected ? "var(--brand-primary-light)" : "var(--bg-secondary)",
      boxShadow: isRoot ? "0 2px 8px rgba(59,130,246,0.15)" : "var(--shadow-sm)",
      position: "relative",
    }}>
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: isCompany ? "var(--accent-blue-light, #eff6ff)" : "#f3e8ff", color: isCompany ? "var(--accent-blue, #3b82f6)" : "#7c3aed",
        fontSize: 14, fontWeight: 700,
      }}>
        {isCompany
          ? <Icon path="M3 21h18M3 7v14M21 7v14M6 11h.01M6 15h.01M12 11h.01M12 15h.01M18 11h.01M18 15h.01M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" size={18} />
          : <Icon path="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z" size={18} />}
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.name}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
          <span>{isCompany ? "Company" : "Individual"}</span>
          {riskColor && <span style={{ width: 7, height: 7, borderRadius: "50%", background: riskColor, display: "inline-block" }} title={`Risk: ${data.risk_band}`} />}
          {kycColor && <span style={{ width: 7, height: 7, borderRadius: "50%", background: kycColor, display: "inline-block" }} title={`KYC: ${data.kyc_status}`} />}
        </div>
      </div>
      {/* UBO badge */}
      {isUbo && (
        <div style={{ position: "absolute", top: -8, right: -8, background: "#f59e0b", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 8, letterSpacing: "0.05em", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
          UBO{data.uboEffectivePct != null ? ` ${data.uboEffectivePct.toFixed(0)}%` : ""}
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = { default: CustomNode };

/* ═══════════════════════ Graph → Flow conversion ═══════════════════════ */

function graphToFlow(graph: GraphResponse, uboMap: Record<string, number>): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (graph.nodes || []).map((n, i) => ({
    id: n.id,
    type: "default",
    data: {
      ...n.data,
      isRoot: n.id === graph.root_contact_id,
      isUbo: n.id in uboMap,
      uboEffectivePct: uboMap[n.id] ?? null,
    } as unknown as Record<string, unknown>,
    position: n.position ?? { x: 250 + (i % 3) * 260, y: 100 + Math.floor(i / 3) * 140 },
  }));
  const edges: Edge[] = (graph.edges || []).map((e) => {
    const linkType = (e.data?.link_type as string) || "ownership";
    const style = EDGE_STYLE_BY_TYPE[linkType] || EDGE_STYLE_BY_TYPE.ownership;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      label: e.label ?? undefined,
      labelStyle: { fontSize: 10, fontWeight: 600, fill: style.stroke },
      labelBgStyle: { fill: "var(--bg-secondary)", fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      style: { stroke: style.stroke, strokeWidth: linkType === "ownership" ? 2 : 1.5, strokeDasharray: style.strokeDasharray },
      animated: linkType === "control",
    };
  });
  return { nodes, edges };
}

/* ═══════════════════════ Legend Panel ═══════════════════════ */

function MapLegend({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: 10, padding: 16, width: 260, fontSize: 12, boxShadow: "var(--shadow-md)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>Legend</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 2 }}><Icon path="M18 6L6 18M6 6l12 12" size={14} /></button>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Nodes</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: "50%", background: "#eff6ff", border: "1px solid #3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon path="M3 21h18" size={8} /></div><span>Company</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: "50%", background: "#f3e8ff", border: "1px solid #7c3aed" }} /><span>Individual</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ background: "#f59e0b", color: "#fff", fontSize: 8, fontWeight: 800, padding: "1px 4px", borderRadius: 4 }}>UBO</div><span>Ultimate Beneficial Owner</span></div>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Edges</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {Object.entries(EDGE_STYLE_BY_TYPE).map(([key, cfg]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width={24} height={10}><line x1={0} y1={5} x2={24} y2={5} stroke={cfg.stroke} strokeWidth={2} strokeDasharray={cfg.strokeDasharray || "none"} /></svg>
              <span>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Risk / KYC</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[{ c: "var(--success)", l: "Low / Complete" }, { c: "var(--warning)", l: "Medium / Warning" }, { c: "var(--danger)", l: "High / Incomplete" }].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: x.c, display: "inline-block" }} /><span style={{ fontSize: 11 }}>{x.l}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ Validation Banner ═══════════════════════ */

function ValidationBanner({ data }: { data: ValidationResponse | null }) {
  if (!data) return null;
  const issues: string[] = [];
  if (!data.ownership_sum_valid) issues.push(`Ownership total is ${data.total_percentage.toFixed(1)}% (expected 100%)`);
  if (data.dead_ends.length > 0) issues.push(`${data.dead_ends.length} dead-end node${data.dead_ends.length > 1 ? "s" : ""}: ${data.dead_ends.map((d) => d.name).join(", ")}`);
  if (data.cycles.length > 0) issues.push(`${data.cycles.length} circular ownership chain${data.cycles.length > 1 ? "s" : ""} detected`);
  data.warnings.forEach((w) => issues.push(w));
  if (issues.length === 0) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "var(--success-light)", border: "1px solid var(--success)", borderRadius: 8, fontSize: 12, color: "var(--success)", fontWeight: 600 }}>
      <Icon path="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" size={14} /> Structure is valid
    </div>
  );
  return (
    <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 8, fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: "#b45309", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon path="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" size={14} /> {issues.length} issue{issues.length > 1 ? "s" : ""} found
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, color: "#92400e" }}>
        {issues.map((msg, i) => <li key={i} style={{ marginBottom: 2 }}>{msg}</li>)}
      </ul>
    </div>
  );
}

/* ═══════════════════════ Main Component ═══════════════════════ */

function MapFlowContent() {
  const searchParams = useSearchParams();
  const rootId = searchParams.get("root") || "";
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contactDetail, setContactDetail] = useState<Contact | null>(null);
  const [riskInfo, setRiskInfo] = useState<RiskInfo | null>(null);
  const [rootContactId, setRootContactId] = useState<string | null>(null);
  const [entityOptions, setEntityOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [includeAllLinks, setIncludeAllLinks] = useState(false);
  const [uboData, setUboData] = useState<UBOResponse | null>(null);
  const [validationData, setValidationData] = useState<ValidationResponse | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [showValidation, setShowValidation] = useState(true);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; type: "node" | "edge"; id: string } | null>(null);
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addNodeSearch, setAddNodeSearch] = useState("");
  const [allContacts, setAllContacts] = useState<Array<{ id: string; name: string; contact_type: string }>>([]);
  const [addConnOpen, setAddConnOpen] = useState(false);
  const [addConnFrom, setAddConnFrom] = useState("");
  const [addConnTo, setAddConnTo] = useState("");
  const [addConnType, setAddConnType] = useState("ownership");
  const [addConnPct, setAddConnPct] = useState("");
  const [addConnSaving, setAddConnSaving] = useState(false);

  const uboMap = useMemo(() => {
    if (!uboData) return {};
    const m: Record<string, number> = {};
    uboData.ubos.forEach((u) => { m[u.contact_id] = u.effective_pct; });
    return m;
  }, [uboData]);

  const loadGraph = useCallback((root: string, allLinks?: boolean) => {
    if (!root) return;
    setLoading(true);
    setError(null);
    const showAll = allLinks ?? includeAllLinks;
    Promise.all([
      api.get(`/api/compliance/graph?root_contact_id=${encodeURIComponent(root)}&include_all_links=${showAll}`),
      api.get(`/api/compliance/ubo?entity_contact_id=${encodeURIComponent(root)}`).catch(() => null),
      api.get(`/api/compliance/validation?entity_contact_id=${encodeURIComponent(root)}`).catch(() => null),
    ]).then(([graphData, ubo, validation]: [GraphResponse, UBOResponse | null, ValidationResponse | null]) => {
      setUboData(ubo);
      setValidationData(validation);
      const uMap: Record<string, number> = {};
      if (ubo) ubo.ubos.forEach((u) => { uMap[u.contact_id] = u.effective_pct; });
      const { nodes: n, edges: e } = graphToFlow(graphData, uMap);
      // Check if positions were already saved (non-zero)
      const hasSavedPositions = n.some((nd) => nd.position.x !== 0 || nd.position.y !== 0) && n.some((nd) => nd.position.x !== 250);
      const layoutNodes = hasSavedPositions ? n : applyDagreLayout(n, e);
      setNodes(layoutNodes);
      setEdges(e);
      setRootContactId(graphData.root_contact_id || root);
    }).catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [setNodes, setEdges, includeAllLinks]);

  const autoLayout = useCallback(() => {
    const laid = applyDagreLayout([...nodes], edges);
    setNodes(laid);
    // Auto-save
    if (rootContactId) {
      const positions: Record<string, { x: number; y: number }> = {};
      laid.forEach((n) => { positions[n.id] = n.position; });
      api.post("/api/compliance/graph/layout", { root_contact_id: rootContactId, positions }).catch(() => {});
    }
  }, [nodes, edges, setNodes, rootContactId]);

  const saveLayout = useCallback(() => {
    if (!rootContactId) return;
    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => { positions[n.id] = n.position; });
    api.post("/api/compliance/graph/layout", { root_contact_id: rootContactId, positions }).catch(() => {});
  }, [rootContactId, nodes]);

  const onNodeDragStop = useCallback(() => { saveLayout(); }, [saveLayout]);

  useEffect(() => {
    api.get("/api/contacts/?contact_type=company").then((data: Contact[]) => {
      setEntityOptions(Array.isArray(data) ? data.map((c) => ({ id: c.id, name: c.name })) : []);
    }).catch(() => setEntityOptions([]));
  }, []);

  useEffect(() => {
    if (rootId) loadGraph(rootId);
    else if (entityOptions.length > 0 && !rootContactId) { loadGraph(entityOptions[0].id); }
  }, [rootId, entityOptions.length, loadGraph]);

  useEffect(() => {
    if (!selectedContactId) { setContactDetail(null); setRiskInfo(null); return; }
    api.get(`/api/contacts/${selectedContactId}`).then((data: Contact) => setContactDetail(data)).catch(() => setContactDetail(null));
    api.get(`/api/compliance/risk/${selectedContactId}`).then((data: RiskInfo) => setRiskInfo({ risk_band: data.risk_band ?? null, risk_score: data.risk_score ?? null })).catch(() => setRiskInfo(null));
  }, [selectedContactId]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => { setSelectedContactId(node.id); setCtxMenu(null); }, []);
  const onPaneClick = useCallback(() => { setSelectedContactId(null); setCtxMenu(null); }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setCtxMenu({ x: event.clientX, y: event.clientY, type: "node", id: node.id });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setCtxMenu({ x: event.clientX, y: event.clientY, type: "edge", id: edge.id });
  }, []);

  const deleteLink = useCallback(async (linkId: string) => {
    try {
      await api.delete(`/api/compliance/ownership-links/${linkId}`);
      if (rootContactId) loadGraph(rootContactId);
    } catch { /* ignore */ }
    setCtxMenu(null);
  }, [rootContactId, loadGraph]);

  const openAddNode = useCallback(() => {
    api.get("/api/contacts/").then((d: any) => setAllContacts(Array.isArray(d) ? d.map((c: any) => ({ id: c.id, name: c.name, contact_type: c.contact_type })) : [])).catch(() => setAllContacts([]));
    setAddNodeSearch("");
    setAddNodeOpen(true);
  }, []);

  const addNodeToGraph = useCallback((contactId: string) => {
    setAddNodeOpen(false);
    setAddConnFrom(contactId);
    setAddConnTo(rootContactId || "");
    setAddConnType("ownership");
    setAddConnPct("");
    setAddConnOpen(true);
  }, [rootContactId]);

  const openAddConnection = useCallback((fromId?: string) => {
    api.get("/api/contacts/").then((d: any) => setAllContacts(Array.isArray(d) ? d.map((c: any) => ({ id: c.id, name: c.name, contact_type: c.contact_type })) : [])).catch(() => setAllContacts([]));
    setAddConnFrom(fromId || "");
    setAddConnTo(rootContactId || "");
    setAddConnType("ownership");
    setAddConnPct("");
    setAddConnOpen(true);
  }, [rootContactId]);

  const submitAddConnection = useCallback(async () => {
    if (!addConnFrom || !addConnTo) return;
    setAddConnSaving(true);
    try {
      await api.post("/api/compliance/ownership-links", {
        owner_contact_id: addConnFrom,
        owned_contact_id: addConnTo,
        link_type: addConnType,
        percentage: addConnPct ? parseFloat(addConnPct) : null,
      });
      setAddConnOpen(false);
      if (rootContactId) loadGraph(rootContactId);
    } catch { /* ignore */ }
    setAddConnSaving(false);
  }, [addConnFrom, addConnTo, addConnType, addConnPct, rootContactId, loadGraph]);

  if (error) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <p style={{ color: "var(--danger)" }}>{error}</p>
        <button type="button" className="btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => loadGraph(rootId || entityOptions[0]?.id || "")}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", minHeight: 400 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div className="page-header-content">
          <h1 className="page-title">Ownership Map</h1>
          <p className="page-subtitle">Visualize UBO structures, ownership chains &amp; compliance validation</p>
        </div>
        <div className="page-header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={rootContactId || rootId || (entityOptions[0]?.id ?? "")}
            onChange={(e) => { if (e.target.value) loadGraph(e.target.value); }}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", fontSize: 14, minWidth: 200 }}
          >
            {entityOptions.length === 0 && <option value="">No companies</option>}
            {entityOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <a href="/dashboard/compliance" className="btn-ghost btn-sm">Back to Compliance</a>
        </div>
      </div>

      {/* Validation Banner */}
      {showValidation && !loading && <div style={{ marginBottom: 12 }}><ValidationBanner data={validationData} /></div>}

      {/* Canvas */}
      <div style={{ flex: 1, display: "flex", border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden", background: "var(--bg-secondary)" }}>
        <div style={{ flex: 1, position: "relative" }}>
          {loading ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)", flexDirection: "column", gap: 12 }}>
              <div className="loading-spinner" style={{ width: 28, height: 28 }} />
              <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading ownership graph...</span>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick} onNodeDragStop={onNodeDragStop} onPaneClick={onPaneClick}
              onNodeContextMenu={onNodeContextMenu} onEdgeContextMenu={onEdgeContextMenu}
              nodeTypes={nodeTypes}
              fitView fitViewOptions={{ padding: 0.25 }}
              minZoom={0.15} maxZoom={2.5}
              defaultEdgeOptions={{ type: "smoothstep" }}
            >
              <Background gap={20} />
              <Controls />
              <MiniMap nodeBorderRadius={6} />

              {/* Toolbar Panel */}
              <Panel position="top-left">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={openAddNode} className="btn-primary btn-sm" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon path="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M20 8v6 M23 11h-6" size={13} /> Add Node
                  </button>
                  <button onClick={() => openAddConnection()} className="btn-secondary btn-sm" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon path="M12 5v14 M5 12h14" size={13} /> Add Connection
                  </button>
                  <button onClick={autoLayout} className="btn-secondary btn-sm" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon path="M4 14h6v6H4zM14 4h6v6h-6zM4 4h6v6H4zM14 14h6v6h-6z" size={13} /> Auto Layout
                  </button>
                  <button onClick={() => setShowLegend((v) => !v)} className="btn-secondary btn-sm" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon path="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" size={13} /> Legend
                  </button>
                  <button onClick={() => setShowValidation((v) => !v)} className="btn-secondary btn-sm" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" size={13} /> {showValidation ? "Hide" : "Show"} Validation
                  </button>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11, fontWeight: 500, padding: "4px 10px", background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-sm)", color: "var(--text-secondary)" }}>
                    <input type="checkbox" checked={includeAllLinks} onChange={(e) => { setIncludeAllLinks(e.target.checked); if (rootContactId) loadGraph(rootContactId, e.target.checked); }} style={{ width: 13, height: 13 }} />
                    All links
                  </label>
                </div>
              </Panel>

              {/* Legend Panel */}
              <Panel position="top-right">
                <MapLegend open={showLegend} onClose={() => setShowLegend(false)} />
              </Panel>
            </ReactFlow>
          )}
        </div>

        {/* ── Context Menu ── */}
        {ctxMenu && (
          <>
            <div onClick={() => setCtxMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 1050 }} />
            <div style={{ position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 1060, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: 8, boxShadow: "var(--shadow-lg)", padding: "4px 0", minWidth: 180 }}>
              {ctxMenu.type === "node" && (
                <>
                  <button type="button" onClick={() => { setSelectedContactId(ctxMenu.id); setCtxMenu(null); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", textAlign: "left" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                    <Icon path="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" size={14} /> View Details
                  </button>
                  <a href={`/dashboard/contacts/${ctxMenu.id}`} onClick={() => setCtxMenu(null)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", textDecoration: "none" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                    <Icon path="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3" size={14} /> Open Contact
                  </a>
                  <button type="button" onClick={() => { openAddConnection(ctxMenu.id); setCtxMenu(null); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", textAlign: "left" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                    <Icon path="M12 5v14 M5 12h14" size={14} /> Add Connection
                  </button>
                  {ctxMenu.id !== rootContactId && (
                    <button type="button" onClick={() => { loadGraph(ctxMenu.id); setCtxMenu(null); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", textAlign: "left" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                      <Icon path="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" size={14} /> View as Root
                    </button>
                  )}
                </>
              )}
              {ctxMenu.type === "edge" && (
                <>
                  <button type="button" onClick={() => deleteLink(ctxMenu.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--danger)", textAlign: "left" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                    <Icon path="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" size={14} /> Delete Connection
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* ── Side Panel (on node click) ── */}
        {selectedContactId && (
          <div style={{ width: 340, borderLeft: "1px solid var(--border-primary)", overflowY: "auto", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border-secondary)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Node Details</h3>
              <button type="button" className="btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => setSelectedContactId(null)}>
                <Icon path="M6 18L18 6M6 6l12 12" size={14} />
              </button>
            </div>
            {/* Body */}
            <div style={{ flex: 1, padding: 16 }}>
              {contactDetail ? (
                <>
                  {/* Profile card */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      background: contactDetail.contact_type === "company" ? "#eff6ff" : "#f3e8ff",
                      color: contactDetail.contact_type === "company" ? "#3b82f6" : "#7c3aed", fontSize: 16, fontWeight: 700,
                    }}>
                      {contactDetail.contact_type === "company"
                        ? <Icon path="M3 21h18M3 7v14M21 7v14M6 11h.01M6 15h.01M12 11h.01M12 15h.01M18 11h.01M18 15h.01M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" size={20} />
                        : <Icon path="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z" size={20} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{contactDetail.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", textTransform: "capitalize" }}>{contactDetail.contact_type}</div>
                    </div>
                  </div>

                  {/* UBO badge */}
                  {uboMap[selectedContactId] != null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600, color: "#b45309" }}>
                      <span style={{ background: "#f59e0b", color: "#fff", padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>UBO</span>
                      Effective ownership: {uboMap[selectedContactId].toFixed(1)}%
                    </div>
                  )}

                  {/* Info rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, fontSize: 13 }}>
                    {contactDetail.email && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-tertiary)" }}>Email</span><span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{contactDetail.email}</span></div>}
                    {contactDetail.nationality && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-tertiary)" }}>Nationality</span><span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{contactDetail.nationality}</span></div>}
                    {contactDetail.passport_no && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-tertiary)" }}>Passport</span><span style={{ color: "var(--text-primary)", fontWeight: 500, fontFamily: "monospace" }}>{contactDetail.passport_no}</span></div>}
                    {contactDetail.jurisdiction && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-tertiary)" }}>Jurisdiction</span><span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{contactDetail.jurisdiction}</span></div>}
                    {contactDetail.trade_license_no && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-tertiary)" }}>License</span><span style={{ color: "var(--text-primary)", fontWeight: 500, fontFamily: "monospace" }}>{contactDetail.trade_license_no}</span></div>}
                  </div>

                  {/* Risk */}
                  {riskInfo && (riskInfo.risk_band || riskInfo.risk_score != null) && (
                    <div style={{ padding: "10px 12px", background: "var(--bg-tertiary)", borderRadius: 8, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>Risk Assessment</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: RISK_COLORS[riskInfo.risk_band || ""] || "var(--text-quaternary)" }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: RISK_COLORS[riskInfo.risk_band || ""] || "var(--text-secondary)", textTransform: "capitalize" }}>
                          {riskInfo.risk_band || "—"}
                        </span>
                        {riskInfo.risk_score != null && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>({riskInfo.risk_score})</span>}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <a href={`/dashboard/contacts/${contactDetail.id}`} className="btn-secondary btn-sm" style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Icon path="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" size={14} /> Open Contact
                    </a>
                    {contactDetail.contact_type === "company" && contactDetail.id !== rootContactId && (
                      <button onClick={() => loadGraph(contactDetail.id)} className="btn-ghost btn-sm" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <Icon path="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" size={14} /> View as Root
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
                  <div className="loading-spinner" style={{ width: 20, height: 20 }} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Add Node Panel ── */}
      {addNodeOpen && (
        <>
          <div onClick={() => setAddNodeOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1070 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 400, maxHeight: "70vh", background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: 12, boxShadow: "var(--shadow-xl)", zIndex: 1080, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Add Node to Map</h3>
              <button type="button" onClick={() => setAddNodeOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}><Icon path="M18 6L6 18M6 6l12 12" size={16} /></button>
            </div>
            <div style={{ padding: "12px 20px" }}>
              <input type="text" placeholder="Search contacts..." value={addNodeSearch} onChange={(e) => setAddNodeSearch(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-md)", fontSize: 13 }} autoFocus />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 16px", maxHeight: 300 }}>
              {allContacts.filter((c) => {
                const inGraph = nodes.some((n) => n.id === c.id);
                const matchesSearch = !addNodeSearch || c.name.toLowerCase().includes(addNodeSearch.toLowerCase());
                return !inGraph && matchesSearch;
              }).length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", color: "var(--text-quaternary)", fontSize: 13 }}>No matching contacts</div>
              ) : (
                allContacts.filter((c) => {
                  const inGraph = nodes.some((n) => n.id === c.id);
                  const matchesSearch = !addNodeSearch || c.name.toLowerCase().includes(addNodeSearch.toLowerCase());
                  return !inGraph && matchesSearch;
                }).map((c) => (
                  <button key={c.id} type="button" onClick={() => addNodeToGraph(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 8px", background: "none", border: "none", borderBottom: "1px solid var(--border-secondary)", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", textAlign: "left" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-tertiary)"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: c.contact_type === "company" ? "#eff6ff" : "#f3e8ff", color: c.contact_type === "company" ? "#3b82f6" : "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{c.name.slice(0, 2).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-quaternary)", textTransform: "capitalize" }}>{c.contact_type}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Add Connection Panel ── */}
      {addConnOpen && (
        <>
          <div onClick={() => setAddConnOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1070 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 420, background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", borderRadius: 12, boxShadow: "var(--shadow-xl)", zIndex: 1080, padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Add Connection</h3>
              <button type="button" onClick={() => setAddConnOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}><Icon path="M18 6L6 18M6 6l12 12" size={16} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Owner (From)</label>
                <select value={addConnFrom} onChange={(e) => setAddConnFrom(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-primary)", fontSize: 13 }}>
                  <option value="">Select contact</option>
                  {allContacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.contact_type})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Owned Entity (To)</label>
                <select value={addConnTo} onChange={(e) => setAddConnTo(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-primary)", fontSize: 13 }}>
                  <option value="">Select contact</option>
                  {allContacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.contact_type})</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Link Type</label>
                  <select value={addConnType} onChange={(e) => setAddConnType(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-primary)", fontSize: 13 }}>
                    <option value="ownership">Ownership</option>
                    <option value="control">Control</option>
                    <option value="directorship">Directorship</option>
                    <option value="manages">Manages</option>
                    <option value="family">Family</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Percentage</label>
                  <input type="number" min={0} max={100} step={0.01} value={addConnPct} onChange={(e) => setAddConnPct(e.target.value)} placeholder="e.g. 51" style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-primary)", fontSize: 13 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, paddingTop: 8 }}>
                <button type="button" onClick={submitAddConnection} disabled={addConnSaving || !addConnFrom || !addConnTo} className="btn-primary" style={{ flex: 1 }}>
                  {addConnSaving ? "Saving..." : "Add Connection"}
                </button>
                <button type="button" onClick={() => setAddConnOpen(false)} className="btn-ghost">Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ComplianceMapPage() {
  return (
    <ReactFlowProvider>
      <MapFlowContent />
    </ReactFlowProvider>
  );
}
