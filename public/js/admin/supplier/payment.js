import { setActiveNavLink, showAuthExpired, bootboxSuccess, bootboxError, bootboxConfirm } from "../../../component/bootbox.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import {formatTimeOnly, formatDateOnly, utcToPalestine} from "../report/shared-functionality.js"

const header             = document.querySelector("site-header");
const modal  = document.getElementById('orderDetailsModal');
const overlayLoader = document.getElementById('overlay_loader');

let payment = [];


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
        loadSupplierInfo(),
        loadSupplierPayment()
    ]);
});

document.addEventListener("click", async function (e) {

    if (e.target.closest('.invoice-page-btn')) {
        const supplierId = getSupplierId();

        window.location.href = `./account.html?supplier_id=${supplierId}`;
    }
});


modal.addEventListener('show.bs.modal', function (event) {
    const button = event.relatedTarget; // العنصر اللي كبست عليه
    const deptsId = Number(button.getAttribute('data-id')) ;
    const invoiceNum = Number(button.getAttribute('data-invoice-num'));

    // البحث عن الطلب
    const order = payment.find(o => o.id === deptsId);
    
    // البحث عن أصناف الطلب
    const orderItems = order.items;


    document.getElementById('invoiceNum').textContent = `${invoiceNum}` ;
    // بناء HTML الجدول
    let itemsHtml = '';
    orderItems.forEach(item => {
        

        itemsHtml += `
            <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${item.cost_price} ₪</td>
                <td>${item.quantity * item.cost_price} ₪</td>
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
                <strong>- ${order.discount} ₪</strong>
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
    
    document.getElementById('modalItemsTable').innerHTML = itemsHtml;
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

        if(res.status === 401){
            showAuthExpired(data.message);
            return;
        }
        else if(res.status === 200){
            payment = data.payment;
            renderPaymentTable(data.payment);
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


function renderPaymentTable(debts) {
    const tbody = document.getElementById("debtsTableBody");
    if(!debts?.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لم يتم تسجيل أي دفعات لهذا المورد حتى الآن.</p>                
                </td>
            </tr>
        `;
        return;
    }

    let totalDepts = 0;
    tbody.innerHTML = "";

    debts.forEach((debt, index) => {
        totalDepts += debt.remaining_amount;


        const row = `
            <tr>
                <td>${index + 1}</td>
                <td class='nowrap-cell'>                    
                    <span class="amount-badge total-badge">
                        ${debt.total_price - debt.discount} ₪
                    </span>
                </td>

                <td class='nowrap-cell'>
                    <span class="amount-badge remaining-badge">
                        ${debt.payment_methode}
                    </span>
                </td>

                <td class='nowrap-cell'>${formatDateOnly(utcToPalestine(debt.created_at))}</td>
                <td class='nowrap-cell'>${formatTimeOnly(utcToPalestine(debt.created_at))}</td>

                <td class="text-center">
                    <div class='btn-group'>
                        <form
                            class="delete-account-form"
                            data-confirm-message='
                            هل أنت متأكد من حذف هذا الدين المستخق <strong>${debt.remaining_amount}</strong>؟
                            <div class="danger-box">
                                سيتم حذفه نهائيا من النظام !
                            </div>'
                        >
                            <button 
                                type="submit" 
                                class="delete-btn"
                                data-id="${debt.id}"
                                title="حذف"
                            >
                                <i class="fas fa-trash"></i>
                            </button>
                        </form>
                    </div>
                   
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