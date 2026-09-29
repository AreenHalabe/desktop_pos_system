import { setActiveNavLink, showAuthExpired, bootboxError, bootboxSuccess, bootboxConfirm } from "../../../component/bootbox.js";
import { url } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
// import { printChecks } from "../../../component/invoice_supplier.js";
const header = document.querySelector("site-header");

let currentPage = 1;
const pageLimit = 50;

let currentPeriod = "this_month";

let checks;
let recentlyAdded;
const checkForm = document.getElementById("checkForm");
const overlayLoader = document.getElementById('overlay_loader');

const addCheckModal = document.getElementById('addCheckModal');
const confirmAddBtn = document.getElementById('confirmAddBtn');

const filterDev     = document.getElementById('filterDev');
const customDateContainer = document.getElementById("customDateContainer");
const currencyNames = {
    ILS: "شيكل",
    USD: "دولار",
    JOD: "دينار",
    EUR: "يورو"
};

class SiteHeader extends HTMLElement {
    async connectedCallback() {
        const res = await fetch('../component/header.html');
        this.innerHTML = await res.text();

        this.dispatchEvent(
            new CustomEvent("header:ready", {
                bubbles: true
            })
        );
    }
}
customElements.define("site-header", SiteHeader);

header.addEventListener("header:ready", () => {
    setActiveNavLink();

    const logoutFrom = document.getElementById('logoutForm');
    logoutFrom.addEventListener("submit", async function (e) {
        e.preventDefault();
        bootbox.confirm({
            title: "تسجيل الخروج",
            message: "هل أنت متأكد من تسجيل الخروج؟",
            buttons: {
                confirm: {
                    label: "نعم",
                },
                cancel: {
                    label: "إلغاء",
                },
            },
            callback: function (result) {
                if (!result) return;

                removeAuthToken();
                window.location.href = "../../mainWindow.html";
            },
        });
    });
});



document.addEventListener("DOMContentLoaded", async function () {

    await Promise.all([
        loadSuppliers(),
        loadChecksRecentlyAdded()
    ]);

    


});


document.addEventListener("click", async function (e) {


    // =========================
    // Period buttons
    // =========================

    const periodBtn = e.target.closest(".check-period-btn");

    if (periodBtn) {

        const period = periodBtn.dataset.period;

        document.querySelectorAll(".check-period-btn").forEach(btn => {

            btn.classList.remove("btn-primary", "active");
            btn.classList.add("btn-outline-primary");

        });

        periodBtn.classList.remove("btn-outline-primary");
        periodBtn.classList.add("btn-primary", "active");


        if(period === 'recently_added'){
            renderChecks(recentlyAdded, false);
            renderSummary(null);
            renderPagination(null);

            filterDev.classList.add('d-none');
            customDateContainer.classList.add("d-none");
            return;
        }

        filterDev.classList.remove('d-none');
        currentPeriod = period;

        

        periodBtn.classList.remove("btn-outline-primary");
        periodBtn.classList.add("btn-primary", "active");


        


        if (period === "custom") {

            customDateContainer.classList.remove("d-none");

            return;
        }


        customDateContainer.classList.add("d-none");

        currentPage = 1;

        await loadChecks();

        return;
    }


    // =========================
    // Apply custom date
    // =========================

    if (e.target.closest("#applyDateBtn")) {

        const fromDate =
            document.getElementById("fromDate").value;

        const toDate =
            document.getElementById("toDate").value;


        if (!fromDate || !toDate) {

            bootboxError("يرجى تحديد تاريخ البداية والنهاية");

            return;
        }


        if (fromDate > toDate) {

            bootboxError("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");

            return;
        }


        currentPage = 1;

        await loadChecks();

        return;
    }


    // =========================
    // Search
    // =========================

    if (e.target.closest(".check-search-btn")) {

        currentPage = 1;

        await loadChecks();

        return;
    }



    // =========================
    // Reset filters
    // =========================

    if (e.target.closest("#resetChecksFiltersBtn")) {

        resetFilters();

        currentPage = 1;

        await loadChecks();

        return;
    }



    if (e.target.closest(".edit-check-status-btn")) {

        const btn = e.target.closest(".edit-check-status-btn");

        if (!btn) return;

        const checkId = btn.dataset.id;
        const isFromFilter = btn.dataset.isfromfilter === "true";
        let check;
        
        if(isFromFilter){
            check = checks.find(
                check => String(check.id) === String(checkId)
            );
        }
        else{
            check = recentlyAdded.find(
                check => String(check.id) === String(checkId)
            );
        }
        

        if (!check) return;

        openCheckStatusModal(check);

        return;
    }

    // =========================
    // Pagination
    // =========================

    const paginationBtn =
        e.target.closest(".checks-pagination-btn");

    if (paginationBtn) {

        const page = Number(paginationBtn.dataset.page);

        if (!page || page === currentPage) {
            return;
        }

        currentPage = page;

        await loadChecks();

        return;
    }

    if (e.target.closest(".print-invoice-btn")) {

        if (checks.length == 0) return;

        try {
            overlayLoader.classList.remove('d-none');
            // await printChecks(checks);
        } catch (e) {
            bootboxError(e.message);
        } finally {
            overlayLoader.classList.add('d-none');
        }

        return;

    }

});


