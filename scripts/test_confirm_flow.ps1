# End-to-end simulation: Confirm Sales Order -> creates Invoice + Project + Tasks
$ErrorActionPreference = "Stop"
$BASE = "http://localhost:8000"
$TS = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$EMAIL = "testflow${TS}@example.com"
$PASSWORD = "Test1234!"

function Api($method, $path, $body=$null, $token=$null) {
    $headers = @{ "Content-Type" = "application/json" }
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    $params = @{ Uri = "$BASE$path"; Method = $method; Headers = $headers; UseBasicParsing = $true }
    if ($body) { $params["Body"] = ($body | ConvertTo-Json -Depth 10) }
    try {
        $r = Invoke-WebRequest @params
        return ($r.Content | ConvertFrom-Json)
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $detail = ""
        try { $detail = ($_.ErrorDetails.Message | ConvertFrom-Json).detail } catch {}
        Write-Host "  FAIL [$code]: $detail" -ForegroundColor Red
        throw "API call failed: $method $path -> $code $detail"
    }
}

Write-Host "`n========== STEP 1: Register ==========" -ForegroundColor Cyan
$reg = Api "POST" "/api/auth/register" @{ email=$EMAIL; password=$PASSWORD; full_name="Test Workflow User"; org_name="TestOrg-$TS" }
$TOKEN = $reg.access_token
Write-Host "  Registered: $EMAIL" -ForegroundColor Green

Write-Host "`n========== STEP 2: Verify auth ==========" -ForegroundColor Cyan
$me = Api "GET" "/api/auth/me" $null $TOKEN
Write-Host "  User: $($me.id) | Org: $($me.org_id)" -ForegroundColor Green

Write-Host "`n========== STEP 3: Create Product (creates_project=True) ==========" -ForegroundColor Cyan
$prod = Api "POST" "/api/products/" @{
    name = "Company Formation"
    description = "Full company formation service"
    default_unit_price = 5000
    is_active = $true
    creates_project = $true
    task_templates = @(
        @{ task_name = "Document Collection"; sort_order = 1; subtask_names = @("Passport Copy", "Emirates ID", "Proof of Address") }
        @{ task_name = "Name Reservation"; sort_order = 2; subtask_names = @("Check availability", "Submit reservation") }
        @{ task_name = "License Issuance"; sort_order = 3; subtask_names = @("Prepare application", "Submit to authority", "Collect license") }
    )
} $TOKEN
$PRODUCT_ID = $prod.id
$templateCount = ($prod.task_templates | Measure-Object).Count
Write-Host "  Product: $($prod.name) | ID: $PRODUCT_ID" -ForegroundColor Green
Write-Host "  creates_project: $($prod.creates_project) | templates: $templateCount" -ForegroundColor Green

Write-Host "`n========== STEP 4: Create Contact ==========" -ForegroundColor Cyan
$contact = Api "POST" "/api/contacts/" @{
    name = "Test Client $TS"
    email = "client${TS}@example.com"
    contact_type = "individual"
} $TOKEN
$CONTACT_ID = $contact.id
Write-Host "  Contact: $($contact.name) | ID: $CONTACT_ID" -ForegroundColor Green

Write-Host "`n========== STEP 5: Create Sales Order ==========" -ForegroundColor Cyan
$order = Api "POST" "/api/orders/" @{
    contact_id = $CONTACT_ID
    lines = @(
        @{
            product_id = $PRODUCT_ID
            description = "Company Formation - Full Package"
            quantity = 1
            unit_price = 5000
            vat_rate = 5
        }
    )
} $TOKEN
$ORDER_ID = $order.id
Write-Host "  Order: $($order.number) | ID: $ORDER_ID | Status: $($order.status)" -ForegroundColor Green
$lineProductId = $order.lines[0].product_id
Write-Host "  Line product_id: $lineProductId" -ForegroundColor Green
if (-not $lineProductId) { throw "Order line missing product_id!" }
Write-Host "  project_id: $($order.project_id) | invoice_id: $($order.invoice_id)" -ForegroundColor Yellow

