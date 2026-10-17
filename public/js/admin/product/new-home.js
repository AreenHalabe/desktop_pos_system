
import { fetchCategories } from "../../../api/category.js";
import { url } from "../../../api/urlEndPoint.js";
import {showAuthExpired, bootboxConfirm, bootboxSuccess, bootboxError, setActiveNavLink} from "../../../component/bootbox.js";
import {removeAuthToken, getAuthToken} from "../../../component/auth.js";

// ============================================
// Header
// ============================================

const header = document.querySelector("site-header");


class SiteHeader extends HTMLElement {
  async connectedCallback() {

    const res = await fetch('../component/header.html');
    this.innerHTML = await res.text();

    // 🔔 إعلان رسمي: الهيدر جاهز
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


// ============================================
// Settings
// ============================================

const PAGE_SIZE = 50;
const MAX_VISIBLE_PAGES = 5;


// ============================================
// DOM Elements
// ============================================

const elements = {
    addItemBtn: document.getElementById("addItemBtn"),

    categoryFilter: document.getElementById("categoryFilter"),
    barcodeSearch: document.getElementById("barcodeSearch"),
    searchBarcodeBtn: document.getElementById("searchBarcodeBtn"),
    clearSearchBtn: document.getElementById("clearSearchBtn"),
    resetFiltersBtn: document.getElementById("resetFiltersBtn"),

    activeFilterInfo: document.getElementById("activeFilterInfo"),

    itemsTableBody: document.getElementById("itemsTableBody"),
    itemsCount: document.getElementById("itemsCount"),
    itemsAlert: document.getElementById("itemsAlert"),

    paginationInfo: document.getElementById("paginationInfo"),
    paginationList: document.getElementById("paginationList"),

    deleteItemModal: document.getElementById("deleteItemModal"),
    deleteItemName: document.getElementById("deleteItemName"),
    confirmDeleteBtn: document.getElementById("confirmDeleteBtn")
};


// ============================================
// State
// ============================================

const state = {
    page: 1,
    limit: PAGE_SIZE,

    categoryId: "",
    barcode: "",

    items: [],
    totalItems: 0,
    totalPages: 0,

    isLoading: false,
    isDeleting: false,

    pendingDeleteItem: null,
    requestController: null
};


// ============================================
// Alerts
// ============================================

function showAlert(message, type = "danger") {
    elements.itemsAlert.textContent = message;
    elements.itemsAlert.className = `items-alert alert alert-${type}`;
    elements.itemsAlert.classList.remove("d-none");
}

function hideAlert() {
    elements.itemsAlert.classList.add("d-none");
    elements.itemsAlert.textContent = "";
}


// ============================================
// Query String
// ============================================

function buildQueryString(params) {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value !== "" && value !== null && value !== undefined) {
            searchParams.set(key, String(value));
        }
    }

    return searchParams.toString();
}


// ============================================
// Loading / Empty / Error States
// ============================================

function renderLoading() {
    elements.itemsTableBody.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;

    const container = document.createElement("div");
    container.className = "table-state";

    const spinner = document.createElement("span");
    spinner.className = "spinner-border spinner-border-sm";
    spinner.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.textContent = "جاري تحميل الأصناف...";

    container.append(spinner, text);
    cell.appendChild(container);
    row.appendChild(cell);

    elements.itemsTableBody.appendChild(row);
}

function renderEmpty(message = "لا توجد أصناف") {
    elements.itemsTableBody.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;

    const container = document.createElement("div");
    container.className = "table-state table-state-empty";

    const iconContainer = document.createElement("div");
    iconContainer.className = "table-state-icon";

    const icon = document.createElement("i");
    icon.className = "fa-solid fa-box-open";
    iconContainer.appendChild(icon);

    const title = document.createElement("strong");
    title.textContent = message;

    const description = document.createElement("p");
    description.textContent =
        "جرّب تغيير الفلتر أو البحث عن صنف آخر.";

    container.append(iconContainer, title, description);
    cell.appendChild(container);
    row.appendChild(cell);

    elements.itemsTableBody.appendChild(row);
}

