"""
Seed showcase data — adds rich tasks, comments, reactions, dependencies,
attachments metadata, and favorites to demonstrate all new features.

Run:  python -m scripts.seed_showcase
"""
import os, sys
from datetime import datetime, timezone, timedelta
from decimal import Decimal

_backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend not in sys.path:
    sys.path.insert(0, _backend)
os.chdir(_backend)

from sqlalchemy.orm import Session
from core.database import SessionLocal, engine, Base
from core.security import hash_password
from models.base import generate_uuid
import models  # noqa

from models.organization import Organization
from models.user import User, UserRole
from models.contact import Contact, ContactType, ContactStatus
from models.project import (
    Project, Task, TaskAssignee, ProjectStatus, TaskStatus, TaskPriority,
    TaskComment, CommentReaction, TaskAttachment, TaskDependency, UserFavorite,
)
from models.activity import Activity, ActivityType, ActivityStatus

# Ensure tables exist
Base.metadata.create_all(bind=engine)

NOW = datetime.now(timezone.utc)
DAY = timedelta(days=1)


def get_or_create_users(db: Session, org_id: str):
    """Ensure we have 3 users for multi-assignee demos."""
    users = []
    user_data = [
        ("demo@csp.local", "Demo User", UserRole.ADMIN),
        ("sarah@csp.local", "Sarah Ahmed", UserRole.MANAGER),
        ("omar@csp.local", "Omar Khalid", UserRole.PRO),
    ]
    for email, name, role in user_data:
        u = db.query(User).filter(User.email == email, User.org_id == org_id).first()
        if not u:
            u = User(
                email=email,
                hashed_password=hash_password("demo123"),
                full_name=name,
                role=role,
                org_id=org_id,
                is_active=True,
            )
            db.add(u)
            db.flush()
            print(f"  Created user: {email}")
        users.append(u)
    return users


