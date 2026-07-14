import { showAuthExpired, showError, hiddeError, setActiveNavLink, showPrintLoader, hidePrintLoader, bootboxError } from "../../../component/bootbox.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import { handelOrderDatabeforPrinting } from "../../../component/invoices.js";
import { bootboxLoginAsAdmin, closeSideBar, SwitchToAdmin } from "../Switch-user-functionality.js";
import { formatDateOnly, formatTimeOnly, utcToPalestine } from "../../admin/report/shared-functionality.js";

const header = document.querySelector("site-header");
const deletedBtn = document.getElementById('toggle-deleted-btn');
const combletBtn = document.getElementById('toggle-complet-btn');
const errorBox = document.getElementById('error-box');


let completedOrders;
let deletedOrders;

let allOrders = [];



let currentPage;
let itemsPerPage = 10;
let totalItems;
let totalPages;
let sessionId;

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

    const hasOpenSession = await checkSession();
    if (hasOpenSession) {
        await getAllCompletedDeletedDailyOrders();
    }
    else {
        renderOrdersTable();
    }
});

document.addEventListener("click", async function (e) {

    if (e.target.closest('.prevBtn')) {
        prevPage();
    }
    else if (e.target.closest('.nextBtn')) {
        nextPage();
    }
    else if (e.target.closest('.viewOrder')) {
        const btn = e.target.closest(".viewOrder");
        const orderId = btn.dataset.id;
        viewOrder(Number(orderId));
    }
    else if (e.target.closest('.btn-delete')) {
        const btn = e.target.closest(".btn-delete");

        const row = btn.closest('tr');
        row.classList.add('row-deleting');

        const order = JSON.parse(btn.dataset.order);

        bootboxDeleteReason({

            inv_num: order.inv_num,
            onConfirm: async (reason) => {
                await deleteOrder(order.id, reason);

                setTimeout(() => {
                    row.classList.remove("row-deleting");
                }, 4000);

            },
            onCancel() {
                row.classList.remove("row-deleting");
            }

        });
    }

    else if (e.target.closest('.btn-show-deleted')) {
        deletedBtn.classList.add('hidden');
        combletBtn.classList.remove('hidden');
        handlePagination(deletedOrders);
    }

    else if (e.target.closest('.btn-show-completed')) {
        deletedBtn.classList.remove('hidden');
        combletBtn.classList.add('hidden');
        handlePagination(completedOrders);
    }

    else if (e.target.closest('.restoreOrder')) {
        const btn = e.target.closest(".restoreOrder");
        const row = btn.closest('tr');
        row.classList.add('row-updated');
        const orderId = btn.dataset.id;
        await restoreOrder(orderId);
    }

    else if (e.target.closest('.printBtn')) {
        closeModale();
        showPrintLoader();

        const btn = e.target.closest('.printBtn');

        const orderId = Number(btn.dataset.orderId);

        const order = allOrders.find(o => o.id === orderId);
        order.time = formatTimeOnly(utcToPalestine(order.created_at));
        order.date = formatDateOnly(utcToPalestine(order.created_at));

        try {
           await handelOrderDatabeforPrinting(order);
        } catch (e) {
            bootboxError(e.message);
        }finally{
            hidePrintLoader();
        }
    }

    else if (e.target.closest('.switch-admin-btn')) {
        const input = document.getElementById('adminPassword');
        await SwitchToAdmin(url, input.value);
    }

});

document.addEventListener('change', async (e) => {

    if (!e.target.classList.contains('payment-method')) return;

    hiddeError(errorBox);
    const select = e.target;

    const order = JSON.parse(select.dataset.order);

    const cell = select.closest('.payment-cell');
    const row = select.closest('tr');
    const status = cell.querySelector('.payment-status');

    try {
        status.className = "payment-status loading";
        status.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const res = await fetch(urlServer + `/update/payment-method?order_id=${order.id}`, {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            credentials: 'include',
        });

        const data = await res.json();

        if (res.status === 200) {
            const newMethod = tooglePaymentMethod(Number(order.id));
            bootboxSuccess(
                `تم تغير طريقة الدفع للطلب رقم (${order.inv_num}) إلى ${newMethod}`,
                () => {
                    status.className = "payment-status success";
                    status.innerHTML = '<i class="fas fa-check"></i>';
                    row.classList.add('row-updated');
                    setTimeout(() => {
                        status.innerHTML = '';
                        row.classList.remove('row-updated');
                    }, 3000);
                }
            );

        }
        else if (res.status === 401) {
            showAuthExpired(data.message);
        }

        else {
            status.className = "payment-status error";
            status.innerHTML = '<i class="fas fa-times"></i>';
            showError(errorBox, data.message);

        }


    } catch (err) {
        status.className = "payment-status error";
        status.innerHTML = '<i class="fas fa-times"></i>';
        showError(errorBox, err.message);
    }

});





