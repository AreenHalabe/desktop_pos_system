import { setActiveNavLink, showAuthExpired, bootboxSuccess, bootboxError, bootboxConfirm} from "../../../component/bootbox.js";
import { url } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import {formatTimeOnly, formatDateOnly, utcToPalestine} from "../report/shared-functionality.js"

// import { printPaymentsFroSupplier } from "../../../component/invoice_supplier.js";

const header        = document.querySelector("site-header");
const paymentForm   = document.getElementById('paymentForm');
const paymentModal  = document.getElementById('paymentModal');
const loader        = document.getElementById('overlay_loader');



const currencySelect = document.getElementById("currency");
const foreignCurrencyFields = document.getElementById("foreignCurrencyFields");

const checkAmount = document.getElementById("checkAmount");
const exchangeRate = document.getElementById("exchangeRate");

const paymentDiv = document.getElementById("paymentDiv");
const paymentAmount = document.getElementById("paymentAmount");



const paymentMethod = document.getElementById("paymentMethod");
const checkFields = document.getElementById("checkFields");

let payments ;
let supplier ;

let currentPaymentPage = 1;
let totalPaymentPages = 1;

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
    await loadSupplierDetails();
});

document.addEventListener("click", async function (e) {

    if (e.target.closest('.invoice-page-btn')) {
        const supplierId = getSupplierId();

        window.location.href = `./account.html?supplier_id=${supplierId}`;
    }

    // else if(e.target.closest('.print-invoice-btn')){
    //     if(payments.length == 0) return;
    //     loader.classList.remove('d-none');

    //     payments.forEach(payment => {
    //         payment.date = formatDateOnly(utcToPalestine(payment.created_at));
    //         payment.time = formatTimeOnly(utcToPalestine(payment.created_at));
    //     });


    //     const data = {
    //         supplier : supplier.name,
    //         payments : payments
    //     }

    
    //     try{
    //         await printPaymentsFroSupplier(data);
    //     }catch(e){
    //         bootboxError(e.message);
    //     }finally{
    //          loader.classList.add('d-none');
    //     }


    // }

    else if (e.target.closest('.payment-page-btn')) {

        const btn = e.target.closest('.payment-page-btn');

        if (btn.disabled) return;

        const page = Number(btn.dataset.page);

        await loadSupplierPayment(page);
    }

});




paymentModal.addEventListener("hidden.bs.modal", () => {

    // إعادة جميع قيم الفورم للوضع الافتراضي
    paymentForm.reset();

    // إخفاء بيانات الشيك
    checkFields.classList.add("d-none");

    // إخفاء حقول العملة الأجنبية
    foreignCurrencyFields.classList.add("d-none");

    // إظهار قيمة الدفع الأساسية
    paymentDiv.classList.remove("d-none");

    // إعادة required للحالة الافتراضية
    paymentAmount.required = true;

    document.getElementById("checkAccountName").required = false;
    document.getElementById("checkNumber").required = false;
    document.getElementById("bankName").required = false;
    document.getElementById("dueDate").required = false;

    currencySelect.required = false;

    checkAmount.required = false;
    exchangeRate.required = false;

    // تنظيف قيم الحقول الأجنبية احتياطياً
    checkAmount.value = "";
    exchangeRate.value = "";

    // تنظيف قيمة الدفع المحسوبة
    paymentAmount.value = "";

    // إخفاء الأخطاء
    clearErrors(paymentModal);
});


currencySelect.addEventListener("change", function () {

    if (this.value !== "ILS") {

        foreignCurrencyFields.classList.remove("d-none");
        paymentDiv.classList.add("d-none");

        checkAmount.value = "";
        exchangeRate.value = "";

    } else {

        foreignCurrencyFields.classList.add("d-none");
        paymentDiv.classList.remove("d-none");

        checkAmount.value = "";
        exchangeRate.value = "";
        paymentAmount.value = "";
    }

    updatePaymentRequirements();
});

paymentMethod.addEventListener("change", function () {

    if (this.value === "شيك") {

        checkFields.classList.remove("d-none");

    } else {

        checkFields.classList.add("d-none");
        
        foreignCurrencyFields.classList.add("d-none");
        paymentDiv.classList.remove("d-none");

        // مسح بيانات الشيك
        document.querySelectorAll("#checkFields input, #checkFields select, #checkFields textarea")
            .forEach(input => {
                input.value = "";
            });
    }
    paymentAmount.value = "";
    updatePaymentRequirements();
});


paymentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    loader.classList.remove('d-none');

    clearErrors(paymentModal);
      

    const isCheck = paymentMethod.value === "شيك";
    const isForeignCurrency =
        isCheck && currencySelect.value !== "ILS";

    if (isForeignCurrency) {

        const checkValue = Number(checkAmount.value);
        const rate = Number(exchangeRate.value);

        paymentAmount.value = (checkValue * rate).toFixed(2);
    }


    const formData = new FormData(paymentForm);

    const paymentData = Object.fromEntries(formData.entries());

    try{
        let res = await fetch(url + `/invoice/payment?supplier_id=${getSupplierId()}`, {
            method: "POST",
            body: JSON.stringify(paymentData),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });
        let data = await res.json();

        if(res.status === 200){
            bootboxSuccess(data.message);
            const modal = bootstrap.Modal.getOrCreateInstance(paymentModal);
            modal.hide();
            showLoaderTable();
            await loadSupplierDetails();
            return;
        }

        else if(res.status === 401){
            showAuthExpired(data.message);
            return;
        }

        else{
            showErrors(paymentModal , data.message);
            return;
        }
    }catch(err){
        showErrors(paymentModal , err.message);
    }finally{
        loader.classList.add('d-none');
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
            url + `/supplier/payment?supplier_id=${id}&page=${page}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `${getAuthToken('auth')}`
                }
            }
        );


        const data = await res.json();
        if(res.status === 401){
            showAuthExpired(data.message);
            return;
        }
        else if(res.status === 200){
            currentPaymentPage = data.pagination.page;
            totalPaymentPages = data.pagination.totalPages;


            payments = data.payments;
            renderPaymentTable(data.payments);

            renderPaymentPagination(data.pagination);

        }
        else{
            displayError(data.message);
        }

    }catch(e){
        displayError(e.message);
    }
}

async function loadSupplierInfo() {
    const id = getSupplierId();
    try{
        const res = await fetch(url + `/supplier/get?supplier_id=${id}`, {
            method: "GET",
            headers: {
                "Authorization": `${getAuthToken('auth')}`
            }
        });
        const data = await res.json();

        if(res.status === 401){
            showAuthExpired(data.message);
            return;
        }
        else if(res.status === 200){
            supplier = data.supplier;
            setSupplierInfo(supplier);
            setHeaderSummery(supplier.balance);
            setSupplierStatus(supplier.balance);
        }
        else{
            displayError(data.message);
        }

    }catch(e){
        displayError(e.message);
    }
}

async function loadSupplierDetails() {
    await Promise.all([
        loadSupplierInfo(),
        loadSupplierPayment(1)
    ]);
}


async function deletePaymet({id}){
    loader.classList.remove('d-none');

    const supplierId = getSupplierId();
    try{
        const res = await fetch(url + `/payment/delete?pay_id=${id}&supplier_id=${supplierId}` ,{
            method: 'DELETE',
            headers: {
            "Authorization": `${getAuthToken('auth')}`
            }
        });
        const data = await res.json();

        if(res.status === 401){
            showAuthExpired(data.message);
            return ; 
        }
        else if(res.status === 200){
            showLoaderTable();

            await loadSupplierDetails();
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
                    <p>لم يتم تسجيل أي دفعات لهذا المورد حتى الآن.</p>                
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
                    <span class="amount-badge remaining-badge">
                        ${payment.payment_methode}
                    </span>
                </td>

                <td class='nowrap-cell'>${formatDateOnly(utcToPalestine(payment.created_at))}</td>
                <td class='nowrap-cell'>${formatTimeOnly(utcToPalestine(payment.created_at))}</td>

                <td>
                    <form
                        class="delete-paymet-form"
                        data-confirm-message='
                            هل أنت متأكد من حذف دُفعة رقم <strong>${index + 1}</strong> 
                            بقيمة <strong class="text-primary">${Number(payment.amount)} ₪</strong>؟
                            <div class="danger-box">
                                سيتم حذفها نهائيا من النظام !
                            </div>'
                    >
                        <button 
                            type="submit" 
                            class="delete-btn"
                            data-id="${payment.id}"
                            title="حذف"
                        >
                            <i class="fas fa-trash"></i>
                        </button>
                    </form>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });

}

function setSupplierStatus(balance){
    if(balance > 0){
        document.getElementById('paymentBtn').classList.remove('d-none');
    }else{
        document.getElementById('customerStatus').classList.remove('d-none');
    }
}
function setHeaderSummery(balance){
    document.getElementById('totalDepts').textContent=`${Number(balance)} ₪`;
    document.getElementById('balanceInModal').textContent = `${Number(balance)} ₪`;
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


function showErrors(modalElement, message) {
  const errorList = modalElement.querySelector("#error_list");
  const errorMessage = modalElement.querySelector("#errors");
  // تفريغ الأخطاء القديمة
  errorMessage.innerHTML = "";
  errorMessage.innerHTML = `<li>${message}</li>`
  errorList.style.display = "block";
}

function clearErrors(modalElement) {
  const errorList = modalElement.querySelector("#error_list");
  const errorMessage = modalElement.querySelector("#errors");
  errorMessage.innerHTML = "";
  errorList.style.display = "none";
}





function updatePaymentRequirements() {

    const isCheck = paymentMethod.value === "شيك";

    const isForeignCurrency =
        isCheck &&
        currencySelect.value &&
        currencySelect.value !== "ILS";

    // قيمة الدفع
    paymentAmount.required = !isForeignCurrency;

    // بيانات الشيك
    document.getElementById("checkAccountName").required = isCheck;
    document.getElementById("checkNumber").required = isCheck;
    document.getElementById("bankName").required = isCheck;
    document.getElementById("dueDate").required = isCheck;
    currencySelect.required = isCheck;

    // العملة الأجنبية
    checkAmount.required = isForeignCurrency;
    exchangeRate.required = isForeignCurrency;
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