function renderTableError(message) {
    elements.itemsTableBody.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;

    const container = document.createElement("div");
    container.className = "table-state";

    const icon = document.createElement("i");
    icon.className =
        "fa-solid fa-triangle-exclamation text-danger";

    const text = document.createElement("span");
    text.textContent = message;

    container.append(icon, text);
    cell.appendChild(container);
    row.appendChild(cell);

    elements.itemsTableBody.appendChild(row);
}


// ============================================
// Categories
// أبقينا تحميل الفئات باستخدام fetchCategories
// ============================================

function flattenCategories(categories, result = []) {
    if (!Array.isArray(categories)) {
        return result;
    }

    for (const category of categories) {
        if (!category || category.id == null) {
            continue;
        }

        result.push({
            id: category.id,
            name: category.name ?? `فئة ${category.id}`
        });

        if (Array.isArray(category.categories)) {
            flattenCategories(category.categories, result);
        }

        if (Array.isArray(category.children)) {
            flattenCategories(category.children, result);
        }
    }

    return result;
}

function getCategoriesFromResponse(data) {
    if (Array.isArray(data)) {
        return data;
    }

    return (
        data?.categories ??
        data?.items ??
        data?.tree ??
        data?.data?.categories ??
        data?.data?.items ??
        data?.data?.tree ??
        []
    );
}

async function loadCategories() {
    try {
        const data = await fetchCategories();

        const rawCategories = getCategoriesFromResponse(data);
        const categories = flattenCategories(rawCategories);

        const uniqueCategories = [
            ...new Map(
                categories.map(category => [
                    String(category.id),
                    category
                ])
            ).values()
        ];

        const fragment = document.createDocumentFragment();

        const allOption = document.createElement("option");
        allOption.value = "";
        allOption.textContent = "كل الفئات";

        fragment.appendChild(allOption);

        for (const category of uniqueCategories) {
            const option = document.createElement("option");

            option.value = String(category.id);
            option.textContent = category.name;

            fragment.appendChild(option);
        }

        elements.categoryFilter.replaceChildren(fragment);

    } catch (error) {
        console.error("Failed to load categories:", error);

        showAlert(
            "تعذّر تحميل الفئات. يمكنك متابعة عرض الأصناف.",
            "warning"
        );
    }
}


// ============================================
// Load Items
// كل طلب API داخل الفنكشن الخاص فيه
// ============================================

async function loadItems() {
    state.requestController?.abort();

    const controller = new AbortController();
    state.requestController = controller;
    state.isLoading = true;

    hideAlert();
    renderLoading();

    try {
        let endpoint;
        const barcodeMode = Boolean(state.barcode);

        if (barcodeMode) {
            const query = buildQueryString({
                barcode: state.barcode
            });

            endpoint = `${url}/items?${query}`;
        } else {
            const query = buildQueryString({
                page: state.page,
                limit: state.limit,
                category_id: state.categoryId
            });

            endpoint = `${url}/items?${query}`;
        }

        const res = await fetch(endpoint, {
            method: "GET",
            headers: {
                "Authorization": `${getAuthToken("auth")}`
            },
            signal: controller.signal
        });

        const data = await res.json();

        console.log(data);

        if (!res.ok) {
            if (res.status === 401) {
                showAuthExpired();
            }

            throw new Error(
                data.message || "حدث خطأ أثناء جلب الأصناف"
            );
        }

        // تجاهل الاستجابة القديمة إذا بدأ طلب أحدث.
        if (state.requestController !== controller) {
            return;
        }

        if (barcodeMode) {
            renderBarcodeResult(data);
        } else {
            renderItemsResponse(data);
        }

        updateFilterInfo();

    } catch (error) {
        if (error.name === "AbortError") {
            return;
        }

        console.error("Failed to load items:", error);

        state.items = [];
        state.totalItems = 0;
        state.totalPages = 0;

        updateItemsCount(0);
        renderPagination();

        renderTableError("تعذّر تحميل الأصناف. حاول مرة أخرى.");

        if (error.message) {
            showAlert(error.message);
        } else {
            showAlert("حدث خطأ أثناء تحميل الأصناف.");
        }

    } finally {
        if (state.requestController === controller) {
            state.isLoading = false;
            state.requestController = null;
        }
    }
}


