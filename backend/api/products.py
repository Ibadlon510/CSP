"""Products and Product Task Templates API. Admin/Manager only."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from core.deps import require_roles
from models.user import User, UserRole
from models.product import Product, ProductTaskTemplate, ProductDocumentRequirement
from schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductTaskTemplateCreate,
    ProductTaskTemplateUpdate,
    ProductTaskTemplateResponse,
    ProductDocumentRequirementCreate,
    ProductDocumentRequirementResponse,
)

router = APIRouter(prefix="/api/products", tags=["Products"])


def _product_response(p: Product) -> ProductResponse:
    templates = [
        ProductTaskTemplateResponse(
            id=t.id,
            org_id=t.org_id,
            product_id=t.product_id,
            task_name=t.task_name,
            sort_order=t.sort_order,
            subtask_names=t.subtask_names,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in sorted(p.task_templates, key=lambda x: (x.sort_order, x.task_name))
    ]
    doc_reqs = []
    if hasattr(p, 'document_requirements') and p.document_requirements:
        doc_reqs = [
            ProductDocumentRequirementResponse(
                id=d.id, product_id=d.product_id, org_id=d.org_id,
                document_name=d.document_name, document_category=d.document_category,
                sort_order=d.sort_order,
                created_at=d.created_at, updated_at=d.updated_at,
            )
            for d in sorted(p.document_requirements, key=lambda x: x.sort_order)
        ]
    return ProductResponse(
        id=p.id,
        org_id=p.org_id,
        name=p.name,
        code=p.code,
        description=p.description,
        default_unit_price=p.default_unit_price,
        is_active=p.is_active,
        creates_project=p.creates_project,
        created_at=p.created_at,
        updated_at=p.updated_at,
        task_templates=templates,
        document_requirements=doc_reqs,
    )


@router.get("/", response_model=list[ProductResponse])
def list_products(
    is_active: bool | None = None,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        return []
    q = db.query(Product).filter(Product.org_id == current_user.org_id).options(joinedload(Product.task_templates), joinedload(Product.document_requirements))
    if is_active is not None:
        q = q.filter(Product.is_active == is_active)
    products = q.order_by(Product.name).all()
    return [_product_response(p) for p in products]


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreate,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)),
    db: Session = Depends(get_db),
):
    if not current_user.org_id:
        raise HTTPException(status_code=403, detail="No organization")
    if body.creates_project and not body.task_templates:
        raise HTTPException(
            status_code=400,
            detail="At least one task template is required when product creates a project",
        )
    p = Product(
        org_id=current_user.org_id,
        name=body.name,
        description=body.description,
        default_unit_price=body.default_unit_price,
        is_active=body.is_active,
        creates_project=body.creates_project,
    )
    db.add(p)
    db.flush()
    for i, t_in in enumerate(body.task_templates):
        t = ProductTaskTemplate(
            org_id=current_user.org_id,
            product_id=p.id,
            task_name=t_in.task_name,
            sort_order=t_in.sort_order if t_in.sort_order is not None else i,
            subtask_names=t_in.subtask_names,
        )
        db.add(t)
    db.commit()
    db.refresh(p)
    p = db.query(Product).options(joinedload(Product.task_templates)).filter(Product.id == p.id).first()
    return _product_response(p)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: str,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)),
    db: Session = Depends(get_db),
):
    p = (
        db.query(Product)
        .options(joinedload(Product.task_templates), joinedload(Product.document_requirements))
        .filter(Product.id == product_id, Product.org_id == current_user.org_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_response(p)


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: str,
    body: ProductUpdate,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)),
    db: Session = Depends(get_db),
):
    p = (
        db.query(Product)
        .options(joinedload(Product.task_templates))
        .filter(Product.id == product_id, Product.org_id == current_user.org_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    creates_project = body.creates_project if body.creates_project is not None else p.creates_project
    if creates_project and len(p.task_templates) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one task template is required when product creates a project. Add task templates first.",
        )
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    p = db.query(Product).options(joinedload(Product.task_templates)).filter(Product.id == p.id).first()
    return _product_response(p)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: str,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)),
    db: Session = Depends(get_db),
):
    p = db.query(Product).filter(Product.id == product_id, Product.org_id == current_user.org_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(p)
    db.commit()
    return None


# --- Product Task Templates (nested under product) ---


@router.get("/{product_id}/task-templates", response_model=list[ProductTaskTemplateResponse])
def list_task_templates(
    product_id: str,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)),
    db: Session = Depends(get_db),
):
    p = db.query(Product).filter(Product.id == product_id, Product.org_id == current_user.org_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    templates = (
        db.query(ProductTaskTemplate)
        .filter(ProductTaskTemplate.product_id == product_id)
        .order_by(ProductTaskTemplate.sort_order, ProductTaskTemplate.task_name)
        .all()
    )
    return [
        ProductTaskTemplateResponse(
            id=t.id,
            org_id=t.org_id,
            product_id=t.product_id,
            task_name=t.task_name,
            sort_order=t.sort_order,
            subtask_names=t.subtask_names,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in templates
    ]


@router.post("/{product_id}/task-templates", response_model=ProductTaskTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_task_template(
    product_id: str,
    body: ProductTaskTemplateCreate,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)),
    db: Session = Depends(get_db),
):
    p = db.query(Product).filter(Product.id == product_id, Product.org_id == current_user.org_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    t = ProductTaskTemplate(
        org_id=current_user.org_id,
        product_id=product_id,
        task_name=body.task_name,
        sort_order=body.sort_order,
        subtask_names=body.subtask_names,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return ProductTaskTemplateResponse(
        id=t.id,
        org_id=t.org_id,
        product_id=t.product_id,
        task_name=t.task_name,
        sort_order=t.sort_order,
        subtask_names=t.subtask_names,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.patch("/{product_id}/task-templates/{template_id}", response_model=ProductTaskTemplateResponse)
def update_task_template(
    product_id: str,
    template_id: str,
    body: ProductTaskTemplateUpdate,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)),
    db: Session = Depends(get_db),
):
    t = (
        db.query(ProductTaskTemplate)
        .filter(
            ProductTaskTemplate.id == template_id,
            ProductTaskTemplate.product_id == product_id,
            ProductTaskTemplate.org_id == current_user.org_id,
        )
        .first()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Task template not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return ProductTaskTemplateResponse(
        id=t.id,
        org_id=t.org_id,
        product_id=t.product_id,
        task_name=t.task_name,
        sort_order=t.sort_order,
        subtask_names=t.subtask_names,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.delete("/{product_id}/task-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_template(
    product_id: str,
    template_id: str,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)),
    db: Session = Depends(get_db),
):
    t = (
        db.query(ProductTaskTemplate)
        .filter(
            ProductTaskTemplate.id == template_id,
            ProductTaskTemplate.product_id == product_id,
            ProductTaskTemplate.org_id == current_user.org_id,
        )
        .first()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Task template not found")
    product = db.query(Product).filter(Product.id == product_id, Product.org_id == current_user.org_id).first()
    if product and product.creates_project:
        remaining = (
            db.query(ProductTaskTemplate)
            .filter(ProductTaskTemplate.product_id == product_id, ProductTaskTemplate.id != template_id)
            .count()
        )
        if remaining == 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the last task template when product creates a project",
            )
    db.delete(t)
    db.commit()
    return None


# --- Product Document Requirements (nested under product) ---


@router.get("/{product_id}/document-requirements", response_model=list[ProductDocumentRequirementResponse])
def list_document_requirements(
    product_id: str,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)),
    db: Session = Depends(get_db),
):
    p = db.query(Product).filter(Product.id == product_id, Product.org_id == current_user.org_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    reqs = (
        db.query(ProductDocumentRequirement)
        .filter(ProductDocumentRequirement.product_id == product_id)
        .order_by(ProductDocumentRequirement.sort_order)
        .all()
    )
    return [
        ProductDocumentRequirementResponse(
            id=r.id, product_id=r.product_id, org_id=r.org_id,
            document_name=r.document_name, document_category=r.document_category,
            sort_order=r.sort_order,
        )
        for r in reqs
    ]


@router.post("/{product_id}/document-requirements", response_model=ProductDocumentRequirementResponse, status_code=status.HTTP_201_CREATED)
def create_document_requirement(
    product_id: str,
    body: ProductDocumentRequirementCreate,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)),
    db: Session = Depends(get_db),
):
    p = db.query(Product).filter(Product.id == product_id, Product.org_id == current_user.org_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    r = ProductDocumentRequirement(
        org_id=current_user.org_id,
        product_id=product_id,
        document_name=body.document_name,
        document_category=body.document_category,
        document_type=body.document_type,
        sort_order=body.sort_order if body.sort_order is not None else 0,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return ProductDocumentRequirementResponse(
        id=r.id, product_id=r.product_id, org_id=r.org_id,
        document_name=r.document_name, document_category=r.document_category,
        document_type=r.document_type,
        sort_order=r.sort_order,
    )


@router.delete("/{product_id}/document-requirements/{req_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document_requirement(
    product_id: str,
    req_id: str,
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)),
    db: Session = Depends(get_db),
):
    r = (
        db.query(ProductDocumentRequirement)
        .filter(
            ProductDocumentRequirement.id == req_id,
            ProductDocumentRequirement.product_id == product_id,
            ProductDocumentRequirement.org_id == current_user.org_id,
        )
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Document requirement not found")
    db.delete(r)
    db.commit()
    return None
