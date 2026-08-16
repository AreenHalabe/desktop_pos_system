import { setActiveNavLink, showAuthExpired, bootboxSuccess, bootboxError, bootboxConfirm } from "../../../component/bootbox.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import {formatTimeOnly, formatDateOnly, utcToPalestine} from "../report/shared-functionality.js"

const header             = document.querySelector("site-header");
const modal  = document.getElementById('orderDetailsModal');
const overlayLoader = document.getElementById('overlay_loader');

let invoices = [];


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


modal.addEventListener('show.bs.modal', function (event) {
    const button = event.relatedTarget; // العنصر اللي كبست عليه
    const deptsId = Number(button.getAttribute('data-id')) ;
    const invoiceNum = Number(button.getAttribute('data-invoice-num'));

    // البحث عن الطلب
    const order = invoices.find(o => o.id === deptsId);
    
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


document.addEventListener('submit', function (e) {
  const form = e.target;

    if(form.classList.contains('delete-account-form')){
        const message = form.dataset.confirmMessage || 'هل أنت متأكد؟';
        bootboxConfirm(e, {
        message,
        onConfirm: deleteInvoice
        });
    } 
});


document.addEventListener("click", async function (e) {

    if (e.target.closest('.payment-page-btn')) {
        const supplierId = getSupplierId();

        window.location.href = `./payment.html?supplier_id=${supplierId}`;
    }
});


async function loadSupplierDepts(){
    const id = getSupplierId();
    try{
        const res = await fetch(url + `/supplier/invoices?supplier_id=${id}`, {
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
            invoices = data.invoices;
            renderDebtsTable(data.invoices);
        }
        else{
            bootboxError(data.message);
        }

    }catch(e){
        bootboxError(e.message);
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
        }
        else{
            bootboxError(data.message);
        }

    }catch(e){
        bootboxError(e.message);
    }
}


async function loadSupplierDetails() {
    await Promise.all([
        loadSupplierInfo(),
        loadSupplierDepts()
    ]);
}




async function deleteInvoice({id}){
    showLader(overlayLoader);
    try{
        const res = await fetch(url + `/invoice/delete?invoice_id=${id}` ,{
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
            await loadSupplierDetails();
            return;
        }
        else{
            bootboxError(data.message);
        }
    }catch(err){
        bootboxError(err.message);
    }finally{
        hiddeLoader(overlayLoader);
    }
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


function renderDebtsTable(debts) {
    const tbody = document.getElementById("debtsTableBody");
    if(!debts?.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لا يوجد فواتير شراء من هذا المورد</p>                
                </td>
            </tr>
        `;
        setSupplierStatus();
        return;
    }

    tbody.innerHTML = "";

    debts.forEach((debt, index) => {

        let status = "مسددة";
        let badgeClass = "bg-success";

        if(debt.remaining === debt.total_price) {
            status = "غير مدفوع";
            badgeClass = "bg-danger";
        } else if(debt.remaining < debt.total_price && debt.remaining !== 0) {
            status = "جزئي";
            badgeClass = "bg-warning";
        }

        const row = `
            <tr>
                <td>${index + 1}</td>
                <td class='nowrap-cell'>                    
                    <span class="amount-badge total-badge">
                        ${debt.total_price} ₪
                    </span>
                </td>

                <td class='nowrap-cell'>
                    <span class="amount-badge remaining-badge">
                        ${debt.remaining} ₪
                    </span>
                </td>

                <td class='nowrap-cell'>${formatDateOnly(utcToPalestine(debt.created_at))}</td>
                <td class='nowrap-cell'>${formatTimeOnly(utcToPalestine(debt.created_at))}</td>
                <td>
                    <span class="badge ${badgeClass}">
                        ${status}
                    </span>
                </td>
                <td class="text-center">
                    <div class='btn-group'>
                        <button class="view-btn"
                            data-bs-toggle="modal"
                            data-bs-target="#orderDetailsModal"
                            data-id="${debt.id}"
                            data-invoice-num="${index+1}"
                        >
                            <i class="fas fa-eye"></i>
                        </button>
                        <form
                            class="delete-account-form"
                            data-confirm-message='
                            هل أنت متأكد من حذف فاتورة رقم  <strong>${index+1}</strong>؟
                            <div class="danger-box">
                                سيتم حذفها نهائيا من النظام !
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

function setSupplierStatus(){
    const span = document.getElementById('customerStatus');
    span.className='badge bg-success';
    span.textContent = 'الحساب مسدد'
}
function setHeaderSummery(balance){
    document.getElementById('totalDepts').textContent=`${balance} ₪`;
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