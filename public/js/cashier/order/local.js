import { bootboxError, setActiveNavLink } from "../../../component/bootbox.js";
import { urlServer, localUrlServer } from "../../../api/urlEndPoint.js";

import { removeAuthToken } from "../../../component/auth.js";

import { closeSideBar } from "../Switch-user-functionality.js";
import { formatDateOnly, formatTimeOnly, utcToPalestine } from "../../admin/report/shared-functionality.js";

const BATCH_SIZE = 20;

let currentOrders = [];
let syncedCount = 0;
let isSyncing = false;

const header = document.querySelector("site-header");

const ordersTableBody = document.getElementById('ordersTableBody');
const syncOrdersBtn = document.getElementById('syncOrdersBtn');

const orderItemsModal = new bootstrap.Modal(
    document.getElementById('orderItemsModal')
);






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
        closeSideBar();
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

document.addEventListener('DOMContentLoaded', async function () {

    await loadOrders();
});

// =====================================
// Data Functions
// =====================================

// جلب 20 طلباً غير متزامن من الجهاز
async function getSavedOrdersBatch() {
    try {
        const res = await fetch(localUrlServer + `/orders`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
            },
        });
        const data = await res.json();

        if (res.status === 200) {
            return {
                complete_orders: data.orders.complete_orders || [],
            };
        }
        else {
            bootboxError(data.message);
            return {
                complete_orders: [],
            };
        }

    } catch (e) {
        bootboxError(e.message);
        return {
            complete_orders: [],
        };
    }
}


// مزامنة الدفعة الحالية مع السيرفر
async function syncOrdersBatch(orders) {

    throw new Error('يجب ربط syncOrdersBatch بفنكشن المزامنة');
}


// حذف الطلبات التي تمت مزامنتها بنجاح من الجهاز
async function deleteSyncedOrders(orderIds) {

    const res = await fetch(localUrlServer + '/orders/delete-synced', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            orderIds
        })
    });

    const data = await res.json();


    if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشل حذف الطلبات المحلية من السيرفر');
    }

    return data;
}


// =====================================
// Load Orders
// =====================================

async function loadOrders() {

    try {

        syncOrdersBtn.disabled = true;

        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-5">
                    <div class="spinner-border text-primary"></div>
                    <p class="text-secondary mt-2 mb-0">
                        جاري تحميل الطلبات...
                    </p>
                </td>
            </tr>
        `;

        const result = await getSavedOrdersBatch();

        currentOrders = result.complete_orders || [];

        renderOrders();

        document.getElementById('currentBatchCount').textContent =
            currentOrders.length;

        document.getElementById('ordersCountBadge').textContent =
            `${currentOrders.length} طلب`;

        document.getElementById('batchDescription').textContent =
            `عرض ${currentOrders.length} طلباً في الدفعة الحالية (الحد الأقصى ${BATCH_SIZE})`;

        const isEmpty = currentOrders.length === 0;

        document.getElementById('emptyState').classList.toggle(
            'd-none',
            !isEmpty
        );

        if (isEmpty) {
            document.getElementById('syncStatus').textContent =
                'اكتملت المزامنة';
        }

    } catch (error) {

        console.error('Load Orders Error:', error);

        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-danger py-4">
                    فشل تحميل الطلبات المحلية
                </td>
            </tr>
        `;

    } finally {

        syncOrdersBtn.disabled = isSyncing || currentOrders.length === 0;

    }
}


// =====================================
// Render Orders
// =====================================

function renderOrders() {
    console.log('Rendering orders:', currentOrders);

    if (!currentOrders.length) {
        ordersTableBody.innerHTML = '';
        return;
    }

    ordersTableBody.innerHTML = currentOrders.map(order => {

        const itemsCount = order.items?.length || 0;

        order.created_at = utcToPalestine(order.created_at);

        return `
            <tr>

                <td>
                    <span class="order-id">#${order.id}</span>
                </td>

                <td>
                    ${formatDate(order.created_at)}
                </td>

                
                <td>
                    <span class="badge text-bg-light border">
                        ${itemsCount} صنف
                    </span>
                </td>

                <td class="fw-bold">
                    ${formatNumber(order.total_price)}
                </td>

                <td class="text-danger fw-bold">
                    ${formatNumber(order.discount)}
                </td>

                <td>
                    ${escapeHtml(order.payment_method ?? '-')}
                </td>

                <td>
                    ${getStatusBadge(order.status)}
                </td>

                <td class="text-center">

                    <button
                        type="button"
                        class="btn btn-outline-primary btn-sm view-items-btn"
                        data-order-id="${order.id}"
                        title="عرض الأصناف">

                        <i class="bi bi-eye"></i>

                    </button>

                </td>

            </tr>
        `;

    }).join('');

}


