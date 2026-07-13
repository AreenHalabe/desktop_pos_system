import { setActiveNavLink, showAuthExpired, bootboxSuccess, bootboxError, showPrintLoader, hidePrintLoader} from "../../../component/bootbox.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";
import {getAuthToken , removeAuthToken} from "../../../component/auth.js";
import{ displayError, observer } from "../report/shared-functionality.js";
import { handelOrderDatabeforPrinting } from "../../../component/invoices.js";
import{ printCashSummery } from "../../../component/invoices.js";
import {  formatTimeOnly, formatDateOnly, utcToPalestine } from "../report/shared-functionality.js";



const header        = document.querySelector("site-header");
const showMoreBtn   = document.getElementById('showMoreBtn');


const confirmCloseCashBtn     = document.getElementById('confirmCloseCash');
const closeCashModal          = document.getElementById("closeCashModal");
const actualCash              = document.getElementById("actualCash");

const orderPaginationBtnContainer       = document.getElementById('orderPaginationBtn');
const transactionPaginationBtnContainer = document.getElementById('transactionPaginationBtn');


let timer;

let session;
let cashSummery={
    card_sales  : 0,
    cash_in      : 0,
    cash_out     : 0,
    cash_sales   : 0,
    expected_cash: 0,
    opening_cash : 0,
};

let completedOrdersCount = 0;
let deletedOrdersCount   = 0;
let completedOrders = [];
let deletedOrders   = [];
let DisplayedOrder  = [];
let transactions    = [];

let hasOpeningSession = false;

let currentPageT = 1 ;
let itemsPerPageT = 7 ;
let totalItemsT;
let totalPagesT;