def seed_showcase_projects(db: Session, org_id: str, users: list):
    """Create 3 projects with diverse tasks across all statuses."""
    demo = users[0]
    sarah = users[1]
    omar = users[2]

    # Find a contact to link
    contact = db.query(Contact).filter(Contact.org_id == org_id).first()
    contact_id = contact.id if contact else None

    projects_data = [
        {
            "title": "Company Formation - Al Reef Technologies",
            "description": "Full company formation package including trade license, visa processing, office setup, and compliance registration.",
            "status": ProjectStatus.IN_PROGRESS,
            "priority": "high",
            "start_date": NOW - 10 * DAY,
            "due_date": NOW + 20 * DAY,
            "tasks": [
                {"title": "Prepare incorporation documents", "status": TaskStatus.DONE, "priority": TaskPriority.HIGH, "category": "Compliance",
                 "start_date": NOW - 10 * DAY, "due_date": NOW - 7 * DAY, "assigned": [demo, sarah]},
                {"title": "Submit to DED for approval", "status": TaskStatus.DONE, "priority": TaskPriority.HIGH, "category": "Authority",
                 "start_date": NOW - 7 * DAY, "due_date": NOW - 4 * DAY, "assigned": [sarah]},
                {"title": "Obtain initial approval letter", "status": TaskStatus.DONE, "priority": TaskPriority.MEDIUM, "category": "Authority",
                 "start_date": NOW - 4 * DAY, "due_date": NOW - 2 * DAY, "assigned": [sarah]},
                {"title": "Draft Memorandum of Association", "status": TaskStatus.IN_PROGRESS, "priority": TaskPriority.HIGH, "category": "Compliance",
                 "start_date": NOW - 2 * DAY, "due_date": NOW + 2 * DAY, "assigned": [demo, omar]},
                {"title": "Office lease agreement", "status": TaskStatus.IN_PROGRESS, "priority": TaskPriority.MEDIUM, "category": "Operations",
                 "start_date": NOW - 1 * DAY, "due_date": NOW + 5 * DAY, "assigned": [omar]},
                {"title": "Pay government fees", "status": TaskStatus.TODO, "priority": TaskPriority.HIGH, "category": "Sales",
                 "start_date": NOW + 2 * DAY, "due_date": NOW + 4 * DAY, "assigned": [demo]},
                {"title": "Collect trade license", "status": TaskStatus.TODO, "priority": TaskPriority.MEDIUM, "category": "Authority",
                 "start_date": NOW + 5 * DAY, "due_date": NOW + 8 * DAY, "assigned": [sarah]},
                {"title": "Apply for investor visa", "status": TaskStatus.TODO, "priority": TaskPriority.HIGH, "category": "Authority",
                 "start_date": NOW + 8 * DAY, "due_date": NOW + 15 * DAY, "assigned": [sarah, omar]},
                {"title": "Open corporate bank account", "status": TaskStatus.TODO, "priority": TaskPriority.MEDIUM, "category": "Operations",
                 "start_date": NOW + 10 * DAY, "due_date": NOW + 18 * DAY, "assigned": [demo]},
                {"title": "Final compliance review", "status": TaskStatus.TODO, "priority": TaskPriority.URGENT, "category": "Compliance",
                 "start_date": NOW + 15 * DAY, "due_date": NOW + 20 * DAY, "assigned": [demo, sarah, omar]},
            ],
        },
        {
            "title": "VAT Registration - Desert Sands Consulting",
            "description": "Complete VAT registration with FTA including documentation review, submission, and certificate collection.",
            "status": ProjectStatus.IN_PROGRESS,
            "priority": "medium",
            "start_date": NOW - 5 * DAY,
            "due_date": NOW + 10 * DAY,
            "tasks": [
                {"title": "Collect financial statements", "status": TaskStatus.DONE, "priority": TaskPriority.HIGH, "category": "Compliance",
                 "start_date": NOW - 5 * DAY, "due_date": NOW - 3 * DAY, "assigned": [omar]},
                {"title": "Review VAT threshold eligibility", "status": TaskStatus.DONE, "priority": TaskPriority.MEDIUM, "category": "Compliance",
                 "start_date": NOW - 3 * DAY, "due_date": NOW - 1 * DAY, "assigned": [demo]},
                {"title": "Prepare FTA registration form", "status": TaskStatus.IN_PROGRESS, "priority": TaskPriority.HIGH, "category": "Authority",
                 "start_date": NOW - 1 * DAY, "due_date": NOW + 2 * DAY, "assigned": [sarah]},
                {"title": "Submit to FTA portal", "status": TaskStatus.TODO, "priority": TaskPriority.HIGH, "category": "Authority",
                 "start_date": NOW + 2 * DAY, "due_date": NOW + 4 * DAY, "assigned": [sarah]},
                {"title": "Follow up on approval", "status": TaskStatus.TODO, "priority": TaskPriority.MEDIUM, "category": "Authority",
                 "start_date": NOW + 4 * DAY, "due_date": NOW + 8 * DAY, "assigned": [omar]},
                {"title": "Collect TRN certificate", "status": TaskStatus.TODO, "priority": TaskPriority.LOW, "category": "Authority",
                 "start_date": NOW + 8 * DAY, "due_date": NOW + 10 * DAY, "assigned": [demo]},
            ],
        },
        {
            "title": "Annual License Renewal - Gulf Trading LLC",
            "description": "Renewal of trade license and all associated permits for Gulf Trading LLC. Includes compliance check and document updates.",
            "status": ProjectStatus.PLANNING,
            "priority": "low",
            "start_date": NOW + 5 * DAY,
            "due_date": NOW + 35 * DAY,
            "tasks": [
                {"title": "Audit current license status", "status": TaskStatus.TODO, "priority": TaskPriority.MEDIUM, "category": "Compliance",
                 "start_date": NOW + 5 * DAY, "due_date": NOW + 10 * DAY, "assigned": [demo]},
                {"title": "Renew tenancy contract", "status": TaskStatus.TODO, "priority": TaskPriority.HIGH, "category": "Operations",
                 "start_date": NOW + 7 * DAY, "due_date": NOW + 15 * DAY, "assigned": [omar]},
                {"title": "Update MOA if needed", "status": TaskStatus.TODO, "priority": TaskPriority.LOW, "category": "Compliance",
                 "start_date": NOW + 10 * DAY, "due_date": NOW + 20 * DAY, "assigned": [sarah]},
                {"title": "Submit renewal application", "status": TaskStatus.TODO, "priority": TaskPriority.HIGH, "category": "Authority",
                 "start_date": NOW + 20 * DAY, "due_date": NOW + 25 * DAY, "assigned": [sarah, demo]},
                {"title": "Pay renewal fees", "status": TaskStatus.TODO, "priority": TaskPriority.MEDIUM, "category": "Sales",
                 "start_date": NOW + 25 * DAY, "due_date": NOW + 30 * DAY, "assigned": [demo]},
            ],
        },
    ]

    created_projects = []
    all_tasks = []

    for pdata in projects_data:
        existing = db.query(Project).filter(Project.org_id == org_id, Project.title == pdata["title"]).first()
        if existing:
            print(f"  Project already exists: {pdata['title'][:40]}...")
            created_projects.append(existing)
            all_tasks.extend(db.query(Task).filter(Task.project_id == existing.id).all())
            continue

        proj = Project(
            org_id=org_id,
            title=pdata["title"],
            description=pdata["description"],
            status=pdata["status"],
            priority=pdata["priority"],
            start_date=pdata["start_date"],
            due_date=pdata["due_date"],
            contact_id=contact_id,
            owner_id=demo.id,
        )
        db.add(proj)
        db.flush()
        created_projects.append(proj)

        prev_task = None
        for i, tdata in enumerate(pdata["tasks"]):
            t = Task(
                project_id=proj.id,
                org_id=org_id,
                title=tdata["title"],
                status=tdata["status"],
                priority=tdata["priority"],
                category=tdata.get("category"),
                start_date=tdata.get("start_date"),
                due_date=tdata.get("due_date"),
                assigned_to=tdata["assigned"][0].id if tdata.get("assigned") else None,
                sort_order=i,
            )
            db.add(t)
            db.flush()
            all_tasks.append(t)

            # Multi-assignees
            for assignee in tdata.get("assigned", []):
                db.add(TaskAssignee(task_id=t.id, user_id=assignee.id))

            # Dependencies: each task depends on the previous one (Gantt chain)
            if prev_task and i > 0:
                db.add(TaskDependency(
                    predecessor_id=prev_task.id,
                    successor_id=t.id,
                    org_id=org_id,
                    dependency_type="finish_to_start",
                ))
            prev_task = t

        print(f"  Created project: {pdata['title'][:50]} ({len(pdata['tasks'])} tasks)")

    return created_projects, all_tasks