function renderOrdersTable() {
    const tableBody = document.getElementById('orders-table-body');

    if (allOrders.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لا توجد طلبات لعرضها</p>
                </td>
            </tr>
        `;
        return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageOrders = allOrders.slice(start, end);


    tableBody.innerHTML = '';



    const firstIsCanceled = pageOrders[0]?.status === 'ملغي';


    pageOrders.forEach((order) => {
        const statusClass = order.status === 'مكتمل' ? 'status-completed' :
            order.status === 'معدل' ? 'status-pending' : 'status-cancelled';

        const paymentClass = order.payment_method === 'كاش' ? 'status-completed' :
            order.payment_method === 'بطاقة' ? 'bg-info text-white' : 'status-pending'


        const row = `
            <tr>
                <td data-label = 'رقم الطلب'>${order.invoice_num}</td>
               
                <td data-label = 'طريقة الدفع' class="payment-cell">
                
                    <span class='status-badge ${paymentClass}' >  ${order.payment_method}</span>
                </td>


                <td data-label = 'التاريخ' class='nowrap-cell'>${formatDateOnly(utcToPalestine(order.created_at))}</td>
                <td data-label = 'الوقت' class='nowrap-cell'>${formatTimeOnly(utcToPalestine(order.created_at))}</td>
                <td data-label = 'المبلغ' class='nowrap-cell'>${order.total_price} ₪</td>
                <td data-label = 'الحالة'><span class="status-badge ${statusClass}">${order.status}</span></td>

                <td data-label = 'الإجراءات' class='content-action-btn'>
                    <div class='content-action-btn-group'>
                        ${getOrderActions(order)}
                    </div>
                    
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
    updatePagination();

}

function getOrderActions(order) {

    const viewBtn = `
        <button class="action-btn btn-view viewOrder" data-id="${order.id}" title="عرض الطلب">
            <i class="fas fa-eye"></i>
        </button>
    `;

    if (order.status === 'ملغي') {
        return `
            ${viewBtn}
            <button class="action-btn btn-restore restoreOrder d-none" data-id="${order.id}" title="استرجاع الطلب">
                <i class="fas fa-undo"></i>
            </button>
        `;
    }

    return `
        ${viewBtn}
        <button 
            class="action-btn btn-delete"
            title="حذف الطلب"
            data-order='{"id":${order.id},"inv_num":"${order.invoice_num}"}'>
            <i class="fas fa-trash"></i>
        </button>
    `;
}





function updatePagination() {
    const pageInfo = document.getElementById('pageInfo');

    // تحديث معلومات الصفحة
    pageInfo.textContent = `صفحة ${currentPage} من ${totalPages}`;

    // إخفاء/إظهار الأسهم
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderOrdersTable();
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        renderOrdersTable();
    }
}


async function checkSession() {
    try {
        const res = await fetch(urlServer + '/check/cash-session', {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            credentials: 'include',
        });
        const data = await res.json();
        if (res.status === 401) {
            showAuthExpired(data.message);
            return false;
        }
        else if (res.status === 200) {
            if (data.hasOpeningSession) {
                sessionId = data.session_id;
            }
            return data.hasOpeningSession
        }
        else {
            showError(errorBox, data.message);
            return false;
        }
    } catch (e) {
        showError(errorBox, e);
    }

}

