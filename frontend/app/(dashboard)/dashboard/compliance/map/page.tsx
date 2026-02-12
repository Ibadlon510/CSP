"use client";

import { useCallback, useEffect, useState } from "react";
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
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";

interface GraphNodeData {
  contact_id: string;
  name: string;
  contact_type: string;
  risk_band?: string | null;
  kyc_status?: string | null;
}

interface GraphResponse {
  nodes: Array<{ id: string; type?: string; data: GraphNodeData; position?: { x: number; y: number } }>;
  edges: Array<{ id: string; source: string; target: string; label?: string | null; data?: Record<string, unknown> }>;
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

interface RiskInfo {
  risk_band: string | null;
  risk_score: number | null;
}

const KYC_COLORS: Record<string, string> = {
  complete: "var(--success)",
  incomplete: "var(--danger)",
  expiry_warning: "var(--warning)",
};

function CustomNode({ data, selected }: { data: GraphNodeData; selected?: boolean }) {
  const isCompany = data.contact_type === "company";
  const kycColor = data.kyc_status ? KYC_COLORS[data.kyc_status] : undefined;
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 8,
        minWidth: 140,
        border: `2px solid ${selected ? "var(--brand-primary)" : isCompany ? "var(--accent-blue)" : "var(--border-primary)"}`,
        background: selected ? "var(--brand-primary-light)" : "var(--bg-secondary)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", marginBottom: 2 }}>
        {data.name}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", gap: 6, alignItems: "center" }}>
        {isCompany ? "Company" : "Individual"}
        {data.risk_band ? ` · ${data.risk_band}` : ""}
        {data.kyc_status && (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: kycColor, display: "inline-block", flexShrink: 0 }} title={`KYC: ${data.kyc_status}`} />
        )}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = { default: CustomNode };