def seed_comments_and_reactions(db: Session, org_id: str, users: list, tasks: list):
    """Add threaded comments with reactions to the first several tasks."""
    if not tasks:
        return
    demo, sarah, omar = users[0], users[1], users[2]

    comment_data = [
        # (task_index, user, content, replies=[(user, content)], reactions=[(user, emoji)])
        (0, demo, "Documents have been prepared and submitted to the client for review.", [
            (sarah, "Client confirmed receipt. All looks good!"),
            (omar, "Great, moving to next step."),
        ], [(sarah, "thumbsup"), (omar, "thumbsup"), (demo, "rocket")]),
        (1, sarah, "DED approval is taking longer than expected. I've escalated with our contact at the authority.", [
            (demo, "Thanks Sarah, please keep us posted. We need this by end of week."),
            (sarah, "Just got confirmation — approval will be issued tomorrow."),
            (omar, "That's a relief! I'll prepare the next steps."),
        ], [(demo, "eyes"), (omar, "fire")]),
        (3, demo, "MOA draft v1 is ready for internal review. @Sarah please check the shareholding structure.", [
            (sarah, "Reviewed — found a minor issue with share allocation percentages. Fixing now."),
            (demo, "Updated and re-uploaded. Ready for client sign-off."),
        ], [(sarah, "heart"), (omar, "thumbsup")]),
        (4, omar, "Found a great office space in Business Bay. Rent is within budget at 45,000 AED/year.", [
            (demo, "Good find! Can you share photos and the floor plan?"),
            (omar, "Uploaded the brochure to attachments."),
        ], [(demo, "rocket"), (sarah, "eyes")]),
        (5, demo, "Government fee estimate: AED 12,500 for trade license + AED 3,200 for visa processing.", [], [(sarah, "thumbsup")]),
        (7, sarah, "Visa applications will need medical fitness test + Emirates ID registration. Timeline: ~10 working days.", [
            (omar, "I'll coordinate the medical appointments."),
        ], [(demo, "thumbsup"), (omar, "fire")]),
    ]

    created = 0
    for task_idx, author, content, replies, reactions in comment_data:
        if task_idx >= len(tasks):
            continue
        task = tasks[task_idx]
        # Check if comment already exists
        existing = db.query(TaskComment).filter(
            TaskComment.task_id == task.id, TaskComment.content == content
        ).first()
        if existing:
            continue

        comment = TaskComment(
            task_id=task.id, org_id=org_id, user_id=author.id, content=content
        )
        db.add(comment)
        db.flush()
        created += 1

        # Reactions on main comment
        for rxn_user, emoji in reactions:
            db.add(CommentReaction(
                comment_id=comment.id, user_id=rxn_user.id, org_id=org_id, emoji=emoji
            ))

        # Replies
        for reply_user, reply_content in replies:
            reply = TaskComment(
                task_id=task.id, org_id=org_id, user_id=reply_user.id,
                content=reply_content, parent_id=comment.id,
            )
            db.add(reply)
            db.flush()
            created += 1
            # Add a reaction to some replies
            if "confirm" in reply_content.lower() or "great" in reply_content.lower():
                db.add(CommentReaction(
                    comment_id=reply.id, user_id=demo.id, org_id=org_id, emoji="thumbsup"
                ))

    print(f"  Comments: {created} (with reactions)")