document.addEventListener("change", async function (e) {


    // =========================
    // Select filters
    // =========================

    if (
        e.target.matches(
            "#supplierFilter, #statusFilter, #typeFilter, #accountFilter"
        )
    ) {

        currentPage = 1;

        await loadChecks();

    }

});


document.addEventListener("keydown", async function (e) {

    if (
        e.target.matches("#checkNumberSearch") &&
        e.key === "Enter"
    ) {

        currentPage = 1;

        await loadChecks();

    }

});


checkForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    disableBtn();
    overlayLoader.classList.remove('d-none');

    const formData = new FormData(checkForm);
    const checkData = Object.fromEntries(formData.entries());

    try {
        let res = await fetch(url + '/check/add', {
            method: "POST",
            body: JSON.stringify(checkData),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });
        let data = await res.json();

        if (res.status === 200) {
            bootboxSuccess(data.message);
            const modal = bootstrap.Modal.getOrCreateInstance(addCheckModal);
            modal.hide();

            currentPage = 1;
            await updateCash();

            return;
        }

        else if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }

        else {
            bootboxError(data.message);
            return;
        }
    } catch (err) {
        bootboxError(err.message);
    } finally {
        allowActionBtn();
        overlayLoader.classList.add('d-none');

    }
});


addCheckModal.addEventListener("hidden.bs.modal", () => {
    checkForm.reset();
});


document.addEventListener('submit', function (e) {
    const form = e.target;

    if (form.classList.contains('delete-check-form')) {
        const message = form.dataset.confirmMessage || 'هل أنت متأكد؟';
        bootboxConfirm(e, {
            message,
            onConfirm: deleteCheck
        });
    }
});

// ==========================================
// Load Checks
// ==========================================

async function loadSuppliers() {
    try {
        const res = await fetch(url + '/suppliers', {
            method: "GET",
            headers: {
                "Authorization": `${getAuthToken('auth')}`
            }
        });
        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }
        else if (res.status === 200) {
            setSuppliers(data.suppliers);
        }
        else {
            bootboxError(data.message);
        }

    } catch (e) {
        bootboxError(e.message);
    }
}

