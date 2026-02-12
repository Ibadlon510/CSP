"""
Projects API - Project and Task Management
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal

from core.database import get_db
from core.deps import get_current_user, require_roles
from models.user import User, UserRole
from models.project import Project, Task, TaskAssignee, ProjectStatus, TaskStatus, TaskComment, ProjectProduct, UserFavorite, CommentReaction, TaskAttachment, TaskDependency
from models.contact import Contact
from models.wallet import ClientWallet
from models.sales_order import SalesOrder, SalesOrderLine
from models.product import Product
from schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskCommentCreate,
    TaskCommentResponse,
    ReactionCreate,
    ReactionResponse,
)
from services.audit import log_action
from models.base import utcnow
from models.notification import Notification
from datetime import date, timedelta

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _check_due_date_warnings(db: Session, org_id: str):
    """Create notifications for tasks/projects due within 3 days (once per resource)."""
    threshold = date.today() + timedelta(days=3)
    today = date.today()

    # Tasks approaching due date
    tasks_due = db.query(Task).filter(
        Task.org_id == org_id,
        Task.due_date != None,
        Task.due_date <= threshold,
        Task.due_date >= today,
        Task.status != TaskStatus.DONE,
        Task.assigned_to != None,
    ).all()
    for t in tasks_due:
        existing = db.query(Notification).filter(
            Notification.resource_type == "task_due",
            Notification.resource_id == t.id,
            Notification.user_id == t.assigned_to,
        ).first()
        if not existing:
            td = t.due_date.date() if hasattr(t.due_date, 'date') else t.due_date
            days_left = (td - today).days
            db.add(Notification(
                org_id=org_id, user_id=t.assigned_to,
                title="Task Due Soon",
                message=f"Task \"{t.title}\" is due in {days_left} day{'s' if days_left != 1 else ''}.",
                category="task", resource_type="task_due", resource_id=t.id,
            ))

    # Projects approaching due date
    projects_due = db.query(Project).filter(
        Project.org_id == org_id,
        Project.due_date != None,
        Project.due_date <= threshold,
        Project.due_date >= today,
        Project.status != ProjectStatus.COMPLETED,
        Project.owner_id != None,
    ).all()
    for p in projects_due:
        existing = db.query(Notification).filter(
            Notification.resource_type == "project_due",
            Notification.resource_id == p.id,
            Notification.user_id == p.owner_id,
        ).first()
        if not existing:
            pd = p.due_date.date() if hasattr(p.due_date, 'date') else p.due_date
            days_left = (pd - today).days
            db.add(Notification(
                org_id=org_id, user_id=p.owner_id,
                title="Project Due Soon",
                message=f"Project \"{p.title}\" is due in {days_left} day{'s' if days_left != 1 else ''}.",
                category="project", resource_type="project_due", resource_id=p.id,
            ))

    try:
        db.commit()
    except Exception:
        db.rollback()


# ============= Project Endpoints =============

@router.get("/", response_model=List[ProjectResponse])
def list_projects(
    status: Optional[str] = None,
    contact_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all projects for the organization"""
    _check_due_date_warnings(db, current_user.org_id)
    query = db.query(Project).filter(Project.org_id == current_user.org_id)
    
    if status:
        query = query.filter(Project.status == status)
    
    if contact_id:
        query = query.filter(Project.contact_id == contact_id)
    
    projects = query.options(
        joinedload(Project.contact),
        joinedload(Project.tasks)
    ).order_by(Project.created_at.desc()).all()
    
    # Enrich with contact name and task counts
    result = []
    for p in projects:
        data = ProjectResponse.model_validate(p)
        data.contact_name = p.contact.name if p.contact else None
        parent_tasks = [t for t in p.tasks if t.parent_id is None]
        data.task_count = len(parent_tasks)
        data.completed_task_count = sum(1 for t in parent_tasks if t.status == TaskStatus.DONE)
        data.category_progress = _build_category_progress(p.tasks)
        
        # Get owner name
        if p.owner_id:
            owner = db.query(User).filter(User.id == p.owner_id).first()
            data.owner_name = owner.full_name if owner else None
        
        result.append(data)
    
    return result


