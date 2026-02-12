"""Activity API: CRUD for scheduled activities (calendar events) linked to projects."""
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.project import Project
from models.contact import Contact
from models.notification import Notification
from models.activity import (
    Activity,
    ActivityType,
    ActivityStatus,
    ActivityReminder,
    ActivityRecurrence,
    ActivityAssignee,
)
from models.base import utcnow
from services.audit import log_action
from schemas.activity import ActivityCreate, ActivityUpdate, ActivityResponse, ActivityAssigneeInfo

router = APIRouter(prefix="/api/activities", tags=["Activities"])


def _enrich_activity(a: Activity, db: Session) -> ActivityResponse:
    """Build an enriched ActivityResponse from an Activity ORM object."""
    data = ActivityResponse.model_validate(a)
    if a.assigned_to:
        u = db.query(User).filter(User.id == a.assigned_to).first()
        data.assigned_to_name = u.full_name if u else None
    if a.created_by:
        u = db.query(User).filter(User.id == a.created_by).first()
        data.created_by_name = u.full_name if u else None
    if a.project:
        data.project_title = a.project.title
    elif a.project_id:
        p = db.query(Project).filter(Project.id == a.project_id).first()
        data.project_title = p.title if p else None
    if a.contact_id:
        c = db.query(Contact).filter(Contact.id == a.contact_id).first()
        data.contact_name = c.name if c else None
    # Compute overdue
    now = datetime.now(timezone.utc)
    if a.status == ActivityStatus.PENDING and a.end_datetime:
        end = a.end_datetime if a.end_datetime.tzinfo else a.end_datetime.replace(tzinfo=timezone.utc)
        data.is_overdue = now > end
    # Multi-assignees
    assignee_rows = db.query(ActivityAssignee).filter(ActivityAssignee.activity_id == a.id).all()
    for row in assignee_rows:
        u = db.query(User).filter(User.id == row.user_id).first()
        if u:
            data.assignees.append(ActivityAssigneeInfo(id=u.id, full_name=u.full_name))
    return data


def _create_next_recurring(db: Session, activity: Activity):
    """After completing a recurring activity, auto-create the next occurrence."""
    if activity.recurrence == ActivityRecurrence.NONE:
        return
    delta_map = {
        ActivityRecurrence.DAILY: timedelta(days=1),
        ActivityRecurrence.WEEKLY: timedelta(weeks=1),
        ActivityRecurrence.MONTHLY: timedelta(days=30),
    }
    delta = delta_map.get(activity.recurrence)
    if not delta:
        return
    next_activity = Activity(
        org_id=activity.org_id,
        project_id=activity.project_id,
        contact_id=activity.contact_id,
        title=activity.title,
        description=activity.description,
        activity_type=activity.activity_type,
        location=activity.location,
        start_datetime=activity.start_datetime + delta,
        end_datetime=activity.end_datetime + delta,
        reminder=activity.reminder,
        recurrence=activity.recurrence,
        status=ActivityStatus.PENDING,
        assigned_to=activity.assigned_to,
        created_by=activity.created_by,
    )
    db.add(next_activity)


# ============= Project-Scoped Endpoints =============