// ============================================
// Handle Items Response
// ============================================

function renderItemsResponse(data) {
    const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data?.items)
            ? data.data.items
            : [];

    const pagination =
        data?.pagination ??
        data?.data?.pagination ??
        {};

    state.items = items;

    state.totalItems = Number(
        pagination.totalItems ??
        pagination.total_items ??
        data?.totalItems ??
        items.length
    );

    state.totalPages = Number(
        pagination.totalPages ??
        pagination.total_pages ??
        Math.ceil(state.totalItems / state.limit)
    );

    if (state.totalPages > 0 && state.page > state.totalPages) {
        state.page = state.totalPages;
        void loadItems();
        return;
    }

    renderItemsTable(items);
    updateItemsCount(state.totalItems);
    renderPagination();
}


// ============================================
// Barcode Search Result
// ============================================

function renderBarcodeResult(data) {
    const item = data?.item ?? data?.data?.item ?? null;

    if (!item) {
        state.items = [];
        state.totalItems = 0;
        state.totalPages = 0;

        renderEmpty("لم يتم العثور على صنف بهذا الباركود");
        updateItemsCount(0);
        renderPagination();

        showAlert(
            "لا يوجد صنف مطابق للباركود المدخل.",
            "warning"
        );

        return;
    }

    state.items = [item];
    state.totalItems = 1;
    state.totalPages = 1;

    renderItemsTable(state.items);
    updateItemsCount(1);
    renderPagination();
}


// ============================================
// Render Items Table
// ============================================

function renderItemsTable(items) {
    elements.itemsTableBody.replaceChildren();

    if (!items.length) {
        renderEmpty();
        return;
    }

    const fragment = document.createDocumentFragment();

    // for (const item of items) {
    //     const row = document.createElement("tr");

    //     const nameCell = document.createElement("td");
    //     nameCell.className = "item-name-cell";
    //     nameCell.textContent = item.name ?? "بدون اسم";



    //     const actionsCell = document.createElement("td");
    //     actionsCell.className = "item-actions-cell";

    //     const editButton = document.createElement("button");
    //     editButton.type = "button";
    //     editButton.className =
    //         "btn item-action-btn item-edit-btn";
    //     editButton.dataset.action = "edit";
    //     editButton.dataset.itemId = String(item.id);
    //     editButton.title = "تعديل الصنف";
    //     editButton.setAttribute("aria-label", "تعديل الصنف");

    //     const editIcon = document.createElement("i");
    //     editIcon.className = "fa-solid fa-pen-to-square";
    //     editButton.appendChild(editIcon);

    //     const deleteButton = document.createElement("button");
    //     deleteButton.type = "button";
    //     deleteButton.className =
    //         "btn item-action-btn item-delete-btn";
    //     deleteButton.dataset.action = "delete";
    //     deleteButton.dataset.itemId = String(item.id);
    //     deleteButton.title = "حذف الصنف";
    //     deleteButton.setAttribute("aria-label", "حذف الصنف");

    //     const deleteIcon = document.createElement("i");
    //     deleteIcon.className = "fa-solid fa-trash-can";
    //     deleteButton.appendChild(deleteIcon);

    //     actionsCell.append(editButton, deleteButton);
    //     row.append(nameCell, actionsCell);

    //     fragment.appendChild(row);
    // }

     for (const item of items) {
        const row = document.createElement("tr");

        // اسم الصنف
        const nameCell = document.createElement("td");
        nameCell.className = "item-name-cell";
        nameCell.textContent = item.name ?? "بدون اسم";

        // المخزون
        const stockCell = document.createElement("td");
        stockCell.innerHTML = renderItemStock(item);

        // أسعار البيع
        const priceCell = document.createElement("td");
        priceCell.innerHTML = renderItemPrices(item);

        // العمليات
        const actionsCell = document.createElement("td");
        actionsCell.className = "item-actions-cell";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className =
            "btn item-action-btn item-edit-btn";
        editButton.dataset.action = "edit";
        editButton.dataset.itemId = String(item.id);
        editButton.title = "تعديل الصنف";
        editButton.setAttribute("aria-label", "تعديل الصنف");

        const editIcon = document.createElement("i");
        editIcon.className = "fa-solid fa-pen-to-square";
        editButton.appendChild(editIcon);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className =
            "btn item-action-btn item-delete-btn";
        deleteButton.dataset.action = "delete";
        deleteButton.dataset.itemId = String(item.id);
        deleteButton.title = "حذف الصنف";
        deleteButton.setAttribute("aria-label", "حذف الصنف");

        const deleteIcon = document.createElement("i");
        deleteIcon.className = "fa-solid fa-trash-can";
        deleteButton.appendChild(deleteIcon);

        actionsCell.append(editButton, deleteButton);

        row.append(
            nameCell,
            stockCell,
            priceCell,
            actionsCell
        );

        fragment.appendChild(row);
    }

    elements.itemsTableBody.appendChild(fragment);
}


