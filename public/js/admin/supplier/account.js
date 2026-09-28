import { setActiveNavLink, showAuthExpired, bootboxSuccess, bootboxError, bootboxConfirm, showPrintLoader, hidePrintLoader } from "../../../component/bootbox.js";
import { url } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import {formatTimeOnly, formatDateOnly, utcToPalestine} from "../report/shared-functionality.js"
// import { handleInvoiceBeforPrint } from "../../../component/invoice_supplier.js";


const header             = document.querySelector("site-header");
const overlayLoader = document.getElementById('overlay_loader');

const modalElement = document.getElementById('orderDetailsModal');
const orderDetailsModal = bootstrap.Modal.getOrCreateInstance(modalElement);

let currentPaymentPage = 1;
let totalPaymentPages = 1;

let invoices = [];

let supplier;

let currentDisplayedInvoice;

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


modalElement.addEventListener('show.bs.modal', function (event) {
    const button = event.relatedTarget; // العنصر اللي كبست عليه
    const deptsId = Number(button.getAttribute('data-id')) ;
    const invoiceNum = Number(button.getAttribute('data-invoice-num'));

    // البحث عن الطلب
    const order = invoices.find(o => o.id === deptsId);


    order.date = formatDateOnly(utcToPalestine(order.created_at));
    order.time = formatTimeOnly(utcToPalestine(order.created_at));
    order.supplier = supplier.name;

    currentDisplayedInvoice = order;
    
    // البحث عن أصناف الطلب
    const orderItems = order.items;


    document.getElementById('invoiceNum').textContent = `${invoiceNum}` ;
    // بناء HTML الجدول
    let itemsHtml = '';
    orderItems.forEach(item => {
        

        itemsHtml += `
            <tr>
                <td>${item.name}</td>
                <td>${item.unit}</td>
                <td>${item.quantity}</td>
                <td>${Number(item.cost_price)} ₪</td>
                <td>${Number((Number(item.quantity) * Number(item.cost_price)).toFixed(2))} ₪</td>
            </tr>
        `;
    });

    itemsHtml += `
        <tr>
            <td colspan="4" class="text-end pe-3">
                <strong>المجموع</strong>
            </td>
            <td>
                <strong>${Number(order.total_price) + Number(order.discount)} ₪</strong>
            </td>
        </tr>

        <tr>
            <td colspan="4" class="text-end pe-3 text-danger">
                <strong>الخصم</strong>
            </td>
            <td class="text-danger">
                <strong>- ${order.discount} ₪</strong>
            </td>
        </tr>

        <tr class="table-success">
            <td colspan="4" class="text-end pe-3">
                <strong>الإجمالي</strong>
            </td>
            <td>
                <strong>${Number(order.total_price)} ₪</strong>
            </td>
        </tr>
    `;
    
    document.getElementById('modalItemsTable').innerHTML = itemsHtml;
});


modalElement.addEventListener('hidden.bs.modal', function () {

    // تنظيف أي backdrop عالق
    document.querySelectorAll('.modal-backdrop').forEach(el => {
        el.remove();
    });

    // تنظيف حالة الـ body
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
    document.body.style.removeProperty('overflow');

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

    else if (e.target.closest('.invoice-page-btn')) {
        const supplierId = getSupplierId();

        window.location.href = `./invoice.html?supplier_id=${supplierId}`;
    }

    // else if (e.target.closest('.printBtn')) {
    //     try{
    //         showPrintLoader();
    //         await handleInvoiceBeforPrint(currentDisplayedInvoice);
    //     }catch(e){
    //         bootboxError(e.message);
    //     }finally{
    //         hidePrintLoader();
    //     }
    // }

    else if (e.target.closest('.edit-inv-btn')) {
        const button = e.target.closest('.edit-inv-btn');
        const id = button.dataset.id;

        const supplierId = getSupplierId();

        window.location.href = `./edit-invoice.html?supplier_id=${supplierId}&invoice_id=${id}`;
    }

    else if (e.target.closest('.payment-pagenation-btn')) {

        const btn = e.target.closest('.payment-pagenation-btn');

        if (btn.disabled) return;

        const page = Number(btn.dataset.page);

        await loadSupplierDepts(page);
    }


});


async function loadSupplierDepts(page = 1){
    const id = getSupplierId();
    try{
        
        const res = await fetch(
            url + `/supplier/invoices?supplier_id=${id}&page=${page}`,
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
            invoices = data.invoices;
            currentPaymentPage = data.pagination.page;
            totalPaymentPages = data.pagination.totalPages;

            renderDebtsTable(data.invoices);

            renderInvoicePagination(data.pagination);
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
            supplier = data.supplier;
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
        loadSupplierDepts(1)
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
        let canEdit = false;
        if(Number(debt.remaining) === Number(debt.total_price)) {
            status = "غير مدفوع";
            badgeClass = "bg-danger";
            canEdit = true;
        } else if(Number(debt.remaining) < Number(debt.total_price) && Number(debt.remaining) !== 0) {
            status = "جزئي";
            badgeClass = "bg-warning";
        }

        const row = `
            <tr>
                <td>${index + 1}</td>
                <td class='nowrap-cell'>                    
                    <span class="amount-badge total-badge">
                        ${Number(debt.total_price)} ₪
                    </span>
                </td>

                <td class='nowrap-cell'>
                    <span class="amount-badge remaining-badge">
                        ${Number(debt.remaining)} ₪
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

                        ${
                            canEdit 
                                    ? `<button 
                                        type="button" 
                                        class="edit-inv-btn"
                                        data-id ="${debt.id}"
                                        title="تعديل"
                                        >
                                            <i class="fas fa-pen-to-square"></i>
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
                                    
    
                                    `
                            : ''
                        }
                        

                        
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
    document.getElementById('totalDepts').textContent=`${Number(balance)} ₪`;
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
                ${!pagination.hasPreviousPage ? "disabled" : ""}>
                السابق
            </button>

            <span class="fw-bold">
                صفحة ${pagination.page} من ${pagination.totalPages}
            </span>

            <button
                type="button"
                class="btn btn-outline-secondary payment-pagenation-btn"
                data-page="${pagination.page + 1}"
                ${!pagination.hasNextPage ? "disabled" : ""}>
                التالي
            </button>

        </div>
    `;
}