def _build_category_progress(tasks):
    """Build per-category progress dict from tasks."""
    cats = {}
    for t in tasks:
        if t.parent_id is not None:
            continue  # skip subtasks
        cat = t.category or "Uncategorized"
        if cat not in cats:
            cats[cat] = {"total": 0, "completed": 0}
        cats[cat]["total"] += 1
        if t.status == TaskStatus.DONE:
            cats[cat]["completed"] += 1
    return cats


def _enrich_task(t, db, project_title=None):
    """Enrich a task response with subtask_count, progress_pct, assignee_name, assignees, comment_count."""
    data = TaskResponse.model_validate(t)
    data.project_title = project_title
    data.comment_count = db.query(func.count(TaskComment.id)).filter(TaskComment.task_id == t.id).scalar() or 0
    subtasks = t.subtasks if hasattr(t, 'subtasks') and t.subtasks else []
    data.subtask_count = len(subtasks)
    if subtasks:
        done = sum(1 for s in subtasks if s.status == TaskStatus.DONE)
        data.progress_pct = round((done / len(subtasks)) * 100, 1)
    else:
        data.progress_pct = 100.0 if t.status == TaskStatus.DONE else 0.0
    # Legacy single assignee
    if t.assigned_to:
        assignee = db.query(User).filter(User.id == t.assigned_to).first()
        data.assignee_name = assignee.full_name if assignee else None
    # Multi-assignee
    from schemas.project import TaskAssigneeInfo
    if hasattr(t, 'assignees') and t.assignees:
        assignee_list = []
        for ta in t.assignees:
            u = db.query(User).filter(User.id == ta.user_id).first()
            assignee_list.append(TaskAssigneeInfo(user_id=ta.user_id, user_name=u.full_name if u else None))
        data.assignees = assignee_list
        if not data.assignee_name and assignee_list:
            data.assignee_name = assignee_list[0].user_name
    else:
        data.assignees = []
    return data


def _generate_project_number(db: Session, project: Project, org_id: str) -> str | None:
    """Auto-generate: {SO#} - {YYMM} - {Product Code} - {Customer Name}"""
    parts = []
    # SO number
    if project.sales_order_id:
        so = db.query(SalesOrder).filter(SalesOrder.id == project.sales_order_id).first()
        if so:
            parts.append(so.number or "")
    if not parts:
        parts.append(project.id[:8])
    # YYMM from start_date
    if project.start_date:
        parts.append(project.start_date.strftime("%y%m"))
    else:
        from datetime import date
        parts.append(date.today().strftime("%y%m"))
    # Product code(s) from linked SO lines
    if project.sales_order_id:
        lines = db.query(SalesOrderLine).filter(SalesOrderLine.sales_order_id == project.sales_order_id).all()
        codes = []
        for line in lines:
            if line.product_id:
                prod = db.query(Product).filter(Product.id == line.product_id).first()
                if prod and prod.code:
                    codes.append(prod.code)
        if codes:
            parts.append("/".join(dict.fromkeys(codes)))  # unique, order-preserving
    # Customer name
    if project.contact_id:
        contact = db.query(Contact).filter(Contact.id == project.contact_id).first()
        if contact:
            parts.append(contact.name or "")
    return " - ".join(p for p in parts if p)


def _populate_products_from_sales_order(db: Session, project: Project, current_user: User):
    """Auto-populate ProjectProduct rows from the linked sales order lines."""
    lines = db.query(SalesOrderLine).filter(
        SalesOrderLine.sales_order_id == project.sales_order_id
    ).all()
    for line in lines:
        pp = ProjectProduct(
            project_id=project.id,
            org_id=current_user.org_id,
            product_id=line.product_id,
            quantity=line.quantity or Decimal("1"),
            unit_price=line.unit_price,
            source="original",
            status="active",
            is_billable=True,
            sales_order_id=project.sales_order_id,
            added_by=current_user.id,
        )
        db.add(pp)