async function loadChecks() {

    showLoading();


    try {

        const params = getFilters();


        let res = await fetch(url + `/check/get?${params.toString()}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });

        let data = await res.json();

        if (res.status === 200) {
            renderSummary(data.summary);
            checks = data.data;

            renderChecks(checks);
            renderPagination(data.pagination);

        }

        else if (res.status === 401) {
            showAuthExpired(data.message);
        }

        else {
            bootboxError(data.message);
        }

        // مؤقتاً


        hideLoading();


    } catch (error) {
        bootboxError(error.message);
        showError();

    }

}

async function loadChecksRecentlyAdded(needToRenderTable = true) {

    showLoading();


    try {

        let res = await fetch(url + '/check/get-recently-added', {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });

        let data = await res.json();

        if (res.status === 200) {


            recentlyAdded = data.checks;
            if(needToRenderTable){
                renderChecks(recentlyAdded, false);
                renderSummary(null);
                renderPagination(null);
            }

            

        }

        else if (res.status === 401) {
            showAuthExpired(data.message);
        }

        else {
            bootboxError(data.message);
        }

        // مؤقتاً


        hideLoading();


    } catch (error) {
        bootboxError(error.message);
        showError();

    }

}

async function deleteCheck({ id }) {
    overlayLoader.classList.remove('d-none');

    try {
        const res = await fetch(url + `/check/delete?check_id=${id}`, {
            method: 'DELETE',
            headers: {
                "Authorization": `${getAuthToken('auth')}`
            }
        });
        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }
        else if (res.status === 200) {
            await updateCash();
            return;
        }
        else {
            bootboxError(data.message);
        }
    } catch (err) {
        bootboxError(err.message);
    } finally {
        overlayLoader.classList.add('d-none');
    }
}



function setSuppliers(suppliers) {
    const supplierFilter = document.getElementById("supplierFilter");

    supplierFilter.innerHTML = '<option value="all">الكل</option>';

    suppliers.forEach(supplier => {
        supplierFilter.insertAdjacentHTML(
            "beforeend",
            `<option value="${supplier.name}">${supplier.name}</option>`
        );
    });
}
// ==========================================
// Get Filters
// ==========================================

function getFilters() {

    const params = new URLSearchParams();


    // Period

    if (currentPeriod === "custom") {

        const fromDate =
            document.getElementById("fromDate").value;

        const toDate =
            document.getElementById("toDate").value;


        if (fromDate) {
            params.set("from", fromDate);
        }

        if (toDate) {
            params.set("to", toDate);
        }

    } else {

        const dateRange = getDateRange(currentPeriod);

        if (dateRange) {
            params.set("from", dateRange.from);
            params.set("to", dateRange.to);
        }

    }


    // Supplier

    const supplier =
        document.getElementById("supplierFilter").value;

    if (supplier !== "all") {

        params.set("supplier", supplier);

    }


    // Status

    const status =
        document.getElementById("statusFilter").value;

    if (status !== "all") {

        params.set("status", status);

    }


    // Type

    const type =
        document.getElementById("typeFilter").value;

    if (type !== "all") {

        params.set("type", type);

    }


    // Account

    const account =
        document.getElementById("accountFilter").value;

    if (account !== "all") {

        params.set("account", account);

    }


    // Check Number

    const checkNumber =
        document.getElementById("checkNumberSearch")
            .value
            .trim();

    if (checkNumber) {

        params.set("checkNumber", checkNumber);

    }


    // Pagination

    params.set("page", currentPage);
    params.set("limit", pageLimit);


    return params;
}


// ==========================================
// Reset Filters
// ==========================================

function resetFilters() {

    currentPeriod = "this_month";

    currentPage = 1;


    // Period buttons

    document.querySelectorAll(".check-period-btn").forEach(btn => {

        const isCurrent =
            btn.dataset.period === "this_month";

        btn.classList.toggle("btn-primary", isCurrent);
        btn.classList.toggle("active", isCurrent);
        btn.classList.toggle("btn-outline-primary", !isCurrent);

    });


    // Custom dates

    document
        .getElementById("customDateContainer")
        .classList.add("d-none");


    document.getElementById("fromDate").value = "";
    document.getElementById("toDate").value = "";


    // Selects

    document.getElementById("supplierFilter").value = "all";
    document.getElementById("statusFilter").value = "all";
    document.getElementById("typeFilter").value = "all";
    document.getElementById("accountFilter").value = "all";


    // Search

    document.getElementById("checkNumberSearch").value = "";

}


// ==========================================
// Loading
// ==========================================

function showLoading() {

    const tbody =
        document.getElementById("checksTableBody");

    const emptyState =
        document.getElementById("checksEmptyState");


    emptyState.classList.add("d-none");


    tbody.innerHTML = `

        <tr>

            <td colspan="12" class="text-center py-5">

                <div
                    class="spinner-border text-primary"
                    role="status"
                ></div>

                <div class="text-secondary mt-2">
                    جاري تحميل الشيكات...
                </div>

            </td>

        </tr>

    `;

}


// ==========================================
// Hide Loading
// ==========================================

function hideLoading() {

    const tbody =
        document.getElementById("checksTableBody");

    const hasRows =
        tbody.querySelectorAll("tr").length > 0;

    if (!hasRows) {

        document
            .getElementById("checksEmptyState")
            .classList.remove("d-none");

    }

}


// ==========================================
// Error
// ==========================================

function showError() {

    const tbody =
        document.getElementById("checksTableBody");


    tbody.innerHTML = `

        <tr>

            <td colspan="12" class="text-center py-5">

                <i class="fa-solid fa-triangle-exclamation
                          text-danger fs-2 mb-3"></i>

                <div class="fw-semibold">
                    حدث خطأ أثناء تحميل الشيكات
                </div>

                <div class="text-secondary small">
                    حاول مرة أخرى
                </div>

            </td>

        </tr>

    `;

}


function getDateRange(period) {
    const now = new Date();

    const year = now.getFullYear();
    const month = now.getMonth();

    let from;
    let to;

    switch (period) {

        case "this_month":
            from = new Date(year, month, 1);
            to = new Date(year, month + 1, 0);
            break;

        case "next_month":
            from = new Date(year, month + 1, 1);
            to = new Date(year, month + 2, 0);
            break;

        case "previous_month":
            from = new Date(year, month - 1, 1);
            to = new Date(year, month, 0);
            break;

        default:
            return null;
    }

    return {
        from: formatDate(from),
        to: formatDate(to)
    };
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function renderChecks(checks, isFromFilter = true) {

    const tbody = document.getElementById("checksTableBody");

    tbody.innerHTML = "";

    if (!checks || checks.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" class="text-center py-4 text-muted fw-bold fs-5">
                    لا توجد شيكات
                </td>
            </tr>
        `;

        return;
    }


    checks.forEach(check => {
        const typeSpan = check.type === "outgoing"
            ? `<span class="badge text-bg-danger">صادر</span>`
            : `<span class="badge text-bg-success">وارد</span>`;

        const statusSpan =
            check.status === "pending"
                ? `<span class="badge text-bg-warning">جاري</span>`
                : check.status === "cancelled"
                    ? `<span class="badge text-bg-secondary">ملغي</span>`
                    : `<span class="badge text-bg-success">مكتمل</span>`;

        tbody.insertAdjacentHTML("beforeend", `
            <tr>

                <td>${check.check_number}</td>

                <td>${check.bank_name}</td>

                <td>${check.payee_name}</td>

                <td class='fw-bold'>${Number(check.amount)}</td>

                <td class='fw-bold'>${currencyNames[check.currency]}</td>


                <td>${check.due_date}</td>

                <td>${typeSpan}</td>

                <td>${statusSpan}</td>

                <td>${check.account_name}</td>
                <td>${check.notes || ''}</td>

                <td>
                    <button
                        type="button"
                        class="btn btn-sm btn-outline-secondary edit-check-status-btn"
                        data-id="${check.id}"
                        data-isfromfilter="${isFromFilter}"
                    >
                        <i class="fa-solid fa-pen-to-square"></i>
                        تعديل
                    </button>
                </td>

                <td>
                    <form
                        class="delete-check-form"
                        data-confirm-message='
                            هل أنت متأكد من حذف شيك رقم <strong>${check.check_number}</strong> 
                            بقيمة <strong class="text-primary">${Number(check.amount)} ${currencyNames[check.currency]}</strong>؟
                            <div class="danger-box">
                                سيتم حذفه نهائيا من النظام !
                            </div>'
                    >
                        <button 
                            type="submit" 
                            class="delete-btn"
                            data-id="${check.id}"
                            title="حذف"
                        >
                            <i class="fas fa-trash"></i>
                        </button>
                    </form>
                </td>
            </tr>
        `);
    });
}

function renderPagination(pagination) {

    const container =
        document.getElementById("checksPagination");

    container.innerHTML = "";

    if (!pagination || pagination.totalPages <= 1) {
        return;
    }

    for (let page = 1; page <= pagination.totalPages; page++) {

        const active =
            page === pagination.page ? "active" : "";

        container.insertAdjacentHTML("beforeend", `
            <button
                type="button"
                class="btn btn-sm btn-outline-primary checks-pagination-btn ${active}"
                data-page="${page}"
            >
                ${page}
            </button>
        `);
    }
}


function renderSummary(summary) {

    document.getElementById("totalUSD").textContent =
        summary?.totalUSD ?? 0;

    document.getElementById("totalJOD").textContent =
        summary?.totalJOD ?? 0;

    document.getElementById("totalILS").textContent =
        summary?.totalILS ?? 0;

    document.getElementById("totalEUR").textContent =
        summary?.totalEUR ?? 0;


    document.getElementById("pendingChecks").textContent =
        summary?.pendingChecks ?? 0;

    document.getElementById("paidChecks").textContent =
        summary?.paidChecks ?? 0;
}


function disableBtn() {
    confirmAddBtn.disabled = true;
    confirmAddBtn.innerHTML = `
        <i class="fas fa-money-check-dollar ms-1"></i>
        جاري الإضافة... 
    `
}
function allowActionBtn() {
    confirmAddBtn.disabled = false;
    confirmAddBtn.innerHTML = `
        <i class="fas fa-money-check-dollar ms-1"></i>
        إضافة الشيك
    `
}





function openCheckStatusModal(check) {
     const isForInvoice = Number(check.is_for_invoice) === 1;
    const checkForm = `
        <form id="checkEditForm">

            <div class="row g-3">

                <!-- رقم الشيك -->
                <div class="col-md-6">
                    <label class="form-label fw-bold">
                        رقم الشيك
                    </label>

                    <input
                        type="text"
                        class="form-control"
                        name="checkNumber"
                        value="${check.check_number ?? ""}"
                        required
                    >
                </div>


                <!-- البنك -->
                <div class="col-md-6">
                    <label class="form-label fw-bold">
                        البنك
                    </label>

                    <input
                        type="text"
                        class="form-control"
                        name="bankName"
                        value="${check.bank_name ?? ""}"
                        required
                    >
                </div>


                <!-- المستفيد -->
                <div class="col-md-6">
                    <label class="form-label fw-bold">
                        المستفيد
                    </label>

                    <input
                        type="text"
                        class="form-control"
                        name="payeeName"
                        value="${check.payee_name ?? ""}"
                        required
                        ${isForInvoice ? "disabled" : ""}
                    >
                </div>


                 <!-- تاريخ الاستحقاق -->
                <div class="col-md-6">
                    <label class="form-label fw-bold">
                        تاريخ الاستحقاق
                    </label>

                    <input
                        type="date"
                        class="form-control"
                        name="dueDate"
                        value="${check.due_date ?? ""}"
                        required
                    >
                </div>
                ${
                    isForInvoice
                    ? `
                        <div class="col-12">
                            <div class="text-danger">
                                <i class="fa-solid fa-circle-info me-1"></i>
                                هذا الشيك مرتبط بفاتورة شراء للمورد، لذلك لا يمكن تعديل المبلغ أو العملة أو النوع.
                            </div>
                        </div>
                    `
                    : ""
                }


                <!-- العملة -->
                <div class="col-md-6">
                    <label class="form-label fw-bold">
                        العملة
                    </label>

                    <select
                        class="form-select"
                        name="currency"
                        required
                        ${isForInvoice ? "disabled" : ""}
                    >
                        <option value="ILS"
                            ${check.currency === "ILS" ? "selected" : ""}>
                            شيكل
                        </option>

                        <option value="USD"
                            ${check.currency === "USD" ? "selected" : ""}>
                            دولار
                        </option>

                        <option value="JOD"
                            ${check.currency === "JOD" ? "selected" : ""}>
                            دينار
                        </option>

                        <option value="EUR"
                            ${check.currency === "EUR" ? "selected" : ""}>
                            يورو
                        </option>
                    </select>
                </div>

                <!-- المبلغ -->
                <div class="col-md-6">
                    <label class="form-label fw-bold">
                        المبلغ
                    </label>

                    <input
                        type="number"
                        class="form-control"
                        name="amount"
                        value="${check.amount ?? ""}"
                        min="0"
                        step="0.5"
                        required
                        ${isForInvoice ? "disabled" : ""}
                    >
                </div>


               


                <!-- النوع -->
                <div class="col-md-6">
                    <label class="form-label fw-bold">
                        النوع
                    </label>

                    <select
                        class="form-select"
                        name="type"
                        required
                        ${isForInvoice ? "disabled" : ""}
                    >
                        <option
                            value="outgoing"
                            ${check.type === "outgoing" ? "selected" : ""}
                        >
                            صادر
                        </option>

                        <option
                            value="incoming"
                            ${check.type === "incoming" ? "selected" : ""}
                        >
                            وارد
                        </option>
                    </select>
                </div>


                <!-- الحساب -->
                <div class="col-md-6">
                    <label class="form-label fw-bold">
                        الحساب
                    </label>

                    <select 
                        name="accountName" 
                        class="form-select" 
                        required
                    >
                        <option 
                            value="حسني"
                            ${check.account_name === "حسني" ? "selected" : ""}
                        >
                            حسني
                        </option>

                        <option 
                            value="وسيم"
                            ${check.account_name === "وسيم" ? "selected" : ""}
                        >
                            وسيم
                        </option>

                        <option 
                            value="أخرى"
                            ${check.account_name === "أخرى" ? "selected" : ""}
                        >
                            أخرى
                        </option>
                    </select>
                </div>


                <!-- الملاحظات -->
                <div class="col-12">
                    <label class="form-label fw-bold">
                        الملاحظات
                    </label>

                    <textarea
                        class="form-control"
                        name="notes"
                        rows="3"
                    >${check.notes ?? ""}</textarea>
                </div>


                <!-- الحالة -->
                <div class="col-12">

                    <hr>

                    <label class="form-label fw-bold">
                        حالة الشيك
                    </label>

                    <div class="d-flex gap-4">

                        <div class="form-check">
                            <input
                                class="form-check-input"
                                type="radio"
                                name="status"
                                id="statusPending"
                                value="pending"
                                style="cursor: pointer;"
                                ${check.status === "pending" ? "checked" : ""}
                            >

                            <label
                                class="form-check-label"
                                for="statusPending"
                                style="cursor: pointer;"
                            >
                                جاري
                            </label>
                        </div>


                        <div class="form-check">
                            <input
                                class="form-check-input"
                                type="radio"
                                name="status"
                                id="statusPaid"
                                value="paid"
                                style="cursor: pointer;"
                                ${check.status === "paid" ? "checked" : ""}
                            >

                            <label
                                class="form-check-label"
                                for="statusPaid"
                                style="cursor: pointer;"
                            >
                                مكتمل
                            </label>
                        </div>


                        <div class="form-check">
                            <input
                                class="form-check-input"
                                type="radio"
                                name="status"
                                id="statusCancelled"
                                value="cancelled"
                                style="cursor: pointer;"
                                ${check.status === "cancelled" ? "checked" : ""}
                            >

                            <label
                                class="form-check-label"
                                for="statusCancelled"
                                style="cursor: pointer;"
                            >
                                ملغي
                            </label>
                        </div>

                    </div>

                </div>

            </div>

        </form>
    `;


    const dialog = bootbox.dialog({

        title: "تعديل بيانات الشيك",

        message: checkForm,

        size: "large",

        buttons: {

            cancel: {
                label: "إلغاء",
                className: "btn-secondary"
            },

            save: {
                label: '<i class="fa-solid fa-floppy-disk"></i> حفظ',
                className: "btn-success",

                callback: function () {

                    const form =
                        document.getElementById("checkEditForm");

                    if (!form.checkValidity()) {

                        form.reportValidity();

                        return false;
                    }


                    const formData = new FormData(form);



                    const checkFormData = Object.fromEntries(formData.entries());


                    updateCheckStatus(
                        check.id,
                        checkFormData,
                        dialog
                    );


                    return false;
                }
            }
        }
    });

    // 👇 حطها هون
    dialog.on("hide.bs.modal", function () {

        if (this.contains(document.activeElement)) {
            document.activeElement.blur();
        }

    });


    dialog.find(".modal-header")
    .addClass("bg-success text-white");
    dialog.find(".modal-header .btn-close")
    .addClass("btn-close-white");
}

async function updateCheckStatus(id, checkFormData, dialog) {
    overlayLoader.classList.remove('d-none');

    try {

        const response = await fetch(url + `/check/status?id=${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },

            body: JSON.stringify(checkFormData)
        });

        const result = await response.json();

        if (response.status !== 200) {
            throw new Error(
                result.message || "فشل تعديل حالة الشيك"
            );
        }

        // نجح التعديل
        dialog.modal("hide");


        await updateCash();
        

    } catch (error) {

        // فشل → الـ Bootbox تبقى مفتوحة
        bootboxError(
            error.message || "حدث خطأ أثناء تعديل حالة الشيك"
        );
    }finally{
        overlayLoader.classList.add('d-none');
    }
}


function getActiveCheckPeriod() {
    const activeButton = document.querySelector('.check-period-btn.active');

    return activeButton?.dataset.period || null;
}


async function updateCash() {
    const period = getActiveCheckPeriod();
    if(period == 'recently_added'){
        await loadChecksRecentlyAdded();
    }
    else{
        await loadChecksRecentlyAdded(false);
        await loadChecks();
    }
}