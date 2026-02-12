"use client";

import { useCallback } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { TaskCard, type TaskCardData } from "./TaskCard";
import { Pill } from "./Pill";
import { Icon } from "./Icon";

export type KanbanColumn = {
  id: string;
  label: string;
  color: string;
  bg: string;
};

export type KanbanBoardProps = {
  columns: KanbanColumn[];
  tasksByColumn: Record<string, TaskCardData[]>;
  onTaskClick?: (taskId: string) => void;
  onAddTask?: (columnId: string) => void;
  onDragEnd?: (taskId: string, sourceColumn: string, destColumn: string, destIndex: number) => void;
};

export function KanbanBoard({ columns, tasksByColumn, onTaskClick, onAddTask, onDragEnd }: KanbanBoardProps) {
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { draggableId, source, destination } = result;
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;
      onDragEnd?.(draggableId, source.droppableId, destination.droppableId, destination.index);
    },
    [onDragEnd]
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {columns.map((col) => {
          const colTasks = tasksByColumn[col.id] || [];
          return (
            <div key={col.id} className="kanban-column">
              <div className="kanban-column-header">
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, display: "inline-block" }} />
                <Pill label={col.label} color={col.color} bg={col.bg} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)", background: "var(--bg-tertiary)", padding: "1px 6px", borderRadius: "var(--radius-full)" }}>
                  {colTasks.length}
                </span>
                <span style={{ flex: 1 }} />
                {onAddTask && (
                  <button
                    onClick={() => onAddTask(col.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-quaternary)", display: "flex" }}
                    title="Add task"
                  >
                    <Icon path="M12 5v14 M5 12h14" size={14} />
                  </button>
                )}
              </div>

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
                    {colTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
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
                            <TaskCard task={task} onClick={() => onTaskClick?.(task.id)} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {colTasks.length === 0 && !snapshot.isDraggingOver && (
                      <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-quaternary)", fontSize: 12, border: "2px dashed var(--border-primary)", borderRadius: "var(--radius-md)" }}>
                        No tasks
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
