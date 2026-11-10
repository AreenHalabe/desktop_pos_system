
import {
    setActiveNavLink,
    showAuthExpired,
    bootboxError
} from "../../../component/bootbox.js";

import { url } from "../../../api/urlEndPoint.js";

import {
    getAuthToken,
    removeAuthToken
} from "../../../component/auth.js";

import {
    formatTimeOnly,
    formatDateOnly,
    utcToPalestine
} from "../../admin/report/shared-functionality.js"


const header = document.querySelector("site-header");
const overlayLoader = document.getElementById('overlay_loader');

const modalElement = document.getElementById('orderDetailsModal');
const orderDetailsModal = bootstrap.Modal.getOrCreateInstance(modalElement);

let currentPaymentPage = 1;
let totalPaymentPages = 1;

let invoices = [];

let customer;

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
    
    await loadCustomerDetails(1);

});


// ======================================
// تحميل بيانات الزبون والطلبات
// ======================================

async function loadCustomerDetails(page = 1) {

   
    const id = getCustomerId();

    if (!id) {
        bootboxError("رقم الزبون غير موجود");
        return;
    }

    try {

        const res = await fetch(
            url + `/customer/invoices?customer_id=${id}&page=${page}`,
            {
                method: "GET",
                headers: {
                    "Authorization": getAuthToken('user-auth')
                }
            }
        );

        const data = await res.json();
        if (res.status === 401) {

            showAuthExpired(data.message);

            return;

        }

        else if (res.status === 200) {

            customer = data.data.customer;

            invoices = data.data.orders;

            currentPaymentPage = data.pagination.page;

            totalPaymentPages = data.pagination.totalPages;

            setCustomerInfo(customer);

            setHeaderSummery(customer.balance);

            renderDebtsTable(invoices);

            renderInvoicePagination(data.pagination);

        }

        else {

            bootboxError(data.message);

        }

    } catch (e) {

        bootboxError(e.message);

    }

}


// ======================================
// رقم الزبون من الرابط
// ======================================

function getCustomerId() {

    const params = new URLSearchParams(window.location.search);

    const customerId = params.get("customer_id");

    return customerId;

}


// ======================================
// عرض بيانات الزبون
// ======================================

function setCustomerInfo(customer) {

    document.getElementById('customerName').textContent = customer.name;

    document.getElementById('customerPhone').textContent =
        customer.phone || '-';

    document.getElementById('avatar').textContent =
        customer.name.split(' ')[0];

    setCustomerStatus(customer.balance);

}


// ======================================
// حالة حساب الزبون
// ======================================

function setCustomerStatus(balance) {

    const span = document.getElementById('customerStatus');

    const amount = Number(balance);

    if (amount > 0) {

        span.className = 'badge bg-danger fs-6';

        span.textContent = 'عليه رصيد';

    }

    else if (amount < 0) {

        span.className = 'badge bg-primary fs-6';

        span.textContent = 'له رصيد';

    }

    else {

        span.className = 'badge bg-success fs-6';

        span.textContent = 'الحساب مسدد';

    }

}


// ======================================
// إجمالي الرصيد
// ======================================

function setHeaderSummery(balance) {

    document.getElementById('totalDepts').textContent =
        `${Number(balance).toFixed(2)} ₪`;

}


// ======================================
// عرض جدول الطلبات
// ======================================