async function getAllCompletedDeletedDailyOrders(isMakeDeleteOrder = false, isMakeRestorOrders = false) {
    const totalOrderCompleted = document.getElementById('total-orders');
    const totalDeletedOrder = document.getElementById('deleted-orders');
    hiddeError(errorBox);
    try {
        const res = await fetch(urlServer + `/daily/completed/deleted/orders?session_id=${sessionId}`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
        });
        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }
        else if (res.status === 200) {
            completedOrders = data?.orders?.complete_orders || [];
            deletedOrders = data?.orders?.deleted_orders || [];
            totalOrderCompleted.textContent = completedOrders.length + ' طلبات' || 0;
            totalDeletedOrder.textContent = deletedOrders.length + ' تم حذفهم' || 0;

            if (isMakeRestorOrders) {
                handlePagination(deletedOrders, isMakeRestorOrders);
                return;
            }
            else if (isMakeDeleteOrder) {
                handlePagination(completedOrders, isMakeDeleteOrder);
                return;
            }

            handlePagination(completedOrders);
            return;
        }
        else {
            showError(errorBox, data.message);
        }

    } catch (e) {
        showError(errorBox, e.message);
    }
}

async function deleteOrder(id, cancel_reason) {
    hiddeError(errorBox);
    try {
        // urlServer + `/delete/order?order_id=${id}`
        const res = await fetch(urlServer + `/delete/order?order_id=${id}`, {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            body: JSON.stringify({
                cancel_reason: cancel_reason
            }),
            credentials: 'include',
        });
        const data = await res.json();
        if (res.status === 200) {
            bootboxSuccess(data.message);
            await getAllCompletedDeletedDailyOrders(true, false);
        }
        else if (res.status === 401) {
            showAuthExpired(data.message);
        }
        else {
            showError(errorBox, data.message);
        }

    } catch (e) {
        showError(errorBox, e.message);
    }
}

async function restoreOrder(id) {
    hiddeError(errorBox);
    try {
        const res = await fetch(urlServer + `/Reorder?order_id=${id}`, {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            credentials: 'include',
        });
        const data = await res.json();
        if (res.status === 200) {
            alert(data.message);
            await getAllCompletedDeletedDailyOrders(false, true);
        }
        else if (res.status === 401) {
            showAuthExpired(data.message);
        }
        else {
            showError(errorBox, data.message);
        }

    } catch (e) {
        showError(errorBox, e.message);
    }
}


function handlePagination(orders = [], isMakeDeleteOrRestore = false) {

    allOrders = orders;
    totalItems = allOrders.length;
    totalPages = Math.ceil(totalItems / itemsPerPage);


    if (isMakeDeleteOrRestore) {
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
    }
    else {
        currentPage = 1;
    }

    if (allOrders.length > 10) {
        displayPaginationBtn();
    }
    else {
        hiddePaginationBtn();
    }

    renderOrdersTable();
}



function displayPaginationBtn() {
    const btn = document.getElementById('paginationBtn');

    if (btn.classList.contains('hidden')) {
        btn.classList.remove('hidden');
    }
}


function hiddePaginationBtn() {
    const btn = document.getElementById('paginationBtn');

    if (!btn.classList.contains('hidden')) {
        btn.classList.add('hidden');
    }
}

function viewOrder(orderId) {
    // البحث عن الطلب
    const order = allOrders.find(o => o.id === orderId);

    // البحث عن أصناف الطلب
    const orderItems = order.items;

    // بناء HTML الجدول
    let itemsHtml = '';
    orderItems.forEach(item => {
        const displayName = item.size_name !== 'NaN'
            ? `${item?.item_name || 'تم حذف الصنف'} - ${item.size_name}`
            : item?.item_name || 'تم حذف الصنف';

        itemsHtml += `
            <tr>
                <td>${displayName}</td>
                <td>${item.quantity}</td>
                <td>${item.price} ₪</td>
                <td>${item.quantity * item.price} ₪</td>
            </tr>
        `;
    });

    itemsHtml += `
        <tr>
            <td colspan="3" class="text-end pe-3">
                <strong>المجموع</strong>
            </td>
            <td>
                <strong>${order.total_price + order.discount} ₪</strong>
            </td>
        </tr>

        <tr>
            <td colspan="3" class="text-end pe-3 text-danger">
                <strong>الخصم</strong>
            </td>
            <td class="text-danger">
                <strong>${order.discount} ₪</strong>
            </td>
        </tr>

        <tr class="table-success">
            <td colspan="3" class="text-end pe-3">
                <strong>الإجمالي</strong>
            </td>
            <td>
                <strong>${order.total_price} ₪</strong>
            </td>
        </tr>
    `;

    // تحديث محتوى المودل
    document.getElementById('modalOrderId').textContent = order.invoice_num;
    document.getElementById('modaltime').textContent = formatTimeOnly(utcToPalestine(order.created_at));
    document.getElementById('modalDate').textContent = formatDateOnly(utcToPalestine(order.created_at));
    document.getElementById('modalPayment').textContent = order.payment_method;
    document.getElementById('modalOrderType').textContent = order.type;
    document.getElementById('modalItemsTable').innerHTML = itemsHtml;
    // تخزين id داخل زر الطباعة
    document.querySelector('.printBtn').dataset.orderId = orderId;

    if (order.cancel_reason != null) {
        displayCanselResonAndTimeUpdated();
        document.getElementById('modalUpdated').textContent = formatTimeOnly(order.updated_at);
        document.getElementById('modalCancelReason').textContent = order.cancel_reason;
    }
    else {
        hiddeCanselResonAndTimeUpdated();
    }

    // إظهار المودل
    const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
    modal.show();
}