// ============================================
// Items Count
// ============================================

function updateItemsCount(count) {
    elements.itemsCount.replaceChildren();

    const icon = document.createElement("i");
    icon.className = "fa-solid fa-box";

    const text = document.createElement("span");
    text.textContent = `${count.toLocaleString("ar")} صنف`;

    elements.itemsCount.append(icon, text);
}


// ============================================
// Pagination
// ============================================

function createPageButton({
    label,
    page,
    disabled = false,
    active = false,
    ariaLabel = ""
}) {
    const item = document.createElement("li");
    item.className = "page-item";

    if (disabled) item.classList.add("disabled");
    if (active) item.classList.add("active");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-link";
    button.textContent = label;
    button.dataset.page = String(page);
    button.disabled = disabled || active;

    if (ariaLabel) {
        button.setAttribute("aria-label", ariaLabel);
    }

    if (active) {
        button.setAttribute("aria-current", "page");
    }

    item.appendChild(button);

    return item;
}

function renderPagination() {
    elements.paginationList.replaceChildren();

    if (state.barcode || state.totalPages <= 1) {
        elements.paginationInfo.textContent = state.barcode
            ? "نتيجة البحث بالباركود"
            : `الصفحة ${state.page}`;

        return;
    }

    const totalPages = state.totalPages;
    const currentPage = state.page;

    elements.paginationInfo.textContent =
        `الصفحة ${currentPage.toLocaleString("ar")} من ${totalPages.toLocaleString("ar")}`;

    const fragment = document.createDocumentFragment();

    fragment.appendChild(
        createPageButton({
            label: "السابق",
            page: currentPage - 1,
            disabled: currentPage <= 1,
            ariaLabel: "الصفحة السابقة"
        })
    );

    let startPage = Math.max(
        1,
        currentPage - Math.floor(MAX_VISIBLE_PAGES / 2)
    );

    let endPage = Math.min(
        totalPages,
        startPage + MAX_VISIBLE_PAGES - 1
    );

    startPage = Math.max(
        1,
        endPage - MAX_VISIBLE_PAGES + 1
    );

    if (startPage > 1) {
        fragment.appendChild(
            createPageButton({
                label: "1",
                page: 1
            })
        );

        if (startPage > 2) {
            const dots = document.createElement("li");
            dots.className = "page-item disabled";

            const span = document.createElement("span");
            span.className = "page-link";
            span.textContent = "...";

            dots.appendChild(span);
            fragment.appendChild(dots);
        }
    }

    for (let page = startPage; page <= endPage; page++) {
        fragment.appendChild(
            createPageButton({
                label: String(page),
                page,
                active: page === currentPage
            })
        );
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement("li");
            dots.className = "page-item disabled";

            const span = document.createElement("span");
            span.className = "page-link";
            span.textContent = "...";

            dots.appendChild(span);
            fragment.appendChild(dots);
        }

        fragment.appendChild(
            createPageButton({
                label: String(totalPages),
                page: totalPages
            })
        );
    }

    fragment.appendChild(
        createPageButton({
            label: "التالي",
            page: currentPage + 1,
            disabled: currentPage >= totalPages,
            ariaLabel: "الصفحة التالية"
        })
    );

    elements.paginationList.appendChild(fragment);
}


// ============================================
// Filter Info
// ============================================