@router.get("/project/{project_id}", response_model=List[ActivityResponse])
def list_project_activities(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all activities for a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == current_user.org_id,
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")
    activities = (
        db.query(Activity)
        .filter(Activity.project_id == project_id, Activity.org_id == current_user.org_id)
        .order_by(Activity.start_datetime.asc())
        .all()
    )
    return [_enrich_activity(a, db) for a in activities]


@router.post("/project/{project_id}", response_model=ActivityResponse, status_code=201)
def create_project_activity(
    project_id: str,
    payload: ActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create an activity within a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.org_id == current_user.org_id,
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")
    if payload.contact_id:
        contact = db.query(Contact).filter(
            Contact.id == payload.contact_id,
            Contact.org_id == current_user.org_id,
        ).first()
        if not contact:
            raise HTTPException(404, "Contact not found")
    if payload.end_datetime <= payload.start_datetime:
        raise HTTPException(400, "End datetime must be after start datetime")

    # Resolve assignee: prefer assigned_to_ids list, fall back to single assigned_to
    assignee_ids = payload.assigned_to_ids if payload.assigned_to_ids else ([payload.assigned_to] if payload.assigned_to else [])
    primary_assignee = assignee_ids[0] if assignee_ids else None

    activity = Activity(
        org_id=current_user.org_id,
        project_id=project_id,
        contact_id=payload.contact_id,
        title=payload.title,
        description=payload.description,
        activity_type=payload.activity_type,
        location=payload.location,
        start_datetime=payload.start_datetime,
        end_datetime=payload.end_datetime,
        reminder=payload.reminder,
        recurrence=payload.recurrence,
        status=ActivityStatus.PENDING,
        assigned_to=primary_assignee,
        created_by=current_user.id,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)

    # Insert M2M assignees
    for uid in assignee_ids:
        db.add(ActivityAssignee(activity_id=activity.id, user_id=uid))
    if assignee_ids:
        db.commit()

    # Notify each assignee (except creator)
    for uid in assignee_ids:
        if uid != current_user.id:
            db.add(Notification(
                org_id=current_user.org_id,
                user_id=uid,
                title="Activity Assigned",
                message=f'{current_user.full_name} assigned you activity "{activity.title}" in project "{project.title}".',
                category="activity",
                resource_type="activity",
                resource_id=activity.id,
            ))
    db.commit()

    log_action(db, action="create", user_id=current_user.id, org_id=current_user.org_id,
               resource="activity", resource_id=activity.id,
               detail=f'Created activity: {activity.title} in project {project.title}')

    return _enrich_activity(activity, db)


# ============= Global Endpoints (Calendar) =============

@router.get("/", response_model=List[ActivityResponse])
def list_activities(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    assigned_to: Optional[str] = None,
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all org activities with optional filters (for calendar view)."""
    query = db.query(Activity).filter(Activity.org_id == current_user.org_id)

    if start_date:
        try:
            sd = datetime.fromisoformat(start_date)
            query = query.filter(Activity.end_datetime >= sd)
        except ValueError:
            pass
    if end_date:
        try:
            ed = datetime.fromisoformat(end_date)
            query = query.filter(Activity.start_datetime <= ed)
        except ValueError:
            pass
    if assigned_to:
        query = query.filter(Activity.assigned_to == assigned_to)
    if project_id:
        query = query.filter(Activity.project_id == project_id)
    if status:
        query = query.filter(Activity.status == status)

    activities = query.order_by(Activity.start_datetime.asc()).all()
    return [_enrich_activity(a, db) for a in activities]


@router.get("/today", response_model=List[ActivityResponse])
def list_today_activities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get today's activities for the current user (dashboard widget)."""
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    activities = (
        db.query(Activity)
        .filter(
            Activity.org_id == current_user.org_id,
            Activity.assigned_to == current_user.id,
            Activity.start_datetime < day_end,
            Activity.end_datetime >= day_start,
        )
        .order_by(Activity.start_datetime.asc())
        .all()
    )
    # Also include overdue (pending, past end_datetime, before today)
    overdue = (
        db.query(Activity)
        .filter(
            Activity.org_id == current_user.org_id,
            Activity.assigned_to == current_user.id,
            Activity.status == ActivityStatus.PENDING,
            Activity.end_datetime < day_start,
        )
        .order_by(Activity.start_datetime.asc())
        .all()
    )
    seen_ids = {a.id for a in activities}
    combined = list(overdue) + [a for a in activities if a.id not in {o.id for o in overdue}]
    return [_enrich_activity(a, db) for a in combined]


@router.get("/{activity_id}", response_model=ActivityResponse)
def get_activity(
    activity_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single activity by ID."""
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.org_id == current_user.org_id,
    ).first()
    if not activity:
        raise HTTPException(404, "Activity not found")
    return _enrich_activity(activity, db)


@router.patch("/{activity_id}", response_model=ActivityResponse)
def update_activity(
    activity_id: str,
    payload: ActivityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an activity."""
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.org_id == current_user.org_id,
    ).first()
    if not activity:
        raise HTTPException(404, "Activity not found")

    old_assignee = activity.assigned_to

    if payload.title is not None:
        activity.title = payload.title
    if payload.description is not None:
        activity.description = payload.description
    if payload.activity_type is not None:
        activity.activity_type = payload.activity_type
    if payload.contact_id is not None:
        activity.contact_id = payload.contact_id or None
    if payload.assigned_to is not None:
        activity.assigned_to = payload.assigned_to or None
    if payload.start_datetime is not None:
        activity.start_datetime = payload.start_datetime
    if payload.end_datetime is not None:
        activity.end_datetime = payload.end_datetime
    if payload.location is not None:
        activity.location = payload.location
    if payload.reminder is not None:
        activity.reminder = payload.reminder
    if payload.recurrence is not None:
        activity.recurrence = payload.recurrence

    # Status change → completed
    if payload.status is not None:
        activity.status = payload.status
        if payload.status == ActivityStatus.COMPLETED.value:
            activity.completed_at = utcnow()
            if payload.completion_notes:
                activity.completion_notes = payload.completion_notes
            # Auto-create next occurrence for recurring
            _create_next_recurring(db, activity)
    elif payload.completion_notes is not None:
        activity.completion_notes = payload.completion_notes

    # Sync M2M assignees if provided
    if payload.assigned_to_ids is not None:
        # Delete old assignees
        db.query(ActivityAssignee).filter(ActivityAssignee.activity_id == activity.id).delete()
        # Set primary assignee
        if payload.assigned_to_ids:
            activity.assigned_to = payload.assigned_to_ids[0]
        # Insert new assignees
        for uid in payload.assigned_to_ids:
            db.add(ActivityAssignee(activity_id=activity.id, user_id=uid))

    db.commit()
    db.refresh(activity)

    # Notify new assignees
    old_assignee_set = {old_assignee} if old_assignee else set()
    new_assignee_ids = payload.assigned_to_ids if payload.assigned_to_ids is not None else ([payload.assigned_to] if payload.assigned_to and payload.assigned_to != old_assignee else [])
    for uid in new_assignee_ids:
        if uid and uid not in old_assignee_set and uid != current_user.id:
            project = db.query(Project).filter(Project.id == activity.project_id).first()
            db.add(Notification(
                org_id=current_user.org_id,
                user_id=uid,
                title="Activity Assigned",
                message=f'{current_user.full_name} assigned you activity "{activity.title}"' + (f' in project "{project.title}".' if project else "."),
                category="activity",
                resource_type="activity",
                resource_id=activity.id,
            ))
    db.commit()

    log_action(db, action="update", user_id=current_user.id, org_id=current_user.org_id,
               resource="activity", resource_id=activity.id,
               detail=f"Updated activity: {activity.title}")

    return _enrich_activity(activity, db)


@router.delete("/{activity_id}", status_code=204)
def delete_activity(
    activity_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an activity."""
    activity = db.query(Activity).filter(
        Activity.id == activity_id,
        Activity.org_id == current_user.org_id,
    ).first()
    if not activity:
        raise HTTPException(404, "Activity not found")

    log_action(db, action="delete", user_id=current_user.id, org_id=current_user.org_id,
               resource="activity", resource_id=activity.id,
               detail=f"Deleted activity: {activity.title}")
    db.delete(activity)
    db.commit()
