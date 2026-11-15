import { setActiveNavLink, showAuthExpired, bootboxSuccess, bootboxError, bootboxConfirm} from "../../../component/bootbox.js";
import { url } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import {formatTimeOnly, formatDateOnly, utcToPalestine} from "../../admin/report/shared-functionality.js"

// import { printPaymentsFroSupplier } from "../../../component/invoice_supplier.js";

const header        = document.querySelector("site-header");
const loader        = document.getElementById('overlay_loader');




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
    await loadSupplierPayment();
});

document.addEventListener("click", async function (e) {

    if (e.target.closest('.invoice-page-btn')) {
        const supplierId = getSupplierId();
        window.location.href = `./account.html?customer_id=${supplierId}`;
    }

    else if (e.target.closest('.payment-page-btn')) {

        const btn = e.target.closest('.payment-page-btn');

        if (btn.disabled) return;

        const page = Number(btn.dataset.page);

        await loadSupplierPayment(page);
    }

});












document.addEventListener('submit', function (e) {
  const form = e.target;

    if(form.classList.contains('delete-paymet-form')){
        const message = form.dataset.confirmMessage || 'هل أنت متأكد؟';
        bootboxConfirm(e, {
        message,
        onConfirm: deletePaymet
        });
    } 
});


async function loadSupplierPayment(page = 1){
    const id = getSupplierId();
    try{
        const res = await fetch(
            url + `/customer/payment?customer_id=${id}&page=${page}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `${getAuthToken('user-auth')}`
                }
            }
        );


        const data = await res.json();
        if(res.status === 401){
            showAuthExpired(data.message);
            return;
        }
        else if(res.status === 200){
            renderPaymentTable(data.payments);
            renderPaymentPagination(data.pagination);
            
            setSupplierInfo(data.customer);

            setHeaderSummery(data.customer.balance);
            setSupplierStatus(data.customer.balance);
        }
        else{
            displayError(data.message);
        }

    }catch(e){
        console.log(e);
        displayError(e.message);
    }
}






async function deletePaymet({id}){
    loader.classList.remove('d-none');

    const supplierId = getSupplierId();
    try{
        const res = await fetch(url + `/payment/delete?pay_id=${id}&supplier_id=${supplierId}` ,{
            method: 'DELETE',
            headers: {
            "Authorization": `${getAuthToken('user-auth')}`
            }
        });
        const data = await res.json();

        if(res.status === 401){
            showAuthExpired(data.message);
            return ; 
        }
        else if(res.status === 200){
            showLoaderTable();

            
            return;
        }
        else{
            bootboxError(data.message);
        }
    }catch(err){
        bootboxError(err.message);
    }finally{
        loader.classList.add('d-none');
    }
}

function displayError(message){
    const errorCard    = document.getElementById(`error-card`);
    const errorMessage = document.getElementById(`error-message`);

    errorCard.classList.remove('d-none');
    errorMessage.textContent = message;
}

function getSupplierId(){
    const params        = new URLSearchParams(window.location.search);
    const supplierId    = params.get("supplier_id");

    return supplierId;
}


function renderPaymentTable(payments) {
    const tbody = document.getElementById("paymentsTableBody");
    if(!payments?.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لم يتم تسجيل أي دفعات لهذا العميل حتى الآن.</p>                
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";

    payments.forEach((payment, index) => {


        const row = `
            <tr>
                <td>${index + 1}</td>
                <td class='nowrap-cell'>                    
                    <span class="amount-badge total-badge">
                        ${Number(payment.amount)} ₪
                    </span>
                </td>

                <td class='nowrap-cell'>
                    
                    ${payment.note}

                </td>

                <td class='nowrap-cell'>${formatDateOnly(utcToPalestine(payment.created_at))}</td>
                <td class='nowrap-cell'>${formatTimeOnly(utcToPalestine(payment.created_at))}</td>

            </tr>
        `;
        tbody.innerHTML += row;
    });

}

function setSupplierStatus(balance){
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
function setHeaderSummery(balance){
    document.getElementById('totalDepts').textContent=`${Number(balance)} ₪`;
}
function setSupplierInfo(supplier){
    document.getElementById('customerName').textContent = `${supplier.name}`;
    document.getElementById('supplierPhone').textContent = `${supplier?.phone || '1024#'}`;
    document.getElementById('avatar').textContent = `${supplier.name.split(' ')[0]}`;
}


function showLoaderTable(){
    const tbody = document.getElementById("paymentsTableBody");
    tbody.innerHTML=`
        <tr id="loading-row">
            <td colspan="100%" class="text-center py-5">
                <div class="d-flex flex-column align-items-center gap-2">
                    <div class="spinner-border text-primary" role="status"></div>
                    <span class="text-muted">جاري التحميل ...</span>
                </div>
            </td>
        </tr>
    `
}









function renderPaymentPagination(pagination) {

    const container = document.getElementById("paymentPagination");

    if (pagination.totalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = `
        <div class="d-flex justify-content-center align-items-center gap-2 mt-3">

            <button
                type="button"
                class="btn btn-outline-secondary payment-page-btn"
                data-page="${pagination.page - 1}"
                ${!pagination.hasPreviousPage ? "disabled" : ""}>
                السابق
            </button>

            <span class="fw-bold">
                صفحة ${pagination.page} من ${pagination.totalPages}
            </span>

            <button
                type="button"
                class="btn btn-outline-secondary payment-page-btn"
                data-page="${pagination.page + 1}"
                ${!pagination.hasNextPage ? "disabled" : ""}>
                التالي
            </button>

        </div>
    `;
}