function updateFilterInfo() {
    const parts = [];

    if (state.barcode) {
        parts.push(`الباركود: ${state.barcode}`);
    }

    if (state.categoryId) {
        const selectedOption =
            elements.categoryFilter.selectedOptions[0];

        if (selectedOption) {
            parts.push(`الفئة: ${selectedOption.textContent}`);
        }
    }

    const text = parts.length
        ? parts.join(" — ")
        : "يتم عرض جميع الأصناف";

    elements.activeFilterInfo.replaceChildren();

    const icon = document.createElement("i");
    icon.className = "fa-solid fa-circle-info";

    const span = document.createElement("span");
    span.textContent = text;

    elements.activeFilterInfo.append(icon, span);
}


// ============================================
// Search / Reset Filters
// ============================================

function searchByBarcode() {
    state.barcode = elements.barcodeSearch.value.trim();
    state.page = 1;

    void loadItems();
}

function resetFilters() {
    state.categoryId = "";
    state.barcode = "";
    state.page = 1;

    elements.categoryFilter.value = "";
    elements.barcodeSearch.value = "";

    hideAlert();
    void loadItems();
}


// ============================================
// Add / Edit Item
// عدّل أسماء الصفحات حسب مشروعك
// ============================================

function openAddItemPage() {
    window.location.href = "./add-item.html";
}

function openEditItemPage(itemId) {
    const editUrl = new URL(
        "./edit-item.html",
        window.location.href
    );

    editUrl.searchParams.set("id", itemId);
    window.location.href = editUrl.href;
}


// ============================================
// Delete Item API
// ============================================

