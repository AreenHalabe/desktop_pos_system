import { showAuthExpired, showError, hiddeError, setActiveNavLink, showPrintLoader, hidePrintLoader, bootboxError } from "../../../component/bootbox.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import { handelOrderDatabeforPrinting } from "../../../component/invoices.js";
import { closeSideBar } from "../Switch-user-functionality.js";
import { formatDateOnly, formatTimeOnly, utcToPalestine } from "../../admin/report/shared-functionality.js";

const header = document.querySelector("site-header");
const deletedBtn = document.getElementById('toggle-deleted-btn');
const combletBtn = document.getElementById('toggle-complet-btn');
const errorBox = document.getElementById('error-box');
const editItemsBtn = document.getElementById("editItemsBtn");

const orderDetailsModal = document.getElementById("orderDetailsModal");

const confirmPayModalElement = document.getElementById("confirmPayModal");
const confirmPayModal = bootstrap.Modal.getOrCreateInstance(confirmPayModalElement);
const confirmPayDialog = $(confirmPayModalElement);

let completedOrders;
let deletedOrders;

let allOrders = [];



let currentPage;
let itemsPerPage = 10;
let totalItems;
let totalPages;
let sessionId;

let updatedOrder;

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
        } finally {
            hidePrintLoader();
        }
    }

    else if (e.target.closest('.edit-item-btn')) {
        const btn = e.target.closest(".edit-item-btn");

        const orderItemId = Number(btn.dataset.id);


        const index = updatedOrder.items.findIndex(
            item => Number(item.order_item_id) === orderItemId
        );

        if (index !== -1) {
            updatedOrder.items[index].quantity -= 1;

            if (updatedOrder.items[index].quantity <= 0) {
                updatedOrder.items.splice(index, 1);
            }
        }

        renderUpdatedOrderItems(updatedOrder);

    }

    else if (e.target.closest('.edit-items-btn')) {
       
        showConfirmPayDialog(updatedOrder);

    }

    else if (e.target.closest('#confirmOrderButton')) {
        if(updatedOrder.items.length === 0){
            bootboxError("لا يمكن إرجاع جميع أصناف الطلب بهذه الطريقة. إذا كنت ترغب في حذف الطلب بالكامل، يُرجى استخدام زر الحذف المخصص لذلك.");
            return;
        }
        await updateOrderItems(updatedOrder);
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



orderDetailsModal.addEventListener("hidden.bs.modal", function () {
    reSetUpdateOrderState();
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
                <td data-label = 'المبلغ' class='nowrap-cell fw-bold'>${Number(order.total_price).toString()} ₪</td>
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

async function updateOrderItems(finalOrder) {
    const loader = document.getElementById('overlay_loader');
    loader.style.display='flex';
    try {
        const res = await fetch(urlServer + `/order/update`, {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            body: JSON.stringify(finalOrder),
        });
        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
        }
        else if (res.status === 200) {
            confirmPayModal.hide();
            closeModale();
            await getAllCompletedDeletedDailyOrders();
            bootboxSuccess(data.message);
        }
        else {
            bootboxError(data.message);
        }

    } catch (e) {
        bootboxError(e.message);
    }finally{
        loader.style.display='none';
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
        const displayName = item.item_name
            ? `${item.item_name}`
            : 'تم حذف الصنف';

        
        const discountPercent = Number(item.discount_item) || 0;

        const discountValue = roundDiscount(
            Number(item.quantity * item.price) * discountPercent / 100
        );

        itemsHtml += `
            <tr>
                <td>${displayName}</td>
                <td>${item.unit}</td>
                <td>${item.quantity}</td>
                <td>${item.price} ₪</td>
                <td class='text-danger'>
                    %${discountPercent}
                    —
                    ₪${discountValue}
                </td>
                <td class='fw-bold'>${Number(Number(item.quantity) * Number(item.price)).toFixed(2)} ₪</td>
            </tr>
        `;
    });

    itemsHtml += `
        <tr class='table-light'>
            <td colspan="5" class="text-end pe-3">
                <strong>المجموع بدون الخصم</strong>
            </td>
            <td>
                <strong>${Number(order.total_price) + Number(order.discount)} ₪</strong>
            </td>
        </tr>

        <tr class='table-danger'>
            <td colspan="5" class="text-end pe-3 text-danger">
                <strong>قيمة الخصم</strong>
            </td>
            <td class="text-danger">
                ${Number(order.total_discount_p) > 0
                    ?`<strong>${Number(order.total_discount_p).toString()}%</strong> —`
                    :''
                }
                <strong>${Number(order.discount)} ₪</strong>
            </td>
        </tr>

        <tr class="table-success">
            <td colspan="5" class="text-end pe-3">
                <strong>الإجمالي</strong>
            </td>
            <td>
                <strong>${Number(order.total_price).toString()} ₪</strong>
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
    editItemsBtn.dataset.orderId = orderId;

    if (order.cancel_reason != null) {
        displayCanselResonAndTimeUpdated();
        document.getElementById('modalUpdated').textContent = formatTimeOnly(order.updated_at);
        document.getElementById('modalCancelReason').textContent = order.cancel_reason;
    }
    else {
        hiddeCanselResonAndTimeUpdated();
    }

    // إظهار المودل
    const modal = new bootstrap.Modal(orderDetailsModal);
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

function closeModale() {
    const modal = bootstrap.Modal.getInstance(orderDetailsModal);
    modal.hide();
}



editItemsBtn.addEventListener("click", async (event) => {

    if (!editItemsBtn.classList.contains("is-active")) {
        editItemsBtn.classList.add("is-active");
        editItemsBtn.classList.remove("btn-danger");
        editItemsBtn.classList.add("btn-warning");
        editItemsBtn.innerHTML = `
            <i class="fas fa-times ms-1"></i> إلغاء العملية
        `;

        document.getElementById('cartSection').classList.remove('d-none');

        document.getElementById("confirmUpdateOrderBtn").classList.remove("d-none");

        document.getElementById('operation').textContent = 'إرجاع جزء من أصناف الطلب';

        const currentOrderId = Number(editItemsBtn.dataset.orderId);


        const order = completedOrders.find(o => o.id === currentOrderId);


        renderUpdatedOrderItems(order);
    } else {
        reSetUpdateOrderState();
    }

});

function renderUpdatedOrderItems(order) {
    if(!order) return;
    const table = document.getElementById("cartTable");
    table.innerHTML = "";

    updatedOrder = structuredClone(order);

    if (updatedOrder.items.length === 0) return;


    let newTotalPrice = 0;
    let totalDiscountItems = 0;

   

    table.innerHTML = updatedOrder.items.map(item => {
        const qty = Number(item.quantity);
        const price = Number(item.price);
        const total = qty * price;

        newTotalPrice += total;

        const discountPercent = Number(item.discount_item) || 0;
        const discountValue = roundDiscount(Number(total) * discountPercent / 100);

      
        totalDiscountItems += discountValue;


        return `
            <tr>

                <td class="text-center align-middle nowrap-cell">
                    ${item.item_name}
                </td>
                <td class="text-center align-middle nowrap-cell">
                    ${item.unit}
                </td>

                <td class="text-center align-middle">
                    ${qty}
                </td>

                <td class="text-center align-middle">
                    ${price}₪
                </td>

                <td class="text-center align-middle nowrap-cell text-danger">
                    %${item.discount_item}
                    —
                    ${discountValue}₪
                </td>

                <td class="text-center align-middle">
                    ${total} ₪
                </td>

                <td class="d-flex justify-content-center align-items-center p-2">
                    <button 
                        class="btn btn-sm edit-item-btn btn-danger"
                        data-id="${item.order_item_id}"
                    >
                        <i class="fa fa-minus"></i>
                    </button>
                </td>

            </tr>
        `;

    }).join("");

    if(Number(updatedOrder.total_discount_p)==0){
        updatedOrder.discount = totalDiscountItems;
    }
    else{
        const discountPercent = Number(updatedOrder.total_discount_p) || 0;
        updatedOrder.discount = roundDiscount(newTotalPrice * discountPercent / 100);
    }

    updatedOrder.total_price = newTotalPrice - updatedOrder.discount



    table.innerHTML += `
        <tr>
            <td colspan="5" class="text-end pe-3 table-light">
                <strong>المجموع بدون الخصم</strong>
            </td>
            <td class="text-center table-light">
                <strong>${newTotalPrice} ₪</strong>
            </td>
            <td class="p-0 border-0"></td>
        </tr>

        <tr>
            <td colspan="5" class="text-end pe-3 text-danger table-danger">
                <strong>قيمة الخصم</strong>
            </td>
            <td class="text-danger text-center table-danger">
                ${
                    Number(updatedOrder.total_discount_p) > 0
                        ? `<strong>${updatedOrder.total_discount_p}%</strong> —`
                        : ''
                }
                <strong>${updatedOrder.discount} ₪</strong>
            </td>
            <td class="p-0 border-0"></td>
        </tr>
    `;

    document.getElementById("totalPrice").innerText = updatedOrder.total_price;

}

function roundDiscount(discount) {
    if (discount === 0) return 0;

    const firstDecimal = Math.floor(discount * 10) % 10;

    return Math.floor(discount) + (firstDecimal >= 4 ? 1 : 0);
}

function reSetUpdateOrderState(){
    editItemsBtn.classList.remove("is-active");

    editItemsBtn.classList.remove("btn-warning");
    editItemsBtn.classList.add("btn-success");

    editItemsBtn.innerHTML = `
        <i class="fas fa-edit ms-1"></i>  إرجاع جزء من الطلب
    `;

    document.getElementById('cartSection').classList.add('d-none');
    updatedOrder = null;
}






function showConfirmPayDialog(invoiceData) {

    if(!invoiceData) return ;

    const itemsHtml = invoiceData.items.map(item => {

        return `
            <tr>
                <td class="text-center fw-semibold" style ="font-size:15px">
                    ${item.item_name}
                </td>

                <td class="text-center" style ="font-size:15px">
                    ${item.unit}
                </td>

                <td class="text-center">
                    ${item.quantity}
                </td>

                <td class="text-center" style ="font-size:15px">
                    ₪ ${item.price}
                </td>

                <td class="text-center">
                    <span class="badge bg-danger-subtle text-danger border border-danger-subtle" style ="font-size:14px">
                        %${item.discount_item}
                    </span>
                </td>

                <td class="text-center fw-bold">
                    ₪ ${Number(item.quantity) * Number(item.price)}
                </td>
            </tr>
        `;
    }).join("");


       // تحديث أصناف الفاتورة
    confirmPayDialog.find("#confirmOrderItems").html(itemsHtml);

    // تحديث المجاميع
    confirmPayDialog.find("#confirmSubtotal").text(
        `₪ ${Number(invoiceData.total_price) + Number(invoiceData.discount)}`
    );

    confirmPayDialog.find("#confirmDiscount").text(
        `${
            Number(invoiceData.total_discount_p) > 0
                ? `${invoiceData.total_discount_p}%—`
                : ''
        }
         ₪ ${invoiceData.discount}`
    );


    confirmPayDialog.find("#confirmGrandTotal").text(
        `₪ ${invoiceData.total_price}`
    );




    // فتح نفس النافذة كل مرة
    confirmPayModal.show();
}