@router.post("/", response_model=ProjectResponse)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]))
):
    """Create a new project"""
    # Validate contact if provided
    if payload.contact_id:
        contact = db.query(Contact).filter(
            Contact.id == payload.contact_id,
            Contact.org_id == current_user.org_id
        ).first()
        if not contact:
            raise HTTPException(404, "Contact not found")
    
    project = Project(
        org_id=current_user.org_id,
        title=payload.title,
        description=payload.description,
        contact_id=payload.contact_id,
        estimated_govt_fee=payload.estimated_govt_fee,
        start_date=payload.start_date,
        due_date=payload.due_date,
        owner_id=payload.owner_id or current_user.id,
        priority=payload.priority,
        status=ProjectStatus.PLANNING
    )
    
    db.add(project)
    db.flush()

    # Auto-generate project_number: {SO#} - {YYMM} - {Product Code} - {Customer Name}
    project.project_number = _generate_project_number(db, project, current_user.org_id)

    # Auto-populate ProjectProduct from linked sales order
    if project.sales_order_id:
        _populate_products_from_sales_order(db, project, current_user)

    db.commit()
    db.refresh(project)
    
    log_action(
        db, current_user.id, current_user.org_id,
        action="create", resource="project", resource_id=project.id,
        detail=f"Created project: {project.title}"
    )
    
    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get project details"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == current_user.org_id
    ).options(
        joinedload(Project.contact),
        joinedload(Project.tasks)
    ).first()
    
    if not project:
        raise HTTPException(404, "Project not found")
    
    data = ProjectResponse.model_validate(project)
    data.contact_name = project.contact.name if project.contact else None
    parent_tasks = [t for t in project.tasks if t.parent_id is None]
    data.task_count = len(parent_tasks)
    data.completed_task_count = sum(1 for t in parent_tasks if t.status == TaskStatus.DONE)
    data.category_progress = _build_category_progress(project.tasks)
    
    if project.owner_id:
        owner = db.query(User).filter(User.id == project.owner_id).first()
        data.owner_name = owner.full_name if owner else None

    # Collect all linked sales order IDs (originating + from billable products)
    so_ids = set()
    if project.sales_order_id:
        so_ids.add(project.sales_order_id)
    product_so_ids = db.query(ProjectProduct.sales_order_id).filter(
        ProjectProduct.project_id == project_id,
        ProjectProduct.sales_order_id.isnot(None),
    ).all()
    for (sid,) in product_so_ids:
        so_ids.add(sid)
    data.sales_order_ids = list(so_ids) if so_ids else None

    return data


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]))
):
    """Update a project"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == current_user.org_id
    ).first()
    
    if not project:
        raise HTTPException(404, "Project not found")
    
    if payload.title is not None:
        project.title = payload.title
    if payload.description is not None:
        project.description = payload.description
    if payload.status is not None:
        project.status = payload.status
        if payload.status == ProjectStatus.COMPLETED:
            project.completed_at = utcnow()
    if payload.contact_id is not None:
        project.contact_id = payload.contact_id
    if payload.estimated_govt_fee is not None:
        project.estimated_govt_fee = payload.estimated_govt_fee
    if payload.start_date is not None:
        project.start_date = payload.start_date
    if payload.due_date is not None:
        project.due_date = payload.due_date
    if payload.owner_id is not None:
        project.owner_id = payload.owner_id
    if payload.priority is not None:
        project.priority = payload.priority
    
    db.commit()
    db.refresh(project)
    
    log_action(
        db, current_user.id, current_user.org_id,
        action="update", resource="project", resource_id=project.id,
        detail=f"Updated project: {project.title}"
    )
    
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Delete a project"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == current_user.org_id
    ).first()
    
    if not project:
        raise HTTPException(404, "Project not found")
    
    log_action(
        db, current_user.id, current_user.org_id,
        action="delete", resource="project", resource_id=project.id,
        detail=f"Deleted project: {project.title}"
    )
    
    db.delete(project)
    db.commit()
    
    return {"message": "Project deleted successfully"}


# ============= Task Endpoints =============

@router.get("/{project_id}/tasks", response_model=List[TaskResponse])
def list_project_tasks(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all tasks for a project"""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == current_user.org_id
    ).first()
    
    if not project:
        raise HTTPException(404, "Project not found")
    
    tasks = db.query(Task).filter(
        Task.project_id == project_id
    ).order_by(Task.created_at.desc()).all()
    
    return [_enrich_task(t, db, project.title) for t in tasks]