async function deleteItem(itemId) {
    const res = await fetch(
        `${url}/items/${encodeURIComponent(itemId)}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `${getAuthToken("auth")}`
            }
        }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        if (res.status === 401) {
            showAuthExpired();
        }

        throw new Error(
            data.message || "حدث خطأ أثناء حذف الصنف"
        );
    }

    return data;
}


// ============================================
// Delete Modal
// ============================================

function openDeleteModal(item) {
    state.pendingDeleteItem = item;

    elements.deleteItemName.textContent =
        item.name ?? "هذا الصنف";

    const modal = bootstrap.Modal.getOrCreateInstance(
        elements.deleteItemModal
    );

    modal.show();
}

async function confirmDeleteItem() {
    const item = state.pendingDeleteItem;

    if (!item || state.isDeleting) {
        return;
    }

    state.isDeleting = true;

    const button = elements.confirmDeleteBtn;
    const originalContent = button.innerHTML;

    button.disabled = true;

    const spinner = document.createElement("span");
    spinner.className = "spinner-border spinner-border-sm";

    const text = document.createElement("span");
    text.textContent = " جاري الحذف...";

    button.replaceChildren(spinner, text);

    try {
        await deleteItem(item.id);

        const modal = bootstrap.Modal.getOrCreateInstance(
            elements.deleteItemModal
        );

        modal.hide();
        state.pendingDeleteItem = null;

        showAlert("تم حذف الصنف بنجاح.", "success");

        if (
            state.items.length === 1 &&
            state.page > 1 &&
            !state.barcode
        ) {
            state.page--;
        }

        await loadItems();

    } catch (error) {
        console.error("Failed to delete item:", error);

        showAlert(
            error.message || "تعذّر حذف الصنف.",
            "danger"
        );

    } finally {
        state.isDeleting = false;
        button.disabled = false;
        button.innerHTML = originalContent;
    }
}


// ============================================
// Event Listeners
// ============================================

// إضافة صنف جديد
elements.addItemBtn.addEventListener("click", openAddItemPage);

// البحث بالباركود
elements.searchBarcodeBtn.addEventListener(
    "click",
    searchByBarcode
);

// البحث عند الضغط على Enter
elements.barcodeSearch.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        searchByBarcode();
    }
});

// تغيير الفئة
elements.categoryFilter.addEventListener("change", () => {
    state.categoryId = elements.categoryFilter.value;
    state.barcode = "";
    state.page = 1;

    elements.barcodeSearch.value = "";

    void loadItems();
});

// مسح البحث
elements.clearSearchBtn.addEventListener("click", () => {
    state.barcode = "";
    elements.barcodeSearch.value = "";
    state.page = 1;

    void loadItems();
    elements.barcodeSearch.focus();
});

// إعادة ضبط الفلاتر
elements.resetFiltersBtn.addEventListener(
    "click",
    resetFilters
);

// ترقيم الصفحات
elements.paginationList.addEventListener("click", event => {
    const button = event.target.closest("button[data-page]");

    if (!button || button.disabled) {
        return;
    }

    const page = Number(button.dataset.page);

    if (
        !Number.isInteger(page) ||
        page < 1 ||
        page > state.totalPages ||
        page === state.page
    ) {
        return;
    }

    state.page = page;
    void loadItems();
});

// أحداث أزرار الجدول
elements.itemsTableBody.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) {
        return;
    }

    const itemId = button.dataset.itemId;

    const item = state.items.find(
        currentItem => String(currentItem.id) === itemId
    );

    if (!item) {
        return;
    }

    if (button.dataset.action === "edit") {
        openEditItemPage(item.id);
        return;
    }

    if (button.dataset.action === "delete") {
        openDeleteModal(item);
    }
});

// تأكيد الحذف
elements.confirmDeleteBtn.addEventListener(
    "click",
    confirmDeleteItem
);

// تنظيف الصنف المحدد عند إغلاق نافذة الحذف
elements.deleteItemModal.addEventListener(
    "hidden.bs.modal",
    () => {
        if (!state.isDeleting) {
            state.pendingDeleteItem = null;
        }
    }
);


// ============================================
// Initialize
// ============================================

async function initItemsPage() {
    await loadCategories();
    await loadItems();
}

void initItemsPage();




function renderItemPrices(item) {
    const units = item.units ?? [];

    if (units.length > 1) {
        return `
            <ul class="list-unstyled m-0 ul_box">
                ${units.map(unit => `
                    <li class="list">
                        <span class="badge bg-primary" dir="ltr">
                            ${escapeHtml(unit.unit_name)} : ₪ ${escapeHtml(unit.price ?? '-')}
                        </span>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    if (units.length === 1) {
        return `
            <span class="badge bg-primary fs-6" dir="ltr">
                ${escapeHtml(units[0].price ?? '-')} ₪
            </span>
        `;
    }

    return `
        <span class="badge bg-primary fs-6">-</span>
    `;
}

function renderItemStock(item) {
    const stockBatches = item.stock_batches ?? [];
    const units = item.units ?? [];

    // إجمالي المخزون بأصغر وحدة
    const totalStock = stockBatches.reduce(
        (total, batch) => total + Number(batch.remaining_qty || 0),
        0
    );

    if (units.length === 0) {
        return `
            <span class="badge bg-primary fs-6">
                ${totalStock}
            </span>
        `;
    }

    // الأكبر أولاً حسب معامل التحويل
    const sortedUnits = [...units].sort(
        (a, b) => Number(b.conversion_factor) - Number(a.conversion_factor)
    );

    let remainingStock = totalStock;
    const stockParts = [];

    for (const unit of sortedUnits) {
        const factor = Number(unit.conversion_factor);

        if (!Number.isFinite(factor) || factor <= 0) {
            continue;
        }

        const quantity = Math.floor(remainingStock / factor);

        if (quantity > 0) {
            stockParts.push({
                name: unit.unit_name,
                quantity
            });

            remainingStock %= factor;
        }
    }

    // عرض المتبقي بأصغر وحدة إذا لم يُستهلك بالكامل
    if (remainingStock > 0) {
        const smallestUnit = sortedUnits[sortedUnits.length - 1];

        stockParts.push({
            name: smallestUnit.unit_name,
            quantity: remainingStock
        });
    }

    if (stockParts.length === 0) {
        const smallestUnit = sortedUnits[sortedUnits.length - 1];

        stockParts.push({
            name: smallestUnit.unit_name,
            quantity: 0
        });
    }

    return `
        <ul class="list-unstyled m-0 ul_box">
            ${stockParts.map(part => `
                <li class="list">
                    <span class="badge bg-primary" dir="rtl">
                        ${escapeHtml(part.name)} : ${escapeHtml(part.quantity)}
                    </span>
                </li>
            `).join('')}
        </ul>
    `;
}
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}