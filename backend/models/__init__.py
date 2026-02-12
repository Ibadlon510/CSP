"""Import all models so they are registered with Base.metadata."""
from models.organization import Organization
from models.user import User, UserRole
from models.audit_log import AuditLog
from models.contact import Contact, ContactAddress, ContactType, ContactStatus, AddressType
from models.wallet import ClientWallet, Transaction, WalletAlert, WalletStatus, TransactionType, TransactionStatus, AlertLevel
from models.project import (
    Project, Task, TaskAssignee, ProjectStatus, TaskStatus, TaskPriority,
    ProjectHandover, ProjectProposedName, ProjectLicenseActivity,
    ProjectVisaApplication, ProjectDocumentChecklist, ProjectProduct,
    ProjectRelatedField, TaskComment, UserFavorite, TaskAttachment,
    CommentReaction, TaskDependency,
)
from models.lead import Lead
from models.crm_contact import CrmContact
from models.opportunity import Opportunity
from models.quotation import Quotation, QuotationLine
from models.sales_order import SalesOrder, SalesOrderLine
from models.invoice import Invoice, InvoiceLine
from models.product import Product, ProductTaskTemplate, ProductDocumentRequirement
from models.org_settings import OrganizationSettings, OrgModuleSetting, ModuleId
from models.user_module_permission import UserModulePermission
from models.document import Document, DocumentCategory, DocumentStatus
from models.compliance import (
    OwnershipLink,
    OwnershipLinkType,
    ComplianceSnapshot,
    ComplianceRisk,
    ComplianceGraphLayout,
    RegisterType,
    RiskBand,
)
from models.notification import Notification
from models.approval import ApprovalRequest, ApprovalProcessSetting
from models.activity import Activity, ActivityType, ActivityStatus, ActivityReminder, ActivityRecurrence
from models.commission_attribute import CommissionAttribute
from models.saved_search import SavedSearch