@router.post("/{project_id}/tasks", response_model=TaskResponse)
def create_task(
    project_id: str,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.PRO]))
):
    """Create a new task"""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == current_user.org_id
    ).first()
    
    if not project:
        raise HTTPException(404, "Project not found")
    
    if payload.parent_id:
        parent = db.query(Task).filter(
            Task.id == payload.parent_id,
            Task.project_id == project_id,
            Task.org_id == current_user.org_id,
        ).first()
        if not parent:
            raise HTTPException(404, "Parent task not found in this project")

    task = Task(
        project_id=project_id,
        org_id=current_user.org_id,
        parent_id=payload.parent_id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        category=payload.category,
        due_date=payload.due_date,
        assigned_to=payload.assigned_to,
        date_assigned=utcnow() if payload.assigned_to else None,
        status=TaskStatus.TODO
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)

    # Multi-assignee
    if payload.assignee_ids:
        for uid in payload.assignee_ids:
            db.add(TaskAssignee(task_id=task.id, user_id=uid))
        if not task.assigned_to:
            task.assigned_to = payload.assignee_ids[0]
            task.date_assigned = utcnow()
        db.commit()
        db.refresh(task)
    
    log_action(
        db, current_user.id, current_user.org_id,
        action="create", resource="task", resource_id=task.id,
        detail=f"Created task: {task.title} in project {project.title}"
    )
    
    return _enrich_task(task, db)


@router.get("/{project_id}/tasks/{task_id}/check-funding")
def check_task_funding(
    project_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Red Alert gate: check if client wallet has sufficient funds for this task (vs project estimated govt fee)."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == current_user.org_id
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")
    
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.project_id == project_id,
        Task.org_id == current_user.org_id
    ).first()
    if not task:
        raise HTTPException(404, "Task not found")
    
    estimated = (project.estimated_govt_fee or Decimal("0")).quantize(Decimal("0.01"))
    
    if not project.contact_id:
        return {
            "allowed": True,
            "wallet_balance": None,
            "estimated_govt_fee": float(estimated),
            "shortfall": 0,
            "message": "Project not linked to a contact; no wallet check."
        }
    
    wallet = db.query(ClientWallet).filter(
        ClientWallet.contact_id == project.contact_id,
        ClientWallet.org_id == current_user.org_id
    ).first()
    
    if not wallet:
        return {
            "allowed": False,
            "wallet_balance": None,
            "estimated_govt_fee": float(estimated),
            "shortfall": float(estimated),
            "message": "No wallet found for this project's contact."
        }
    
    balance = wallet.balance.quantize(Decimal("0.01"))
    shortfall = max(Decimal("0"), estimated - balance)
    allowed = balance >= estimated
    
    return {
        "allowed": allowed,
        "wallet_balance": float(balance),
        "wallet_id": wallet.id,
        "estimated_govt_fee": float(estimated),
        "shortfall": float(shortfall),
        "currency": wallet.currency,
        "message": "Sufficient funds." if allowed else f"Insufficient funds. Shortfall: {shortfall} {wallet.currency}."
    }


# ============= My Tasks (cross-project) =============

