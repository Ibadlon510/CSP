"""Workflow services: create project tasks from product task templates (dedupe by task name, merge subtasks)."""
from sqlalchemy.orm import Session

from models.project import Task, TaskStatus, TaskPriority
from models.product import Product, ProductTaskTemplate
from models.base import utcnow


def create_tasks_from_product_templates(
    db: Session,
    org_id: str,
    project_id: str,
    product_ids: list[str],
    owner_id: str | None = None,
) -> None:
    """
    Create project tasks from product task templates. Deduplicate by task name (one task per name);
    for each task name, merge subtask names from all products (unique by name).
    """
    if not product_ids:
        return
    templates = (
        db.query(ProductTaskTemplate)
        .filter(
            ProductTaskTemplate.product_id.in_(product_ids),
            ProductTaskTemplate.org_id == org_id,
        )
        .order_by(ProductTaskTemplate.sort_order, ProductTaskTemplate.task_name)
        .all()
    )
    if not templates:
        return

    # task_name -> (min_sort_order, set of unique subtask names in order of first appearance)
    merged: dict[str, tuple[int, list[str]]] = {}
    for t in templates:
        name = t.task_name
        subtasks = list(t.subtask_names) if t.subtask_names else []
        so = t.sort_order
        if name not in merged:
            merged[name] = (so, list(dict.fromkeys(subtasks)))  # unique order-preserving
        else:
            existing_so, existing_sub = merged[name]
            merged[name] = (min(existing_so, so), list(dict.fromkeys(existing_sub + subtasks)))

    # Sort task names by min sort_order then by name
    order_key = [(name, merged[name][0]) for name in merged]
    order_key.sort(key=lambda x: (x[1], x[0]))
    task_names_ordered = [x[0] for x in order_key]

    for task_name in task_names_ordered:
        _so, subtask_names = merged[task_name]
        parent_task = Task(
            project_id=project_id,
            org_id=org_id,
            parent_id=None,
            title=task_name,
            status=TaskStatus.TODO,
            priority=TaskPriority.MEDIUM,
            assigned_to=owner_id,
            date_assigned=utcnow() if owner_id else None,
        )
        db.add(parent_task)
        db.flush()
        for sub_name in subtask_names:
            child = Task(
                project_id=project_id,
                org_id=org_id,
                parent_id=parent_task.id,
                title=sub_name,
                status=TaskStatus.TODO,
                priority=TaskPriority.MEDIUM,
                assigned_to=owner_id,
                date_assigned=utcnow() if owner_id else None,
            )
            db.add(child)