function displayCanselResonAndTimeUpdated() {
    const timeUpdated = document.getElementById('modalUpdated').parentElement;;
    const cancelReson = document.getElementById('modalCancelReason').parentElement;;
    if (cancelReson.classList.contains('hidden')) {
        cancelReson.classList.remove('hidden');
        timeUpdated.classList.remove('hidden');
    }
}
function hiddeCanselResonAndTimeUpdated() {
    const timeUpdated = document.getElementById('modalUpdated').parentElement;
    const cancelReson = document.getElementById('modalCancelReason').parentElement;

    if (!cancelReson.classList.contains('hidden')) {
        cancelReson.classList.add('hidden');
        timeUpdated.classList.add('hidden');
    }
}

function bootboxDeleteReason(options = {}) {

    const {
        inv_num,
        message = 'الرجاء إدخال سبب حذف هذا الطلب',
        onConfirm,
        onCancel
    } = options;

    const dialog = bootbox.dialog({
        title: `<i class="bi bi-trash text-danger"></i>  حذف الطلب رقم ${inv_num}`,
        message: `
      <p class="mb-2">${message}</p>
      <input 
        type="text" 
        class="form-control delete-reason-input"
        placeholder="اكتب السبب هنا..."
      >
    `,
        centerVertical: true,
        closeButton: false,
        buttons: {
            cancel: {
                label: 'إلغاء',
                className: 'btn-secondary',
                callback() {
                    if (typeof onCancel === 'function') {
                        onCancel();
                    }
                }
            },
            confirm: {
                label: 'حذف الطلب',
                className: 'btn-danger',
                callback() {
                    const reason = dialog.find('.delete-reason-input').val().trim();

                    if (typeof onConfirm === 'function') {
                        onConfirm(reason);
                    }
                }
            }
        }
    });

    dialog.init(function () {
        const input = dialog.find('.delete-reason-input');
        const confirmBtn = dialog.find('.btn-danger');

        confirmBtn.prop('disabled', true);

        input.on('input', function () {
            confirmBtn.prop('disabled', this.value.trim().length < 3);
        });
    });
}

function bootboxSuccess(message = "تمت العملية بنجاح", onClose = null) {
    bootbox.alert({
        title: `
      <div class="d-flex justify-content-between align-items-center">
        <span class="fw-bold">نجاح العملية</span>
      </div>
    `,
        message: `
      <div class="text-center">
        <i class="bi bi-check-circle-fill text-success" style="font-size:3rem;"></i>
        <p class="mt-1 mb-0 fw-semibold">${message}</p>
      </div>
    `,
        centerVertical: true,
        closeButton: false,
        buttons: {
            ok: {
                label: "تم",
                className: "btn-success px-4"
            }
        },
        callback: function () {
            if (typeof onClose === "function") {
                onClose();
            }
        }
    });
}




function tooglePaymentMethod(orderId) {
    const newPaymentMethodeOption = {
        'كاش': 'بطاقة',
        'بطاقة': 'كاش'
    }
    const order = completedOrders.find(o => o.id === orderId);
    order.payment_method = newPaymentMethodeOption[order.payment_method];

    return order.payment_method;

}

function closeModale(){
    const modalEl = document.getElementById('orderDetailsModal');
    const modal = bootstrap.Modal.getInstance(modalEl);

    modal.hide();
}