function graphToFlow(graph: GraphResponse): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (graph.nodes || []).map((n, i) => ({
    id: n.id,
    type: "default",
    data: n.data as unknown as Record<string, unknown>,
    position: n.position ?? { x: 250 + (i % 3) * 220, y: 100 + Math.floor(i / 3) * 120 },
  }));
  const edges: Edge[] = (graph.edges || []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label ?? undefined,
    labelStyle: { fontSize: 11 },
    labelBgStyle: { fill: "var(--bg-secondary)" },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
  }));
  return { nodes, edges };
}

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

  const loadGraph = useCallback((root: string, allLinks?: boolean) => {
    if (!root) return;
    setLoading(true);
    setError(null);
    const showAll = allLinks ?? includeAllLinks;
    api
      .get(`/api/compliance/graph?root_contact_id=${encodeURIComponent(root)}&include_all_links=${showAll}`)
      .then((data: GraphResponse) => {
        const { nodes: n, edges: e } = graphToFlow(data);
        setNodes(n);
        setEdges(e);
        setRootContactId(data.root_contact_id || root);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [setNodes, setEdges, includeAllLinks]);

  const saveLayout = useCallback(() => {
    if (!rootContactId) return;
    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => { positions[n.id] = n.position; });
    api.post("/api/compliance/graph/layout", { root_contact_id: rootContactId, positions }).catch(() => {});
  }, [rootContactId, nodes]);

  const onNodeDragStop = useCallback(() => {
    saveLayout();
  }, [saveLayout]);

  useEffect(() => {
    api.get("/api/contacts/?contact_type=company").then((data: Contact[]) => {
      setEntityOptions(Array.isArray(data) ? data.map((c) => ({ id: c.id, name: c.name })) : []);
    }).catch(() => setEntityOptions([]));
  }, []);

  useEffect(() => {
    if (rootId) loadGraph(rootId);
    else if (entityOptions.length > 0 && !rootContactId) {
      loadGraph(entityOptions[0].id);
    }
  }, [rootId, entityOptions.length, loadGraph]);

  useEffect(() => {
    if (!selectedContactId) {
      setContactDetail(null);
      setRiskInfo(null);
      return;
    }
    api.get(`/api/contacts/${selectedContactId}`).then((data: Contact) => setContactDetail(data)).catch(() => setContactDetail(null));
    api.get(`/api/compliance/risk/${selectedContactId}`).then((data: RiskInfo) => setRiskInfo({ risk_band: data.risk_band ?? null, risk_score: data.risk_score ?? null })).catch(() => setRiskInfo(null));
  }, [selectedContactId]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedContactId(node.id);
  }, []);

  const onPaneClick = useCallback(() => setSelectedContactId(null), []);

  if (error) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <p style={{ color: "var(--danger)" }}>{error}</p>
        <button type="button" className="btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => loadGraph(rootId || entityOptions[0]?.id || "")}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", minHeight: 400 }}>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-content">
          <h1 className="page-title">Ownership Map</h1>
          <p className="page-subtitle">Visualize and edit UBO structures</p>
        </div>
        <div className="page-header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={rootContactId || rootId || (entityOptions[0]?.id ?? "")}
            onChange={(e) => {
              const v = e.target.value;
              if (v) loadGraph(v);
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-primary)",
              background: "var(--bg-secondary)",
              fontSize: 14,
              minWidth: 200,
            }}
          >
            {entityOptions.length === 0 && <option value="">No companies</option>}
            {entityOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <a href="/dashboard/compliance" className="btn-ghost btn-sm">
            Back to Compliance
          </a>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", border: "1px solid var(--border-primary)", borderRadius: 12, overflow: "hidden", background: "var(--bg-secondary)" }}>
        <div style={{ flex: 1, position: "relative" }}>
          {loading ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
              Loading graph...
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onNodeDragStop={onNodeDragStop}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              maxZoom={2}
            >
              <Background />
              <Controls />
              <MiniMap />
              <Panel position="top-left">
                <div style={{ background: "var(--bg-secondary)", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-primary)", fontSize: 12, display: "flex", gap: 12, alignItems: "center" }}>
                  <span>Click a node for details. Drag to reposition (auto-saved).</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={includeAllLinks}
                      onChange={(e) => {
                        setIncludeAllLinks(e.target.checked);
                        if (rootContactId) loadGraph(rootContactId, e.target.checked);
                      }}
                    />
                    Show all links
                  </label>
                </div>
              </Panel>
            </ReactFlow>
          )}
        </div>
        {selectedContactId && (
          <div
            style={{
              width: 320,
              borderLeft: "1px solid var(--border-primary)",
              padding: 16,
              overflowY: "auto",
              background: "var(--bg-primary)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Node details</h3>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setSelectedContactId(null)}>
                <Icon path="M6 18L18 6M6 6l12 12" size={16} />
              </button>
            </div>
            {contactDetail ? (
              <>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>{contactDetail.name}</p>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>{contactDetail.contact_type}</p>
                {contactDetail.email && <p style={{ fontSize: 12, marginBottom: 4 }}>Email: {contactDetail.email}</p>}
                {contactDetail.nationality && <p style={{ fontSize: 12, marginBottom: 4 }}>Nationality: {contactDetail.nationality}</p>}
                {contactDetail.passport_no && <p style={{ fontSize: 12, marginBottom: 4 }}>Passport: {contactDetail.passport_no}</p>}
                {contactDetail.jurisdiction && <p style={{ fontSize: 12, marginBottom: 4 }}>Jurisdiction: {contactDetail.jurisdiction}</p>}
                {contactDetail.trade_license_no && <p style={{ fontSize: 12, marginBottom: 4 }}>License: {contactDetail.trade_license_no}</p>}
                {riskInfo && (riskInfo.risk_band || riskInfo.risk_score != null) && (
                  <p style={{ fontSize: 12, marginBottom: 4 }}>
                    Risk: <span style={{ fontWeight: 600, color: riskInfo.risk_band === "high" ? "var(--danger)" : riskInfo.risk_band === "medium" ? "var(--warning)" : "var(--success)" }}>{riskInfo.risk_band ?? "—"}</span>
                    {riskInfo.risk_score != null && ` (${riskInfo.risk_score})`}
                  </p>
                )}
                <a href={`/dashboard/contacts/${contactDetail.id}`} className="btn-secondary btn-sm" style={{ marginTop: 12, display: "inline-block" }}>
                  Open contact
                </a>
              </>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Loading...</p>
            )}
          </div>
        )}
      </div>
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
