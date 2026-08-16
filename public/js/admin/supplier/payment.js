import { setActiveNavLink, showAuthExpired, bootboxSuccess, bootboxError, bootboxConfirm } from "../../../component/bootbox.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import {formatTimeOnly, formatDateOnly, utcToPalestine} from "../report/shared-functionality.js"

const header        = document.querySelector("site-header");
const overlayLoader = document.getElementById('overlay_loader');
const paymentForm   = document.getElementById('paymentForm');
const paymentModal  = document.getElementById('paymentModal');
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
    await loadSupplierDetails();
});

document.addEventListener("click", async function (e) {

    if (e.target.closest('.invoice-page-btn')) {
        const supplierId = getSupplierId();

        window.location.href = `./account.html?supplier_id=${supplierId}`;
    }
});



paymentModal.addEventListener("hidden.bs.modal", () => {
    paymentForm.reset();
    clearErrors(paymentModal);
});



paymentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    loader.classList.remove('d-none');

    clearErrors(paymentModal);

    let formData      = new FormData(paymentForm);

    const paymentData = {
        amount: formData.get("amount"),
        payment_methode : formData.get('paymentMethode')
    }



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




async function loadSupplierPayment(){
    const id = getSupplierId();
    try{
        const res = await fetch(url + `/supplier/payment?supplier_id=${id}`, {
            method: "GET",
            headers: {
                "Authorization": `${getAuthToken('auth')}`
            }
        });
        const data = await res.json();
        console.log(data);
        if(res.status === 401){
            showAuthExpired(data.message);
            return;
        }
        else if(res.status === 200){
         
            renderPaymentTable(data.payments);
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
            const supplier = data.supplier;
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
        loadSupplierPayment()
    ]);
}


function displayError(message){
    const errorCard    = document.getElementById(`error-card`);
    const errorMessage = document.getElementById(`error-message`);

    errorCard.classList.remove('d-none');
    errorMessage.textContent = message;
}
function hiddeError(){
    const errorCard    = document.getElementById(`error-card`);
    const errorMessage = document.getElementById(`error-message`);

    errorCard.classList.add('d-none');
    errorMessage.textContent = '';
}

function getSupplierId(){
    const params        = new URLSearchParams(window.location.search);
    const supplierId    = params.get("supplier_id");

    return supplierId;
}

function getSupplierName(){
    const params = new URLSearchParams(window.location.search);
    const name = params.get("customer_name");
    return name;
}


function renderPaymentTable(payments) {
    const tbody = document.getElementById("paymentsTableBody");
    if(!payments?.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
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
                        ${payment.amount} ₪
                    </span>
                </td>

                <td class='nowrap-cell'>
                    <span class="amount-badge remaining-badge">
                        ${payment.payment_methode}
                    </span>
                </td>

                <td class='nowrap-cell'>${formatDateOnly(utcToPalestine(payment.created_at))}</td>
                <td class='nowrap-cell'>${formatTimeOnly(utcToPalestine(payment.created_at))}</td>
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
    document.getElementById('totalDepts').textContent=`${balance} ₪`;
    document.getElementById('balanceInModal').textContent = `${balance} ₪`;
}
function setSupplierInfo(supplier){
    document.getElementById('customerName').textContent = `${supplier.name}`;
    document.getElementById('supplierPhone').textContent = `${supplier?.phone || '1024#'}`;
    document.getElementById('avatar').textContent = `${supplier.name.split(' ')[0]}`;
}



function showLader(loader){
    loader.classList.remove('d-none');
}
function hiddeLoader(loader){
    loader.classList.add('d-none');
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