let currentPage  ;
let itemsPerPage ;
let totalItems;
let totalPages;

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
    logoutFrom.addEventListener("submit" , async function(e) {
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

document.addEventListener('DOMContentLoaded', async function() {
    await loadSessionAnalytics();
});

document.querySelector('.dropdown-menu').addEventListener('click', (e) => {
    if(e.target.classList.contains('dropdown-item')) {
        const orderType = e.target.textContent;

        if(orderType == 'المكتملة'){
            setHeaderFilter(orderType, 'fas fa-check-circle');
            handlePagination(completedOrders);
        }
        else{
            setHeaderFilter(orderType, 'fas fa-times-circle');
            handlePagination(deletedOrders);
        }
        
    }
});


document.addEventListener("click", async function (e) {

    if(e.target.closest('.prevBtn')) {
        const parent = e.target.closest('.pagination-button');
        const type = parent.dataset.type;
        prevPage(type);
    }
    else if(e.target.closest('.nextBtn')) {
        const parent = e.target.closest('.pagination-button');
        const type = parent.dataset.type;
        nextPage(type);
    }
    else if(e.target.closest('.showMoreBtn')) {
        showMore();
    }
    else if(e.target.closest('.viewOrder')){
        const btn = e.target.closest(".viewOrder");
        const orderId = btn.dataset.id;
        viewOrder(Number(orderId));
    }
    else if(e.target.closest('.printBtn')){

        const btn = e.target.closest('.printBtn');

        const orderId = Number(btn.dataset.orderId);
        const order = DisplayedOrder.find(o => o.id === orderId);

        order.time = formatTimeOnly(utcToPalestine(order.created_at));
        order.date = formatDateOnly(utcToPalestine(order.created_at));
        try{
            handelOrderDatabeforPrinting(order);
        }catch(e){
            console.log(e)
        }
    }

    else if(e.target.closest('.new-session-btn')){
        bootboxOpenCash((cash) => { 
            openNewSession(cash)
        });
    }

    else if(e.target.closest('.close-cash-btn')){
        openCloseCashModal();
    }
    else if(e.target.closest('.confirm-close-cash-btn')){
        await closeCashSession();
    }
});

document.querySelectorAll(".reveal").forEach(el => {
  observer.observe(el);
});



actualCash.addEventListener("input", () => {

    const differenceValue = document.getElementById("differenceValue");
    const differenceIcon  = document.getElementById("differenceIcon");
    const spinner         = document.getElementById("differenceSpinner");
    const container       = document.getElementById("cashDifference");


    
    spinner.classList.remove("d-none");

    clearTimeout(timer);

    timer = setTimeout(() => {

        spinner.classList.add("d-none");
        const actual = actualCash.value === "" ? 0 : parseFloat(actualCash.value);
       

        const diff = actual - cashSummery.expected_cash;

        container.classList.remove("text-success","text-warning","text-danger");
        differenceIcon.className = "";

        if(actualCash.value === ""){
            clearCashDifferenceContaner();
            return;
        }

        if(diff === 0){
            container.classList.add("text-success");
            differenceIcon.className = "fas fa-check-circle";
            differenceValue.textContent = diff + " ₪";
        }
        else if(diff > 0){
            container.classList.add("text-warning");
            differenceIcon.className = "fas fa-exclamation-triangle";
            differenceValue.textContent = "+"+ diff + " ₪";
        }
        else if(diff < 0){
            container.classList.add("text-danger");
            differenceIcon.className = "fas fa-times-circle";
            differenceValue.textContent =  diff + " ₪";
        }
        confirmCloseCashBtn.disabled = false;

    }, 600); 
});

closeCashModal.addEventListener("hidden.bs.modal", () => {
    actualCash.value = ""; 
});



async function loadSessionAnalytics() {
    try{
        const res = await fetch(urlServer + '/daily/session-analytics' , {
            method: 'GET',
             headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
            credentials: 'include',
        });
        const data = await res.json();


        if(res.status === 401){
            showAuthExpired(data.message);
        }

        else if(res.status === 200){
            if(data.has_open_session){
                hasOpeningSession = data.has_open_session;
                cashSummery = data?.cash_summery ?? cashSummery;
                session   = data?.session ?? session;
                completedOrdersCount = data.orders.complete_orders.length;
                deletedOrdersCount   = data.orders.deleted_orders.length;

                completedOrders      = data.orders.complete_orders;
                deletedOrders        = data.orders.deleted_orders;
                transactions         = data.transactions;
                setHeaderFilter('المكتملة', 'fas fa-check-circle');
                handlePagination(completedOrders, true);
            }
            else{
                setEmptyState();
            }
        }
        else{
            displayError(data.message);
        }
        
    }catch(e){
       displayError(e.message);
    }
    finally{
        updateDashboardUI();
        setcashSummery();
    }
}

function setEmptyState(){
    const tableOrderbody       = document.getElementById('ordersTableBody');
    const tableTransactionBody = document.getElementById('transactions-table-body');

    tableOrderbody.innerHTML = `
        <tr>
            <td colspan="7" class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>لا يوجد صندوق مفتوح</p>
            </td>
        </tr>
    `;

    tableTransactionBody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>لا يوجد صندوق مفتوح</p>
            </td>
        </tr>
    `;

}


function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML='';
    if(DisplayedOrder.length === 0) {
        tbody.innerHTML = `
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
    const pageOrders = DisplayedOrder.slice(start, end);
    let html = '';

    

    pageOrders.forEach(order => {
        let badgeClass = '';
        if (order.status === 'مكتمل') badgeClass = 'badge-completed';
        else if (order.status === 'ملغي') badgeClass = 'badge-cancelled';
        else badgeClass = 'badge-cancelled';

        const paymentClass = order.payment_method === 'كاش' ? 'status-completed' :
            order.payment_method === 'بطاقة' ? 'bg-info text-white' : 'status-pending';
        
        html += `
            <tr>
                <td>${order.invoice_num}</td>
                <td><span class='status-badge ${paymentClass}'>  ${order.payment_method}</span></td>
                <td class='nowrap-cell'>${formatDateOnly(order.created_at)}</td>
                <td class='nowrap-cell'>${formatTimeOnly(utcToPalestine(order.created_at))}</td>
                <td class='nowrap-cell'>${order.total_price} ₪</td>
                <td><span class="badge ${badgeClass}">${order.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-light viewOrder" data-id="${order.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    
    updatePagination(orderPaginationBtnContainer);
}



function renderTransactionsTable(){
    const tableBody = document.getElementById('transactions-table-body');

    if (transactions.length === 0) {
        tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>لا يوجد معاملات مالية</p>
            </td>
        </tr>
        `;
        hiddePaginationBtn(transactionPaginationBtnContainer);
        return;
    }

    const start = (currentPageT - 1) * itemsPerPageT;
    const end = start + itemsPerPageT;
    const pageTransactions = transactions.slice(start, end);

    tableBody.innerHTML='';

    let counter = (currentPageT * 10) - (10);
    tableBody.innerHTML = pageTransactions.map(t => {
        const isAdd = t.type === "إضافة";
        return `
        <tr>

            <td>${(++counter).toString().padStart(3, '0')}</td>
        
            <td class="nowrap-cell">${formatDateOnly(utcToPalestine(t.created_at))}</td>
            <td class="nowrap-cell">${formatTimeOnly(utcToPalestine(t.created_at))}</td>

            <td>
            <span class="badge ${isAdd ? 'status-add' : 'status-withdraw'}">
                ${t.type}
            </span>
            </td>


            <td class="fw-bold ${isAdd ? 'text-success' : 'text-danger'} nowrap-cell">
            ${isAdd ? '+' : '-'} ${t.amount.toLocaleString()} ₪
            </td>

            
            <td>${t.note}</td>
        </tr>
        `;
    }).join('');

    displayPaginationBtn(transactionPaginationBtnContainer);
    updatePagination(transactionPaginationBtnContainer, true);
}

function prevPage(type) {
    if(type === 'orders'){
        if (currentPage > 1) {
            currentPage--;
            renderOrdersTable();
        }
    }
    else{
        if (currentPageT > 1) {
            currentPageT--;
            renderTransactionsTable();
        }
    }
    
}
function nextPage(type) {
    if(type === 'orders'){
        if (currentPage < totalPages) {
            currentPage++;
            renderOrdersTable();
        }
    }
    else{
        if (currentPageT < totalPagesT) {
            currentPageT++;
            renderTransactionsTable();
        }
    }
    
}
function updatePagination(parentContainer, isForTransactions = false) {
    const pageInfo = parentContainer.querySelector('.pageInfo');
    const prevBtn = parentContainer.querySelector('.prevBtn');
    const nextBtn = parentContainer.querySelector('.nextBtn');

    if(isForTransactions){
        pageInfo.textContent = `صفحة ${currentPageT} من ${totalPagesT}`;
        prevBtn.disabled = currentPageT === 1;
        nextBtn.disabled = currentPageT === totalPagesT;
    }
    else{
        pageInfo.textContent = `صفحة ${currentPage} من ${totalPages}`;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
    }
}




function showMore() {
    const isExpanded = showMoreBtn.classList.toggle('expanded'); // toggle state

    if (isExpanded) {
        itemsPerPage = 10;
        showMoreBtn.innerHTML = '<i class="fas fa-arrow-up ms-1"></i> عرض أقل';
        if(totalItems > itemsPerPage){
            displayPaginationBtn(orderPaginationBtnContainer);
        }
    } else {
        itemsPerPage = 5;
        showMoreBtn.innerHTML = '<i class="fas fa-arrow-down ms-1"></i> عرض المزيد';
        currentPage = 1;
        hiddePaginationBtn(orderPaginationBtnContainer);
    }

    // إعادة حساب عدد الصفحات
    totalPages = Math.ceil(totalItems / itemsPerPage);

    // إذا كانت الصفحة الحالية أكبر من إجمالي الصفحات
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    // إعادة عرض الجدول
    renderOrdersTable();
}
function restShowMoreBtn(){
    showMoreBtn.innerHTML = '<i class="fas fa-arrow-down ms-1"></i> عرض المزيد';
    hiddePaginationBtn(orderPaginationBtnContainer);
}


function displayPaginationBtn(parent){
    parent.classList.remove('hidde');  
}
function hiddePaginationBtn(parent){
    parent.classList.add('hidde');
}


function hiddeShowMoreBtn(){
    if(!showMoreBtn.classList.contains('hidde')){
        showMoreBtn.classList.add('hidde');
    }
}
function displayShowMoreBtn(){
    if(showMoreBtn.classList.contains('hidde')){
        showMoreBtn.classList.remove('hidde');
    }
}

function displayCanselResonAndTimeUpdated(){
    const timeUpdated = document.getElementById('modalUpdated').parentElement;;
    const cancelReson = document.getElementById('modalCancelReason').parentElement;;
    if(cancelReson.classList.contains('hidden')){
        cancelReson.classList.remove('hidden');
        timeUpdated.classList.remove('hidden');
    }
}
function hiddeCanselResonAndTimeUpdated(){
    const timeUpdated = document.getElementById('modalUpdated').parentElement;
    const cancelReson = document.getElementById('modalCancelReason').parentElement;

    if(!cancelReson.classList.contains('hidden')){
        cancelReson.classList.add('hidden');
        timeUpdated.classList.add('hidden');
    }
}

function viewOrder(orderId) {
    // البحث عن الطلب
    const order = DisplayedOrder.find(o => o.id === orderId);
    
    
    // البحث عن أصناف الطلب
    const orderItems = order.items ;
    
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
    document.getElementById('modalOrderType').textContent = order.type ;
    document.getElementById('modalItemsTable').innerHTML = itemsHtml;
    // تخزين id داخل زر الطباعة
    document.querySelector('.printBtn').dataset.orderId = orderId;

    if(order.cancel_reason != null){
        displayCanselResonAndTimeUpdated();
        document.getElementById('modalUpdated').textContent = formatTimeOnly(order.updated_at) ;
        document.getElementById('modalCancelReason').textContent = order.cancel_reason ;
    }
    else{
        hiddeCanselResonAndTimeUpdated();
    }
    
    
    // إظهار المودل
    const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
    modal.show();
}


function handlePagination(orders = [], isFirstLoad = false){
    itemsPerPage   = 5;
    currentPage    = 1;

    DisplayedOrder = orders;
    totalItems     = DisplayedOrder.length;
    totalPages     = Math.ceil(totalItems / itemsPerPage);
    
    if(DisplayedOrder.length > 5){
        restShowMoreBtn();
        displayShowMoreBtn();
    }
    else{
        hiddeShowMoreBtn();
    }


    totalItemsT = transactions.length;
    totalPagesT = Math.ceil(totalItemsT / itemsPerPageT);
    if(isFirstLoad){
        renderTransactionsTable();
    }

    renderOrdersTable();
    
}





function setHeaderFilter(orderType, iconClass){
    const headerFilterType = document.getElementById('headerFilterType');

    const badge = document.getElementById('typeBadge');
    const text = document.getElementById('typeText');
    const icon = document.getElementById('typeIcon');

    text.textContent= orderType;
    icon.className  = iconClass;

    if(orderType == 'المحذوفة'){
        badge.classList.remove('status-add' , 'text-success');
        badge.classList.add('status-withdraw' , 'text-danger');
    }else{
        badge.classList.remove('status-withdraw' , 'text-danger');
        badge.classList.add('status-add', 'text-success');
    }

    headerFilterType.classList.remove('d-none');
}




function formatHourTo12(hourString) {
    let start = parseInt(hourString, 10);
    let end = (start + 1) % 24;

    let start12 = start % 12 || 12;
    let end12 = end % 12 || 12;
    let period = end >= 12 ? "PM" : "AM";

    return `${start12}-${end12} ${period}`;
}


function formateOrdersAndSalesByHour(){
    const hours  = ordersAndSalesByHour.map(item => formatHourTo12(item.hour));
    const orders = ordersAndSalesByHour.map(item => item.orders_count);
    const sales  = ordersAndSalesByHour.map(item => item.sales);

    return {hours, orders, sales};
}


function setcashSummery(){
    document.getElementById('totalOrder').textContent = `${completedOrdersCount + deletedOrdersCount}`;
    document.getElementById('completedOrder').innerHTML= `<i class="fas fa-check-circle"></i> ${completedOrdersCount} مكتملة`;
    document.getElementById('deletedOrder').innerHTML  = `<i class="fas fa-times-circle"></i> ${deletedOrdersCount} ملغية`;

    document.getElementById('completedCount').textContent = `طلبات مكتملة ${completedOrdersCount}`
    document.getElementById('deletedCount').textContent = `طلبات محذوفة ${deletedOrdersCount}`

    document.getElementById('totalSales').textContent = `${cashSummery.cash_sales + cashSummery.card_sales} ₪`;
    document.getElementById('cashSales').innerHTML    = `<i class="fas fa-money-bill-wave"></i> ${cashSummery?.cash_sales || 0} ₪ كاش`;
    document.getElementById('cardSales').innerHTML    = `<i class="fas fa-credit-card"></i> ${cashSummery?.card_sales ||0} ₪ بطاقة`;

    document.getElementById('averageDemand').textContent = completedOrdersCount === 0 ? '0 ₪' 
                                                        : `${((cashSummery.cash_sales + cashSummery.card_sales) / completedOrdersCount).toFixed(2)} ₪` ;

    document.getElementById('averageDemandNote').innerHTML =`<i class="fas fa-receipt"></i> متوسط قيمة الفاتورة`;

    document.getElementById('openingCash').innerHTML     =`<i class="fas fa-door-open"></i> افتتاحي ${cashSummery.opening_cash} ₪`;
    document.getElementById('expectedCash').innerHTML    =`<i class="fas fa-coins"></i> الرصيد ${cashSummery.expected_cash} ₪`;
    document.getElementById('cashOut').innerHTML         =`<i class="fas fa-minus-circle"></i> سحب ${cashSummery?.cash_out || 0} ₪`;
    document.getElementById('cashIn').innerHTML          =`<i class="fas fa-plus-circle"></i> إضافة ${cashSummery?.cash_in || 0} ₪`;

    document.getElementById('trCashAdd').textContent = `إضافة ${cashSummery?.cash_in || 0} ₪`;
    document.getElementById('trCashOut').textContent = `مصروفات ${cashSummery?.cash_out || 0} ₪`;
}
function updateDashboardUI(){
    if(hasOpeningSession){
       setCloseCashBtnState();
    }
    else{
       setOpenCashBtnState();
    }
}


function setCloseCashBtnState(){
     document.getElementById('sessionHeader').innerHTML = `
        <div class="d-flex align-items-center">
            <span class="badge bg-success">الصندوق مفتوح</span>
        </div>
        
        <button class="btn btn-danger d-flex align-items-center justify-content-center gap-2 close-cash-btn" id="closeCashBtn">
            <i class="bi bi-lock-fill"></i> إغلاق الصندوق
        </button>
     `
}
function setOpenCashBtnState(){
    document.getElementById('sessionHeader').innerHTML = `
        <div class="d-flex align-items-center">
            <span class="badge bg-danger">لا يوجد صندوق مفتوح</span>
        </div>
        
        <button class="btn btn-primary d-flex align-items-center justify-content-center gap-2 new-session-btn">
            <i class="bi bi-cash-stack"></i>
            فتح الصندوق
        </button>
     `
}


function bootboxOpenCash(onConfirm = null) {

  const dialog = bootbox.dialog({
    title: `
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-cash-stack text-success"></i>
        <span class="fw-bold">فتح يوم محاسبي</span>
      </div>
    `,
    message: `
      <div class="text-center">
        <p class="mb-2 text-muted">أدخل الكاش الحالي</p>
        <input 
          type="number"
          class="form-control opening-cash-input"
          placeholder="0"
          min="0"
          step="0.01"
        >
      </div>
    `,
    centerVertical: true,
    closeButton: false,
    buttons: {
      cancel: {
        label: "إلغاء",
        className: "btn-secondary"
      },
      confirm: {
        label: "حفظ",
        className: "btn-success",
        callback() {

          const cash = parseFloat(
            dialog.find(".opening-cash-input").val()
          );
          if (typeof onConfirm === "function") {
            onConfirm(cash);
          }
        }
      }
    }
  });

  dialog.init(function () {

    const input = dialog.find(".opening-cash-input");
    const confirmBtn = dialog.find(".btn-success");

    // الزر معطل بالبداية
    confirmBtn.prop("disabled", true);

    input.on("input", function () {

      const value = this.value.trim();

      if (value === "" || Number(value) < 0) {
        confirmBtn.prop("disabled", true);
      } else {
        confirmBtn.prop("disabled", false);
      }

    });

    input.focus();
  });
}




async function openNewSession(openingCash){
    try{
        const res = await fetch(urlServer + '/open/cash-session' , {
             method: 'POST',
             headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
            body: JSON.stringify({
                opening_cash : openingCash
            }),
        });
        const data = await res.json();
        if(res.status === 401){
            showAuthExpired(data.message);
        }
        else if(res.status === 200){

            bootboxSuccess(
                `تم فتح صندوق اليوم بقيمة ${openingCash} ₪`,
                null,
                false,
                 () => {
                    window.location.reload();
                }
            );
        }
        else{
            bootboxError(data.message);
        }
    }catch(err){
        bootboxError(err.message);
    }
}
async function closeCashSession() {
    try{
        const res = await fetch(urlServer + `/close/cash-session?session_id=${session.id}` , {
             method: 'PUT',
             headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
            body: JSON.stringify({
                actual_cash : actualCash.value
            }),
        });
        const data = await res.json();

        if(res.status === 401){
            showAuthExpired(data.message);
            return;
        }
        else if(res.status === 200){
            cashSummery.actual_cash = actualCash.value;
            cashSummery.open_at = session.open_at;
            bootboxSuccess(
                data.message,
                async () => {
                    showPrintLoader();              // يبدأ اللودر
                    await  printCashSummery(cashSummery); // انتظار الطباعة
                    hidePrintLoader();             // ينتهي بعد الطباعة
                },
                true,
                () => {
                    window.location.reload();
                }
            )
        }
        else{
            bootboxError(data.message);
        }
        
    }catch(err){
        bootboxError(err.message);
    }
}


function openCloseCashModal(){
    document.getElementById('expectedCashModal').textContent = `${cashSummery.expected_cash} ₪` ;
    document.getElementById('openingCashModal').textContent  = `${cashSummery.opening_cash} ₪`;
    document.getElementById('cashSalesModal').textContent    = `${cashSummery?.cash_sales || 0} ₪`;
    document.getElementById('cardSalesModal').textContent    = `${cashSummery?.card_sales || 0} ₪`;
    document.getElementById('cashOutModal').textContent      = `- ${cashSummery?.cash_out || 0} ₪`;
    document.getElementById('cashInModal').textContent       = `+ ${cashSummery?.cash_in || 0} ₪`;
    
    clearCashDifferenceContaner();

    confirmCloseCashBtn.disabled = true;

    const modal = new bootstrap.Modal(closeCashModal);
    modal.show();

}
function clearCashDifferenceContaner(){
    const container  = document.getElementById("cashDifference");
    container.classList.remove('text-success');
    container.classList.remove('text-warning');
    container.classList.remove('text-danger');

    container.innerHTML = '';
    container.innerHTML +=`
        <span id="differenceValue">0 ₪</span>

        <div id="differenceSpinner" class="spinner-border spinner-border-sm text-secondary d-none"></div>

        <i id="differenceIcon"></i>
    `
    confirmCloseCashBtn.disabled = true;
}