// =====================================
// Order Items Modal
// =====================================

function openOrderItemsModal(orderId) {

    const order = currentOrders.find(
        order => String(order.id) === String(orderId)
    );

    if (!order) return;

    document.getElementById('modalOrderId').textContent =
        `#${order.id}`;

    document.getElementById('modalOrderTotal').textContent =
        formatNumber(order.total_price);

    const tbody = document.getElementById('orderItemsTableBody');

   

    tbody.innerHTML = order.items.map((item, index) => {

        return `
            <tr>
                <td>${index + 1}</td>

                <td class="fw-semibold">
                    ${escapeHtml(item.item_name ?? 'صنف محذوف')}
                </td>

                <td>
                    ${formatNumber(item.quantity)}
                </td>

                <td>
                    ${escapeHtml(item.unit ?? '-')}
                </td>

                <td>
                    ${formatNumber(item.price)}
                </td>

                <td>
                    ${formatNumber(item.discount_item)}
                </td>
            </tr>
        `;

    }).join('');

    

    orderItemsModal.show();

}


// =====================================
// Synchronization
// =====================================

async function syncCurrentBatch() {

    if (isSyncing || currentOrders.length === 0) return;

    isSyncing = true;

    syncOrdersBtn.disabled = true;

    document.getElementById('emptyState').classList.add('d-none');

    document.getElementById('syncStatus').textContent =
        'جاري المزامنة...';

    document.getElementById('progressContainer').classList.remove('d-none');

    updateProgress(0);

    try {

        // الخطوة 1: تحديد IDs الطلبات الحالية
        const orderIds = currentOrders.map(order => order.id);

        // الخطوة 2: إرسال الدفعة الحالية للسيرفر
        updateProgress(30);

        await syncOrdersBatch(currentOrders);

        // الخطوة 3: حذف الطلبات بعد نجاح المزامنة فقط
        updateProgress(75);

        await deleteSyncedOrders(orderIds);

        // الخطوة 4: تحديث عدد الطلبات التي تمت مزامنتها
        syncedCount += currentOrders.length;

        document.getElementById('syncedCount').textContent =
            syncedCount;

        updateProgress(100);

        document.getElementById('syncStatus').textContent =
            'تمت مزامنة الدفعة بنجاح';

        // الخطوة 5: تحميل الدفعة التالية
        currentOrders = [];

        await loadOrders();

        if (currentOrders.length > 0) {

            document.getElementById('syncStatus').textContent =
                'الدفعة التالية جاهزة للمزامنة';

        } else {

            document.getElementById('syncStatus').textContent =
                'اكتملت مزامنة جميع الطلبات';

        }

    } catch (error) {

        console.error('Sync Error:', error);

        document.getElementById('syncStatus').textContent =
            'فشلت المزامنة';

        bootboxError('حدث خطأ أثناء المزامنة.\n' +'لم يتم حذف الطلبات المحلية، يمكنك المحاولة مرة أخرى.\n\n' + (error.message || '') );

    } finally {

        isSyncing = false;

        syncOrdersBtn.disabled = currentOrders.length === 0;

        document.getElementById('progressContainer').classList.add('d-none');

    }

}


// =====================================
// Progress
// =====================================

function updateProgress(percentage) {

    document.getElementById('syncProgressBar').style.width =
        `${percentage}%`;

    document.getElementById('progressPercentage').textContent =
        `${percentage}%`;

    document.getElementById('progressText').textContent =
        percentage === 100
            ? 'اكتملت مزامنة الدفعة'
            : 'جاري مزامنة الطلبات...';

}


// =====================================
// Helpers
// =====================================

function formatNumber(value) {

    return Number(value || 0).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

}


function formatDate(value) {

    if (!value) return '-';

    const date = new Date(value);

    if (isNaN(date.getTime())) return '-';

    return date.toLocaleString('en-GB');

}


function escapeHtml(value) {

    return String(value ?? '').replace(/[&<>"']/g, char => {

        const entities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };

        return entities[char];

    });

}


function getStatusBadge(status) {

    const statuses = {
        'مكتمل': 'success',
        'ملغي': 'danger',
        'معلق': 'warning'
    };

    const color = statuses[status] || 'secondary';

    return `
        <span class="badge text-bg-${color}">
            ${escapeHtml(status ?? 'غير محدد')}
        </span>
    `;

}


// =====================================
// Events
// =====================================

document.addEventListener('click', async (e) => {

    // عرض أصناف الطلب
    if (e.target.closest('.view-items-btn')) {

        const btn = e.target.closest('.view-items-btn');

        const orderId = btn.dataset.orderId;

        openOrderItemsModal(orderId);

    }

    // مزامنة الدفعة الحالية
    if (e.target.closest('#syncOrdersBtn')) {

        await syncCurrentBatch();

    }

});