def seed_attachments_metadata(db: Session, org_id: str, users: list, tasks: list):
    """Add fake attachment metadata (no real files) to demonstrate the Files tab."""
    if not tasks:
        return
    demo, sarah, omar = users[0], users[1], users[2]

    attachment_data = [
        (0, demo, "incorporation_docs_v2.pdf", 245760, "application/pdf"),
        (0, sarah, "passport_copies.pdf", 1048576, "application/pdf"),
        (0, omar, "shareholder_agreement.docx", 89600, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        (1, sarah, "DED_approval_letter.pdf", 156000, "application/pdf"),
        (3, demo, "MOA_draft_v1.pdf", 320000, "application/pdf"),
        (3, demo, "MOA_draft_v2_final.pdf", 335000, "application/pdf"),
        (4, omar, "office_brochure_business_bay.pdf", 2100000, "application/pdf"),
        (4, omar, "floor_plan_office_1205.png", 890000, "image/png"),
        (7, sarah, "visa_application_form.pdf", 95000, "application/pdf"),
        (7, sarah, "medical_test_requirements.pdf", 45000, "application/pdf"),
    ]

    created = 0
    for task_idx, uploader, filename, size, mime in attachment_data:
        if task_idx >= len(tasks):
            continue
        task = tasks[task_idx]
        existing = db.query(TaskAttachment).filter(
            TaskAttachment.task_id == task.id, TaskAttachment.filename == filename
        ).first()
        if existing:
            continue
        db.add(TaskAttachment(
            task_id=task.id, org_id=org_id, user_id=uploader.id,
            filename=filename, file_path=f"uploads/tasks/{task.id}/{generate_uuid()}.dat",
            file_size=size, mime_type=mime,
        ))
        created += 1

    print(f"  Attachments: {created} (metadata only)")


def seed_favorites(db: Session, org_id: str, user_id: str, projects: list):
    """Pin the first 2 projects as favorites for the demo user."""
    created = 0
    for i, proj in enumerate(projects[:2]):
        existing = db.query(UserFavorite).filter(
            UserFavorite.user_id == user_id, UserFavorite.project_id == proj.id
        ).first()
        if existing:
            continue
        db.add(UserFavorite(
            user_id=user_id, org_id=org_id, project_id=proj.id, sort_order=i
        ))
        created += 1
    print(f"  Favorites: {created} projects pinned")


def seed_activities(db: Session, org_id: str, users: list, projects: list):
    """Create today's activities for the Activity Map and Upcoming Meetings widgets."""
    if not projects:
        return
    demo, sarah, omar = users[0], users[1], users[2]

    # Build today's datetime at specific hours (UTC)
    today = NOW.replace(hour=0, minute=0, second=0, microsecond=0)

    activities_data = [
        # (project_idx, user, title, type, start_hour, start_min, end_hour, end_min, location)
        (0, demo, "Client kick-off meeting", ActivityType.MEETING, 9, 0, 10, 0, "Meeting Room A"),
        (0, sarah, "Review DED requirements", ActivityType.CALL, 10, 0, 10, 30, None),
        (1, sarah, "FTA portal submission call", ActivityType.CALL, 10, 30, 11, 0, None),
        (0, omar, "Office space viewing", ActivityType.VISIT, 11, 0, 12, 0, "Business Bay, Tower 1"),
        (0, demo, "MOA review session", ActivityType.MEETING, 13, 0, 14, 0, "Conference Room B"),
        (1, demo, "VAT threshold analysis", ActivityType.FOLLOW_UP, 14, 0, 14, 30, None),
        (2, omar, "License audit prep call", ActivityType.CALL, 14, 30, 15, 0, None),
        (0, sarah, "Investor visa planning", ActivityType.MEETING, 15, 0, 16, 0, "Meeting Room A"),
        (1, sarah, "Follow up with FTA contact", ActivityType.FOLLOW_UP, 16, 0, 16, 30, None),
        (2, demo, "Renewal timeline meeting", ActivityType.MEETING, 16, 0, 17, 0, "Online - Zoom"),
    ]

    created = 0
    for proj_idx, user, title, atype, sh, sm, eh, em, location in activities_data:
        if proj_idx >= len(projects):
            continue
        proj = projects[proj_idx]

        existing = db.query(Activity).filter(
            Activity.org_id == org_id,
            Activity.title == title,
            Activity.project_id == proj.id,
        ).first()
        if existing:
            continue

        start_dt = today.replace(hour=sh, minute=sm)
        end_dt = today.replace(hour=eh, minute=em)

        db.add(Activity(
            org_id=org_id,
            project_id=proj.id,
            title=title,
            activity_type=atype,
            start_datetime=start_dt,
            end_datetime=end_dt,
            status=ActivityStatus.PENDING if end_dt > NOW else ActivityStatus.COMPLETED,
            assigned_to=user.id,
            created_by=demo.id,
            location=location,
        ))
        created += 1

    print(f"  Activities: {created} (meetings, calls, follow-ups, visits)")


def run():
    print("\n=== Seeding showcase data ===\n")
    db = SessionLocal()
    try:
        # Get the demo org
        org = db.query(Organization).filter(Organization.name == "Demo CSP").first()
        if not org:
            print("  Demo org not found. Running base seed first...")
            from scripts.seed_demo import run as base_seed
            base_seed()
            db = SessionLocal()  # fresh session
            org = db.query(Organization).filter(Organization.name == "Demo CSP").first()

        org_id = org.id
        users = get_or_create_users(db, org_id)
        projects, tasks = seed_showcase_projects(db, org_id, users)
        seed_comments_and_reactions(db, org_id, users, tasks)
        seed_attachments_metadata(db, org_id, users, tasks)
        seed_favorites(db, org_id, users[0].id, projects)
        seed_activities(db, org_id, users, projects)

        db.commit()
        print(f"\n=== Done! {len(projects)} projects, {len(tasks)} tasks seeded ===")
        print("Log in: demo@csp.local / demo123\n")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        import traceback; traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