@router.get("/tasks/my", response_model=List[TaskResponse])
def list_my_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return all tasks assigned to the current user across all projects."""
    from sqlalchemy import or_
    tasks = (
        db.query(Task)
        .options(joinedload(Task.assignees))
        .filter(
            Task.org_id == current_user.org_id,
            or_(
                Task.assigned_to == current_user.id,
                Task.assignees.any(TaskAssignee.user_id == current_user.id),
            ),
        )
        .order_by(Task.sort_order.asc().nullslast(), Task.created_at.desc())
        .all()
    )
    result = []
    for t in tasks:
        project = db.query(Project).filter(Project.id == t.project_id).first()
        result.append(_enrich_task(t, db, project.title if project else None))
    return result


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: str,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a task"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.org_id == current_user.org_id
    ).first()
    
    if not task:
        raise HTTPException(404, "Task not found")
    
    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.status is not None:
        task.status = payload.status
        if payload.status == TaskStatus.DONE:
            task.completed_at = utcnow()
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.category is not None:
        task.category = payload.category
    if payload.due_date is not None:
        task.due_date = payload.due_date
    old_assignee = task.assigned_to
    if payload.assigned_to is not None:
        if not task.assigned_to and payload.assigned_to:
            task.date_assigned = utcnow()
        task.assigned_to = payload.assigned_to

    # Multi-assignee sync
    if payload.assignee_ids is not None:
        existing = {ta.user_id for ta in task.assignees} if task.assignees else set()
        new_set = set(payload.assignee_ids)
        # Remove unselected
        for ta in list(task.assignees or []):
            if ta.user_id not in new_set:
                db.delete(ta)
        # Add new
        for uid in new_set - existing:
            db.add(TaskAssignee(task_id=task.id, user_id=uid))
        # Sync legacy assigned_to to first assignee
        if payload.assignee_ids:
            task.assigned_to = payload.assignee_ids[0]
            if not task.date_assigned:
                task.date_assigned = utcnow()
        # Notify newly added assignees
        for uid in new_set - existing:
            if uid != current_user.id:
                db.add(Notification(
                    org_id=current_user.org_id, user_id=uid,
                    title="Task Assigned",
                    message=f"{current_user.full_name} assigned you to task \"{task.title}\".",
                    category="task", resource_type="task", resource_id=task.id,
                ))
    
    db.commit()
    db.refresh(task)
    
    # Notify new single assignee (legacy path)
    if payload.assigned_to and payload.assigned_to != old_assignee and payload.assigned_to != current_user.id and payload.assignee_ids is None:
        notif = Notification(
            org_id=current_user.org_id,
            user_id=payload.assigned_to,
            title="Task Assigned",
            message=f"{current_user.full_name} assigned you to task \"{task.title}\".",
            category="task",
            resource_type="task",
            resource_id=task.id,
        )
        db.add(notif)
        db.commit()

    # Auto-completion: check if all parent tasks in the project are done
    if task.status == TaskStatus.DONE and task.parent_id is None:
        _check_project_auto_complete(db, task.project_id, current_user)
    
    log_action(
        db, current_user.id, current_user.org_id,
        action="update", resource="task", resource_id=task.id,
        detail=f"Updated task: {task.title}"
    )
    
    return _enrich_task(task, db)


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]))
):
    """Delete a task"""
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.org_id == current_user.org_id
    ).first()
    
    if not task:
        raise HTTPException(404, "Task not found")
    
    log_action(
        db, current_user.id, current_user.org_id,
        action="delete", resource="task", resource_id=task.id,
        detail=f"Deleted task: {task.title}"
    )
    
    db.delete(task)
    db.commit()
    
    return {"message": "Task deleted successfully"}


def _check_project_auto_complete(db: Session, project_id: str, current_user: User):
    """If all parent tasks are done, auto-set project to completed."""
    parent_tasks = db.query(Task).filter(
        Task.project_id == project_id,
        Task.parent_id == None,
    ).all()
    if not parent_tasks:
        return
    if all(t.status == TaskStatus.DONE for t in parent_tasks):
        project = db.query(Project).filter(Project.id == project_id).first()
        if project and project.status != ProjectStatus.COMPLETED:
            project.status = ProjectStatus.COMPLETED
            project.completed_at = utcnow()
            # Notify project owner
            if project.owner_id:
                notif = Notification(
                    org_id=project.org_id,
                    user_id=project.owner_id,
                    title="Project Completed",
                    message=f"All tasks done — project \"{project.title}\" has been auto-completed.",
                    category="project",
                    resource_type="project",
                    resource_id=project_id,
                )
                db.add(notif)
            db.commit()
            log_action(
                db, current_user.id, current_user.org_id,
                action="auto_complete", resource="project", resource_id=project_id,
                detail="All tasks done — project auto-completed"
            )


# ============= Task Comments =============

def _enrich_comment(db: Session, c: TaskComment) -> dict:
    """Build a comment response dict with user_name, reactions, reply_count."""
    user_name = None
    if c.user_id:
        u = db.query(User).filter(User.id == c.user_id).first()
        user_name = u.full_name if u else None
    # aggregate reactions (SQLite-compatible)
    all_rxns = db.query(CommentReaction).filter(CommentReaction.comment_id == c.id).all()
    emoji_map: dict = {}
    for r in all_rxns:
        if r.emoji not in emoji_map:
            emoji_map[r.emoji] = {"count": 0, "user_ids": []}
        emoji_map[r.emoji]["count"] += 1
        emoji_map[r.emoji]["user_ids"].append(r.user_id)
    reactions = [ReactionResponse(emoji=e, count=d["count"], user_ids=d["user_ids"]) for e, d in emoji_map.items()]
    reply_count = db.query(func.count(TaskComment.id)).filter(TaskComment.parent_id == c.id).scalar() or 0
    return {
        "id": c.id, "task_id": c.task_id, "user_id": c.user_id, "content": c.content,
        "user_name": user_name, "parent_id": c.parent_id,
        "reactions": reactions, "reply_count": reply_count, "created_at": c.created_at,
    }


@router.get("/tasks/{task_id}/comments")
def list_task_comments(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id, Task.org_id == current_user.org_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    comments = db.query(TaskComment).filter(TaskComment.task_id == task_id).order_by(TaskComment.created_at.asc()).all()
    return [_enrich_comment(db, c) for c in comments]


@router.post("/tasks/{task_id}/comments", status_code=201)
def create_task_comment(
    task_id: str,
    payload: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id, Task.org_id == current_user.org_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    comment = TaskComment(
        task_id=task_id,
        org_id=current_user.org_id,
        user_id=current_user.id,
        content=payload.content,
        parent_id=payload.parent_id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _enrich_comment(db, comment)


@router.delete("/tasks/{task_id}/comments/{comment_id}", status_code=204)
def delete_task_comment(
    task_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete own comment on a task."""
    comment = db.query(TaskComment).filter(
        TaskComment.id == comment_id,
        TaskComment.task_id == task_id,
        TaskComment.org_id == current_user.org_id,
    ).first()
    if not comment:
        raise HTTPException(404, "Comment not found")
    if comment.user_id != current_user.id and current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(403, "Cannot delete another user's comment")
    db.delete(comment)
    db.commit()