Write-Host "`n========== STEP 6: CONFIRM Sales Order ==========" -ForegroundColor Cyan
$confirm = Api "POST" "/api/orders/$ORDER_ID/confirm" @{} $TOKEN
Write-Host "  Status: $($confirm.status) | confirmed_at: $($confirm.confirmed_at)" -ForegroundColor Green
Write-Host "  confirmed_invoice_id: $($confirm.confirmed_invoice_id)" -ForegroundColor Green
Write-Host "  confirmed_project_id: $($confirm.confirmed_project_id)" -ForegroundColor Green
Write-Host "  project_id: $($confirm.project_id)" -ForegroundColor Green
Write-Host "  invoice_id: $($confirm.invoice_id)" -ForegroundColor Green

$INVOICE_ID = if ($confirm.confirmed_invoice_id) { $confirm.confirmed_invoice_id } else { $confirm.invoice_id }
$PROJECT_ID = if ($confirm.confirmed_project_id) { $confirm.confirmed_project_id } else { $confirm.project_id }

if (-not $INVOICE_ID) { throw "No invoice created on confirm!" }
Write-Host "  PASS: Invoice created: $INVOICE_ID" -ForegroundColor Green
if (-not $PROJECT_ID) { throw "No project created on confirm! (Product has creates_project=True)" }
Write-Host "  PASS: Project created: $PROJECT_ID" -ForegroundColor Green

Write-Host "`n========== STEP 7: GET Order - verify links ==========" -ForegroundColor Cyan
$orderAfter = Api "GET" "/api/orders/$ORDER_ID" $null $TOKEN
Write-Host "  status: $($orderAfter.status)" -ForegroundColor Green
Write-Host "  project_id: $($orderAfter.project_id)" -ForegroundColor Green
Write-Host "  invoice_id: $($orderAfter.invoice_id)" -ForegroundColor Green
if (-not $orderAfter.project_id) { throw "GET order: project_id missing!" }
if (-not $orderAfter.invoice_id) { throw "GET order: invoice_id missing!" }
Write-Host "  PASS: project_id + invoice_id populated on order detail" -ForegroundColor Green

Write-Host "`n========== STEP 8: GET Project + Tasks ==========" -ForegroundColor Cyan
$proj = Api "GET" "/api/projects/$PROJECT_ID" $null $TOKEN
Write-Host "  Project: $($proj.title) | status: $($proj.status)" -ForegroundColor Green
Write-Host "  sales_order_id: $($proj.sales_order_id)" -ForegroundColor Green
Write-Host "  invoice_id: $($proj.invoice_id)" -ForegroundColor Green

$tasks = Api "GET" "/api/projects/$PROJECT_ID/tasks" $null $TOKEN
$parentTasks = @($tasks | Where-Object { -not $_.parent_id })
$subTasks = @($tasks | Where-Object { $_.parent_id })
Write-Host "  Total tasks: $($tasks.Count) | Parents: $($parentTasks.Count) | Subtasks: $($subTasks.Count)" -ForegroundColor Green
foreach ($t in $parentTasks) {
    $subs = @($subTasks | Where-Object { $_.parent_id -eq $t.id })
    Write-Host "    - $($t.title) ($($subs.Count) subtasks)" -ForegroundColor White
}
if ($parentTasks.Count -eq 0) { throw "No tasks created from product templates!" }
Write-Host "  PASS: Tasks created from templates" -ForegroundColor Green

Write-Host "`n========== STEP 9: GET Orders list - verify links ==========" -ForegroundColor Cyan
$ordersList = Api "GET" "/api/orders/" $null $TOKEN
$ourOrder = $ordersList | Where-Object { $_.id -eq $ORDER_ID }
Write-Host "  Order in list: project_id=$($ourOrder.project_id) | invoice_id=$($ourOrder.invoice_id)" -ForegroundColor Green
if (-not $ourOrder.project_id) { throw "List view: project_id missing!" }
if (-not $ourOrder.invoice_id) { throw "List view: invoice_id missing!" }
Write-Host "  PASS: project_id + invoice_id in list view" -ForegroundColor Green

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  ALL 9 CHECKS PASSED" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Product: $($prod.name) (creates_project=True, $templateCount templates)"
Write-Host "  Contact: $($contact.name)"
Write-Host "  Order:   $($order.number) -> Confirmed"
Write-Host "  Invoice: $INVOICE_ID"
Write-Host "  Project: $PROJECT_ID"
Write-Host "  Tasks:   $($parentTasks.Count) parent + $($subTasks.Count) subtasks"
Write-Host ""
