"use client";

import { useCallback } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Pill } from "./Pill";
import { Icon } from "./Icon";

/* ─── Types ─── */

export interface KanbanColumnConfig {
  id: string;
  label: string;
  color: string;
  bg: string;
}

export interface GenericCardData {
  id: string;
  title: string;
  subtitle?: string;
  badge?: { label: string; color: string; bg: string };
  meta?: { label: string; value: string }[];
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
}

interface KanbanViewProps {
  columns: KanbanColumnConfig[];
  itemsByColumn: Record<string, GenericCardData[]>;
  onItemClick?: (id: string) => void;
  onAddItem?: (columnId: string) => void;
  onDragEnd?: (itemId: string, sourceColumn: string, destColumn: string, destIndex: number) => void;
  emptyLabel?: string;
  addLabel?: string;
  renderCard?: (item: GenericCardData) => React.ReactNode;
}

/* ─── Default Card ─── */

function DefaultCard({ item, onClick }: { item: GenericCardData; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-lg)",
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all var(--transition-fast)",
        boxShadow: "var(--shadow-xs)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-hover)";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-primary)";
        e.currentTarget.style.boxShadow = "var(--shadow-xs)";
      }}
    >
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: item.subtitle || item.badge ? 6 : 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.title}
        </span>
      </div>

      {/* Badge */}
      {item.badge && (
        <div style={{ marginBottom: 6 }}>
          <Pill label={item.badge.label} color={item.badge.color} bg={item.badge.bg} />
        </div>
      )}

      {/* Subtitle */}
      {item.subtitle && (
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: item.meta?.length ? 8 : 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.subtitle}
        </div>
      )}

      {/* Meta fields */}
      {item.meta && item.meta.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {item.meta.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
              <span style={{ color: "var(--text-quaternary)", fontWeight: 500 }}>{m.label}</span>
              <span style={{ color: "var(--text-secondary)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {(item.footerLeft || item.footerRight) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          {item.footerLeft || <span />}
          {item.footerRight || <span />}
        </div>
      )}
    </div>
  );
}

/* ─── KanbanView ─── */

export function KanbanView({
  columns,
  itemsByColumn,
  onItemClick,
  onAddItem,
  onDragEnd,
  emptyLabel = "No items",
  addLabel = "Add",
  renderCard,
}: KanbanViewProps) {
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { draggableId, source, destination } = result;
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;
      onDragEnd?.(draggableId, source.droppableId, destination.droppableId, destination.index);
    },
    [onDragEnd]
  );

  const content = (
    <div className="kanban-board">
      {columns.map((col) => {
        const colItems = itemsByColumn[col.id] || [];
        return (
          <div key={col.id} className="kanban-column">
            <div className="kanban-column-header">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, display: "inline-block" }} />
              <Pill label={col.label} color={col.color} bg={col.bg} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)", background: "var(--bg-tertiary)", padding: "1px 6px", borderRadius: "var(--radius-full)" }}>
                {colItems.length}
              </span>
              <span style={{ flex: 1 }} />
              {onAddItem && (
                <button
                  onClick={() => onAddItem(col.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-quaternary)", display: "flex" }}
                  title={addLabel}
                >
                  <Icon path="M12 5v14 M5 12h14" size={14} />
                </button>
              )}
            </div>

            {onDragEnd ? (
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="kanban-column-cards"
                    style={{
                      minHeight: 60,
                      background: snapshot.isDraggingOver ? "var(--accent-blue-light)" : undefined,
                      borderRadius: "var(--radius-md)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    {colItems.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            style={{
                              ...dragProvided.draggableProps.style,
                              opacity: dragSnapshot.isDragging ? 0.85 : 1,
                              boxShadow: dragSnapshot.isDragging ? "var(--shadow-lg)" : undefined,
                            }}
                          >
                            {renderCard
                              ? renderCard(item)
                              : <DefaultCard item={item} onClick={() => onItemClick?.(item.id)} />
                            }
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {colItems.length === 0 && !snapshot.isDraggingOver && (
                      <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-quaternary)", fontSize: 12, border: "2px dashed var(--border-primary)", borderRadius: "var(--radius-md)" }}>
                        {emptyLabel}
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            ) : (
              <div className="kanban-column-cards" style={{ minHeight: 60 }}>
                {colItems.map((item) => (
                  <div key={item.id}>
                    {renderCard
                      ? renderCard(item)
                      : <DefaultCard item={item} onClick={() => onItemClick?.(item.id)} />
                    }
                  </div>
                ))}
                {colItems.length === 0 && (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-quaternary)", fontSize: 12, border: "2px dashed var(--border-primary)", borderRadius: "var(--radius-md)" }}>
                    {emptyLabel}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  if (onDragEnd) {
    return <DragDropContext onDragEnd={handleDragEnd}>{content}</DragDropContext>;
  }

  return content;
}