function renderDebtsTable(orders) {

    const tbody = document.getElementById("debtsTableBody");

    if (!orders?.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لا يوجد فواتير مبيعات لهذا الزبون</p>
                </td>
            </tr>
        `;

        return;

    }

    tbody.innerHTML = "";

    orders.forEach((order, index) => {

        const totalPrice = Number(order.total_price);

        const remaining = Number(order.remaining);

        let status = "مسددة";

        let badgeClass = "bg-success";

        if (remaining >= totalPrice && remaining > 0) {

            status = "غير مدفوعة";

            badgeClass = "bg-danger";

        }

        else if (remaining > 0) {

            status = "مدفوعة جزئياً";

            badgeClass = "bg-warning";

        }

        const invoiceNumber =
            ((currentPaymentPage - 1) * 30) + index + 1;

        const date = utcToPalestine(order.created_at);

        const row = `

            <tr>

                <td>${invoiceNumber}</td>

                <td class="nowrap-cell">
                    <span class="amount-badge total-badge">
                        ${totalPrice.toFixed(2)} ₪
                    </span>
                </td>

                <td class="nowrap-cell">
                    <span class="amount-badge remaining-badge">
                        ${remaining.toFixed(2)} ₪
                    </span>
                </td>

                <td class="nowrap-cell">
                    ${formatDateOnly(date)}
                </td>

                <td class="nowrap-cell">
                    ${formatTimeOnly(date)}
                </td>

                <td>
                    <span class="badge ${badgeClass}">
                        ${status}
                    </span>
                </td>

                <td class="text-center">

                    <button
                        type="button"
                        class="view-btn"
                        data-bs-toggle="modal"
                        data-bs-target="#orderDetailsModal"
                        data-id="${order.id}"
                        data-invoice-num="${invoiceNumber}"
                        title="عرض التفاصيل"
                    >
                        <i class="fas fa-eye"></i>
                    </button>

                </td>

            </tr>

        `;

        tbody.innerHTML += row;

    });

}


// ======================================
// تفاصيل الفاتورة
// ======================================

modalElement.addEventListener('show.bs.modal', function (event) {

    const button = event.relatedTarget;

    const orderId = Number(button.getAttribute('data-id'));

    const invoiceNum = Number(button.getAttribute('data-invoice-num'));

    const order = invoices.find(o => Number(o.id) === orderId);

    if (!order) return;

    const date = utcToPalestine(order.created_at);

    order.date = formatDateOnly(date);

    order.time = formatTimeOnly(date);


    const orderItems = order.items;

    document.getElementById('invoiceNum').textContent = invoiceNum;

    let itemsHtml = '';

    let itemsTotal = 0;

    orderItems.forEach(item => {

        const quantity = Number(item.quantity);

        const price = Number(item.price);

        const total = quantity * price;

        itemsTotal += total;

        itemsHtml += `

            <tr>

                <td>${item.item_name || 'عنصر محذوف'}</td>

                <td>${item.unit}</td>

                <td>${quantity}</td>

                <td>${price.toFixed(2)} ₪</td>

                <td>${total.toFixed(2)} ₪</td>

            </tr>

        `;

    });


    itemsHtml += `

        <tr>
            <td colspan="4" class="text-end pe-3">
                <strong>المجموع</strong>
            </td>

            <td>
                <strong>${itemsTotal.toFixed(2)} ₪</strong>
            </td>
        </tr>

        <tr class="table-success">

            <td colspan="4" class="text-end pe-3">
                <strong>إجمالي الفاتورة</strong>
            </td>

            <td>
                <strong>${Number(order.total_price).toFixed(2)} ₪</strong>
            </td>

        </tr>

        <tr>

            <td colspan="4" class="text-end pe-3 text-danger">
                <strong>المبلغ المتبقي</strong>
            </td>

            <td class="text-danger">
                <strong>${Number(order.remaining).toFixed(2)} ₪</strong>
            </td>

        </tr>

    `;

    document.getElementById('modalItemsTable').innerHTML = itemsHtml;

});


// ======================================
// تنظيف Modal
// ======================================

modalElement.addEventListener('hidden.bs.modal', function () {

    document.querySelectorAll('.modal-backdrop').forEach(el => {
        el.remove();
    });

    document.body.classList.remove('modal-open');

    document.body.style.removeProperty('padding-right');

    document.body.style.removeProperty('overflow');

});


// ======================================
// Pagination
// ======================================

function renderInvoicePagination(pagination) {

    const container = document.getElementById("paymentPagination");

    if (pagination.totalPages <= 1) {

        container.innerHTML = "";

        return;

    }

    container.innerHTML = `

        <div class="d-flex justify-content-center align-items-center gap-2 mt-3">

            <button
                type="button"
                class="btn btn-outline-secondary payment-pagenation-btn"
                data-page="${pagination.page - 1}"
                ${!pagination.hasPreviousPage ? "disabled" : ""}
            >
                السابق
            </button>

            <span class="fw-bold">
                صفحة ${pagination.page} من ${pagination.totalPages}
            </span>

            <button
                type="button"
                class="btn btn-outline-secondary payment-pagenation-btn"
                data-page="${pagination.page + 1}"
                ${!pagination.hasNextPage ? "disabled" : ""}
            >
                التالي
            </button>

        </div>

    `;

}


// الانتقال بين الصفحات
document.getElementById("paymentPagination").addEventListener("click", async function (e) {

    const button = e.target.closest(".payment-pagenation-btn");

    if (!button || button.disabled) return;

    const page = Number(button.dataset.page);

    if (page < 1 || page > totalPaymentPages) return;

    await loadCustomerDetails(page);

});


// ======================================
// Loader
// ======================================

function showLader(loader) {

    loader.classList.remove('d-none');

}

function hiddeLoader(loader) {

    loader.classList.add('d-none');

}