@router.post("/tasks/{task_id}/comments/{comment_id}/reactions")
def toggle_reaction(
    task_id: str,
    comment_id: str,
    payload: ReactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle an emoji reaction on a comment. If already reacted with same emoji, remove it."""
    comment = db.query(TaskComment).filter(
        TaskComment.id == comment_id, TaskComment.task_id == task_id,
        TaskComment.org_id == current_user.org_id,
    ).first()
    if not comment:
        raise HTTPException(404, "Comment not found")
    existing = db.query(CommentReaction).filter(
        CommentReaction.comment_id == comment_id,
        CommentReaction.user_id == current_user.id,
        CommentReaction.emoji == payload.emoji,
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"action": "removed", "emoji": payload.emoji}
    rxn = CommentReaction(
        comment_id=comment_id, user_id=current_user.id,
        org_id=current_user.org_id, emoji=payload.emoji,
    )
    db.add(rxn)
    db.commit()
    return {"action": "added", "emoji": payload.emoji}


# ============= Task Attachments =============

@router.get("/tasks/{task_id}/attachments")
def list_attachments(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id, Task.org_id == current_user.org_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    atts = db.query(TaskAttachment).filter(TaskAttachment.task_id == task_id).order_by(TaskAttachment.created_at.desc()).all()
    result = []
    for a in atts:
        user_name = None
        if a.user_id:
            u = db.query(User).filter(User.id == a.user_id).first()
            user_name = u.full_name if u else None
        result.append({
            "id": a.id, "filename": a.filename, "file_size": a.file_size,
            "mime_type": a.mime_type, "user_name": user_name, "created_at": a.created_at,
        })
    return result


@router.post("/tasks/{task_id}/attachments")
async def upload_attachment(
    task_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import os, uuid as _uuid
    task = db.query(Task).filter(Task.id == task_id, Task.org_id == current_user.org_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    upload_dir = os.path.join("uploads", "tasks", task_id)
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "file")[1]
    stored_name = f"{_uuid.uuid4().hex}{ext}"
    file_path = os.path.join(upload_dir, stored_name)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    att = TaskAttachment(
        task_id=task_id, org_id=current_user.org_id, user_id=current_user.id,
        filename=file.filename or "file", file_path=file_path,
        file_size=len(content), mime_type=file.content_type,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return {"id": att.id, "filename": att.filename, "file_size": att.file_size, "mime_type": att.mime_type}


@router.get("/tasks/{task_id}/attachments/{attachment_id}/download")
def download_attachment(
    task_id: str,
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import os
    att = db.query(TaskAttachment).filter(
        TaskAttachment.id == attachment_id, TaskAttachment.task_id == task_id,
        TaskAttachment.org_id == current_user.org_id,
    ).first()
    if not att:
        raise HTTPException(404, "Attachment not found")
    if not os.path.isfile(att.file_path):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(att.file_path, filename=att.filename, media_type=att.mime_type or "application/octet-stream")


@router.delete("/tasks/{task_id}/attachments/{attachment_id}", status_code=204)
def delete_attachment(
    task_id: str,
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import os
    att = db.query(TaskAttachment).filter(
        TaskAttachment.id == attachment_id, TaskAttachment.task_id == task_id,
        TaskAttachment.org_id == current_user.org_id,
    ).first()
    if not att:
        raise HTTPException(404, "Attachment not found")
    if att.user_id != current_user.id and current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(403, "Cannot delete another user's attachment")
    if os.path.isfile(att.file_path):
        os.remove(att.file_path)
    db.delete(att)
    db.commit()


# ============= Task Dependencies (Gantt) =============

@router.get("/tasks/{task_id}/dependencies")
def list_task_dependencies(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all dependencies where this task is predecessor or successor."""
    task = db.query(Task).filter(Task.id == task_id, Task.org_id == current_user.org_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    deps = db.query(TaskDependency).filter(
        (TaskDependency.predecessor_id == task_id) | (TaskDependency.successor_id == task_id),
        TaskDependency.org_id == current_user.org_id,
    ).all()
    result = []
    for d in deps:
        pred = db.query(Task).filter(Task.id == d.predecessor_id).first()
        succ = db.query(Task).filter(Task.id == d.successor_id).first()
        result.append({
            "id": d.id,
            "predecessor_id": d.predecessor_id,
            "predecessor_title": pred.title if pred else None,
            "successor_id": d.successor_id,
            "successor_title": succ.title if succ else None,
            "dependency_type": d.dependency_type,
        })
    return result


@router.get("/{project_id}/dependencies")
def list_project_dependencies(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all task dependencies within a project (for Gantt view)."""
    project = db.query(Project).filter(Project.id == project_id, Project.org_id == current_user.org_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    task_ids = [t.id for t in db.query(Task.id).filter(Task.project_id == project_id).all()]
    if not task_ids:
        return []
    deps = db.query(TaskDependency).filter(
        TaskDependency.predecessor_id.in_(task_ids),
        TaskDependency.org_id == current_user.org_id,
    ).all()
    return [{"id": d.id, "predecessor_id": d.predecessor_id, "successor_id": d.successor_id, "dependency_type": d.dependency_type} for d in deps]


@router.post("/tasks/{task_id}/dependencies", status_code=201)
def create_dependency(
    task_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a dependency. task_id is the successor; payload.predecessor_id is the predecessor."""
    predecessor_id = payload.get("predecessor_id")
    dep_type = payload.get("dependency_type", "finish_to_start")
    if not predecessor_id:
        raise HTTPException(400, "predecessor_id is required")
    if predecessor_id == task_id:
        raise HTTPException(400, "A task cannot depend on itself")
    org = current_user.org_id
    pred = db.query(Task).filter(Task.id == predecessor_id, Task.org_id == org).first()
    succ = db.query(Task).filter(Task.id == task_id, Task.org_id == org).first()
    if not pred or not succ:
        raise HTTPException(404, "Task not found")
    existing = db.query(TaskDependency).filter(
        TaskDependency.predecessor_id == predecessor_id,
        TaskDependency.successor_id == task_id,
    ).first()
    if existing:
        return {"id": existing.id, "already_exists": True}
    dep = TaskDependency(
        predecessor_id=predecessor_id, successor_id=task_id,
        org_id=org, dependency_type=dep_type,
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return {"id": dep.id, "predecessor_id": predecessor_id, "successor_id": task_id, "dependency_type": dep_type}


@router.delete("/dependencies/{dep_id}", status_code=204)
def delete_dependency(
    dep_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dep = db.query(TaskDependency).filter(
        TaskDependency.id == dep_id, TaskDependency.org_id == current_user.org_id,
    ).first()
    if not dep:
        raise HTTPException(404, "Dependency not found")
    db.delete(dep)
    db.commit()


# ============= Dashboard Summary =============

@router.get("/dashboard/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Aggregated dashboard counts."""
    org = current_user.org_id
    total_projects = db.query(func.count(Project.id)).filter(
        Project.org_id == org, Project.status == ProjectStatus.IN_PROGRESS
    ).scalar() or 0
    total_tasks = db.query(func.count(Task.id)).filter(Task.org_id == org).scalar() or 0
    in_progress = db.query(func.count(Task.id)).filter(
        Task.org_id == org, Task.status == TaskStatus.IN_PROGRESS
    ).scalar() or 0
    completed = db.query(func.count(Task.id)).filter(
        Task.org_id == org, Task.status == TaskStatus.DONE
    ).scalar() or 0
    return {
        "total_projects": total_projects,
        "total_tasks": total_tasks,
        "in_progress_tasks": in_progress,
        "completed_tasks": completed,
    }


# ═══════════════════════════════════════════════════════
#  Favorites / Pinned Projects
# ═══════════════════════════════════════════════════════

@router.get("/favorites")
def list_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List current user's favourite / pinned projects."""
    favs = (
        db.query(UserFavorite)
        .filter(UserFavorite.user_id == current_user.id, UserFavorite.org_id == current_user.org_id)
        .order_by(UserFavorite.sort_order)
        .all()
    )
    result = []
    for f in favs:
        proj = db.query(Project).filter(Project.id == f.project_id).first()
        if proj:
            result.append({
                "id": f.id,
                "project_id": proj.id,
                "project_title": proj.title,
                "project_status": proj.status.value if proj.status else None,
                "sort_order": f.sort_order,
            })
    return result


@router.post("/favorites/{project_id}")
def add_favorite(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pin a project as favourite."""
    org = current_user.org_id
    proj = db.query(Project).filter(Project.id == project_id, Project.org_id == org).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    existing = db.query(UserFavorite).filter(
        UserFavorite.user_id == current_user.id, UserFavorite.project_id == project_id
    ).first()
    if existing:
        return {"id": existing.id, "project_id": project_id, "already_exists": True}
    max_order = db.query(func.max(UserFavorite.sort_order)).filter(
        UserFavorite.user_id == current_user.id
    ).scalar() or 0
    fav = UserFavorite(
        user_id=current_user.id, org_id=org,
        project_id=project_id, sort_order=max_order + 1,
    )
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return {"id": fav.id, "project_id": project_id}


@router.delete("/favorites/{project_id}")
def remove_favorite(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unpin a project."""
    fav = db.query(UserFavorite).filter(
        UserFavorite.user_id == current_user.id, UserFavorite.project_id == project_id
    ).first()
    if not fav:
        raise HTTPException(status_code=404, detail="Favorite not found")
    db.delete(fav)
    db.commit()
    return {"ok": True}
