"""Migration: create organization_settings, org_module_settings, user_module_permissions tables.
Run from backend dir: python -m migrations.add_settings_tables

Uses SQLAlchemy create_all for new tables - safe to run multiple times.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import engine, Base
from models.org_settings import OrganizationSettings, OrgModuleSetting
from models.user_module_permission import UserModulePermission

if __name__ == "__main__":
    # Create only the new tables; Base.metadata.create_all skips existing tables
    Base.metadata.create_all(bind=engine, checkfirst=True)
    print("Migration complete: organization_settings, org_module_settings, user_module_permissions")
