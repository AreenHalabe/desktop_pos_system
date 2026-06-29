import { showAuthExpired, setActiveNavLink, bootboxError, showPrintLoader, hidePrintLoader} from "../../../component/bootbox.js";
import{ displayLoader, hiddeLoader, hiddeError, displayError, validateDateRange, observer, displayContainer, hiddeContainer, formatHour, formatDateTimeForServer, formatTimeOnly, formatDateOnly, toUTC, utcToPalestine } from "./shared-functionality.js";


import { url, urlServer } from "../../../api/urlEndPoint.js";
import {getAuthToken, removeAuthToken} from "../../../component/auth.js";

import { printCashSummery } from "../../../component/invoices.js";
const startDate = document.getElementById('startDate');
const endDate   = document.getElementById('endDate');
const serchBtn  = document.getElementById('searchBtn');

const header                  = document.querySelector("site-header");

const headerSummeryCard       = document.getElementById('headerSummeryCard');
const summeryRevenue          = document.getElementById('summeryRevenue');
const cashSessionsCard        = document.getElementById('cashSessionsCard');
const transactionTableCard    = document.getElementById('transactionTableCard');
const modal                   = document.getElementById('cashBoxModal');
const differanceStatus        = document.getElementById('differanceStatus');


const sessionPaginationBtnContainer     = document.getElementById('sessionPaginationBtn');
const transactionPaginationBtnContainer = document.getElementById('transactionPaginationBtn');



let sessions;

let sessionsIds = [];
let completedOrdersCount = 0;
let deletedOrdersCount   = 0;
let revenueCash          = 0;
let revenueCard          = 0;
let cashAdditions        = 0;
let cashExpenses        = 0;
let printSession;

let allTransactions       = [];
let expensesTransactions  = [];
let additionsTransactions = [];
let currentDisplayedTransactions = [];


let currentPage ;
let itemsPerPage = 10;
let totalItems;
let totalPages;

let currentPageSessions ;
let itemsPerPageSessions = 9;
let totalItemsSessions;
let totalPagesSessions;
let cashSessionBoxes = [];


startDate.addEventListener('input', checkInputs);
endDate.addEventListener('input', checkInputs);


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



modal.addEventListener('show.bs.modal', function (event) {
  const button = event.relatedTarget; // العنصر اللي كبست عليه
  const boxId = Number(button.getAttribute('data-box-id')) ;


  // جيب بيانات الصندوق
  const session = sessions.find(s => s.session_id == boxId);

  if (!session) return;

  printSession = session;

    document.getElementById('openAt').innerHTML=`<i class="fas fa-clock ms-1"></i>
        ${utcToPalestine(session.open_at).split(' ')[0]}
        ${formatHour(utcToPalestine(session.open_at).split(' ')[1], true)}
    `

    const closedEl = document.getElementById('closedAt');

    if (!session.closed_at) {
        closedEl.innerHTML = `
            <i class="fas fa-lock-open text-success ms-1"></i>
            <span class="text-success">مفتوح</span>
        `;
        } else {
        const [date, time] = utcToPalestine(session.closed_at).split(' ');
        closedEl.innerHTML = `
            <i class="fas fa-lock ms-1"></i>
            ${date} 
            ${formatHour(time, true)}
        `;
    }
    document.getElementById('openingCash').textContent      = `${session.opening_cash} ₪`;
    document.getElementById('cashSalesSession').textContent = `${session.cash_sales} ₪`;
    document.getElementById('cardSalesSession').textContent = `${session.card_sales} ₪`;
    document.getElementById('cashIn').textContent           = `+ ${session.cash_in} ₪`;
    document.getElementById('cashOut').textContent          = `- ${session.cash_out} ₪`;
    document.getElementById('actualCash').textContent       = `${session.actual_cash} ₪`;
    document.getElementById('expectedCash').textContent     = `${session.expected_cash} ₪`;
    document.getElementById('differance').textContent       = `${session.difference} ₪`;
    const diff = session.difference;

    if (diff === 0) {
        differanceStatus.classList.remove('alert-danger', 'alert-warning');
        differanceStatus.classList.add('alert-success'); // أزرق
    } else if (diff < 0) {
        differanceStatus.classList.remove('alert-primary', 'alert-warning');
        differanceStatus.classList.add('alert-danger'); // أحمر
    } else { // diff > 0
        differanceStatus.classList.remove('alert-primary', 'alert-danger');
        differanceStatus.classList.add('alert-warning'); // أصفر
    }
});

document.addEventListener("click", async function (e) {

    if(e.target.closest('.search-btn')) {
        const validation = validateDateRange(startDate, endDate);
         if(validation.valid){
            hiddeAllContainer();
            displayLoader();
            hiddeError();
            resetSessionData();
            await loadSesions();
            await loadTransactions(sessionsIds);
            setDateTimeRange(formatDateTimeForFilter(startDate.value), formatDateTimeForFilter(endDate.value));
            hiddeLoader();
        }
        
    }
    else if(e.target.closest('.prevBtn')) {
        const parent = e.target.closest('.pagination-button');
        const type = parent.dataset.type;
        prevPage(type);
    }
    else if(e.target.closest('.nextBtn')) {
        const parent = e.target.closest('.pagination-button');
        const type = parent.dataset.type;
        nextPage(type);
    }
    else if(e.target.closest('.print-btn')){
        
        bootstrap.Modal.getInstance(modal).hide();
        showPrintLoader();

        const isSessionClosed = printSession.closed_at !== null;
        try{
            await printCashSummery(printSession , isSessionClosed);
        }catch(e){
            bootboxError(e.message);
        }finally{
            hidePrintLoader();
        }

       
    }
});

document.querySelector('.dropdown-menu').addEventListener('click', (e) => {
    if (e.target.classList.contains('dropdown-item')) {
        const transactionType = e.target.textContent;
        if(transactionType == 'المصروفات'){
            setHeaderFilter(transactionType, 'fa-solid fa-arrow-down');
            handelTotalPage(expensesTransactions.length);
            renderTransactionsTable(expensesTransactions);
        }
        else if(transactionType == 'الإضافات'){
            setHeaderFilter(transactionType, 'fa-solid fa-arrow-up');
            handelTotalPage(additionsTransactions.length);
            renderTransactionsTable(additionsTransactions);
        }
        else{
            setHeaderFilter(' ', ' ', true);
            handelTotalPage(allTransactions.length);
            renderTransactionsTable(allTransactions);
        }
        
    }
});


document.querySelectorAll(".reveal").forEach(el => {
  observer.observe(el);
});








async function loadSesions() {
    try{
        const res = await fetch(urlServer + `/reports/financial/sessions` ,{
            method: 'POST',
                headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
            body: JSON.stringify({
                from :  toUTC(formatDateTimeForServer(startDate.value)),
                to   : toUTC(formatDateTimeForServer(endDate.value))
            }),
            credentials: 'include',
        });
        const data = await res.json();

        if(res.status === 401){
            showAuthExpired(data.message);
        }
        else if(res.status === 200){
            sessions = data.sessions;
            setSessionData(sessions);
            handelTotalPageSessions(sessions.length);
            cashSessionBoxes = data.sessions;
            setCashSessionBoxes();
            setHeaderSummery();
            setSummeryRevenue();
            return;
        }
        else{
            displayError(data.message);
        }
    }catch(e){
        displayError(err.message);
    }
    
}
async function loadTransactions(sessionsIds) {
    if(sessionsIds.length === 0){
        filterTransactions([]);
        setHeaderFilter(' ', ' ', true);
        handelTotalPage(0);
        renderTransactionsTable([]);
        return;
    }
    try{
        const res = await fetch(urlServer + `/reports/financial/transactions` ,{
            method: 'POST',
                headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
            body: JSON.stringify({
                session_ids : sessionsIds,
            }),
        });

        const data = await res.json();

        if(res.status === 401){
            showAuthExpired(data.message);
        }
        else if(res.status === 200){
            filterTransactions(data.transactions);
            setHeaderFilter(' ', ' ', true);
            handelTotalPage(data.transactions.length);
            renderTransactionsTable(data.transactions);
        }
        else{
            displayError(data.message);
        }
    }catch(err){
        displayError(err.message);
    }
}



function setSessionData(sessions){
    if(sessions.length === 0) return;
    for(let session of sessions){
        sessionsIds.push(Number(session.session_id));
        completedOrdersCount += session.completed_orders_count;
        deletedOrdersCount   += session.canceled_orders_count;
        revenueCash          += session.cash_sales;
        revenueCard          += session.card_sales;
        cashAdditions        += session.cash_in;
        cashExpenses        += session.cash_out;
    }
}
function resetSessionData(){
    sessionsIds = [];
    completedOrdersCount = 0;
    deletedOrdersCount = 0;
    revenueCash = 0;
    revenueCard = 0;
    cashAdditions = 0;
    cashExpenses = 0;
}


function setDateTimeRange(startRange, endRange){
    document.getElementById('filterDateStart').textContent = startRange.date;
    document.getElementById('filterTimeStart').textContent = startRange.time;
    document.getElementById('filterDateEnd').textContent   = endRange.date;
    document.getElementById('filterTimeEnd').textContent   = endRange.time;
    displayContainer(filterDateRange);
} 


function setHeaderSummery(){
    const totalOrder     = document.getElementById('totalOrder');
    const completedOrder = document.getElementById('completedOrder');
    const deletedOrder   = document.getElementById('deletedOrder');

    const totalSales     = document.getElementById('totalSales');
    const cashSales      = document.getElementById('cashSales');
    const cardSales      = document.getElementById('cardSales');

    const additionCash   = document.getElementById('additionCash');
    const expenses       = document.getElementById('expenses');

    const totalExpenses  = document.getElementById('totalExpenses');
    const totalAdditions = document.getElementById('totalAdditions');

    totalOrder.textContent   = completedOrdersCount + deletedOrdersCount ;
    completedOrder.innerHTML = `<i class="fas fa-check-circle"></i> ${completedOrdersCount} مكتملة`;
    deletedOrder.innerHTML   = `<i class="fas fa-times-circle"></i> ${deletedOrdersCount} ملغية` ;

    totalSales.textContent   = `${revenueCard + revenueCash} ₪`;
    cashSales.innerHTML      = `<i class="fas fa-money-bill-wave"></i> ${revenueCash} ₪ كاش `;
    cardSales.innerHTML      = `<i class="fas fa-credit-card"></i> ${revenueCard} ₪ بطاقة `;

    additionCash.textContent = `+ ${cashAdditions} ₪`;
    totalAdditions.textContent= `+ ${cashAdditions} ₪`;



    expenses.textContent     = `- ${cashExpenses} ₪`;
    totalExpenses.textContent= `- ${cashExpenses} ₪`;
    

    displayContainer(headerSummeryCard);
}

function setSummeryRevenue(){
    document.getElementById('revenueSummery').textContent = `${revenueCard + revenueCash} ₪`;
    document.getElementById('expensesSummery').textContent = `- ${cashExpenses} ₪`;
    document.getElementById('additionCashSummery').textContent = `+ ${cashAdditions} ₪`;
    document.getElementById('netProfit').textContent = `${(revenueCard + revenueCash + cashAdditions) - cashExpenses} ₪`;
    displayContainer(summeryRevenue);
}


function setCashSessionBoxes(){
    const container = document.getElementById('cashBoxesContainer');
    const header    = document.getElementById('headerBoxes');
    const mesasgeContainer = document.getElementById('emptyMessage');

    container.innerHTML='';
    mesasgeContainer.innerHTML='';

    header.innerHTML = `
        <i class="fas fa-cash-register text-success ms-2"></i>
        الصناديق المفتوحة خلال الفترة (${cashSessionBoxes.length} صندوق) 
    `;

    if(cashSessionBoxes.length === 0) {
        cashSessionsCard.classList.remove('d-none');
        mesasgeContainer.innerHTML = `
            <div class="col-12 fs-5 text-center text-muted">
                لا يوجد صناديق تم فتحها و تسكيرها خلال الفتره المدخلة
            </div>
        `;
        hiddenPaginationBtn(sessionPaginationBtnContainer);
        return;
    }

    const start = (currentPageSessions - 1) * itemsPerPageSessions;
    const end = start + itemsPerPageSessions;
    const sessions = cashSessionBoxes.slice(start, end);

    let counter = (currentPageSessions * 9) - (9);
    container.innerHTML = sessions.map((session , index)=> {
        const isOpen = session.closed_at === null;
        const diffStatus = session.difference === 0 ? 'status-add' : (session.difference < 0 ? 'status-withdraw' : 'status-warning');
        
        return `
        <tr>

            <td>${++counter}</td>

            <td class="nowrap-cell">
                <div class="d-flex flex-column">
                    <span>${utcToPalestine(session.open_at).split(' ')[0]}</span>
                    <span>${formatHour(utcToPalestine(session.open_at).split(' ')[1], true)}</span>
                </div>
            </td>

            <td class="nowrap-cell">
                ${
                    isOpen 
                    ? `
                        <i class="fas fa-lock-open text-success"></i>
                        <span>مفتوح</span>
                        ` 
                    :  ` 
                        <div class="d-flex flex-column">
                            <span>${utcToPalestine(session.closed_at).split(' ')[0]}</span>
                            <span>${formatHour(utcToPalestine(session.closed_at).split(' ')[1], true)}</span>
                        </div>
                    `
                }
            </td>

            <td class="text-primary" style="font-weight: 600;">
                ${session.opening_cash} ₪
            </td>

            <td class="text-success" style="font-weight: 600;">
               ${session.cash_sales} ₪
            </td>

            <td class="text-info" style="font-weight: 600;">
                ${session.card_sales} ₪
            </td>

            <td class="text-success" style="font-weight: 600;">
                + ${session.cash_in} ₪
            </td>

            <td class="text-danger" style="font-weight: 600;"> 
                - ${session.cash_out} ₪
            </td>

            <td class="text-dark" style="font-weight: 600;">
                ${session.expected_cash} ₪
            </td>

            <td class="text-warning" style="font-weight: 600;">
                ${session.actual_cash} ₪
            </td>
        
            

            <td>
                <span class="badge ${diffStatus}" style="font-size: 14px;">
                ${session.difference} ₪
                </span>
            </td>
            
            <td>
                <button class="btn btn-sm btn-primary"
                    data-bs-toggle="modal"
                    data-bs-target="#cashBoxModal"
                    data-box-id="${session.session_id}"
                >
                    <i class="fas fa-print"></i>
                </button>
            </td>


            
        </tr>
        `;
    }).join('');

    //   document.getElementById('cashIn').textContent           = `+ ${session.cash_in} ₪`;
    // document.getElementById('cashOut').textContent          = `- ${session.cash_out} ₪`;
    // document.getElementById('actualCash').textContent       = `${session.actual_cash} ₪`;
    // document.getElementById('expectedCash').textContent     = `${session.expected_cash} ₪`;
    // document.getElementById('differance').textContent       = `${session.difference} ₪`;
    // const diff = session.difference;

    // if (diff === 0) {
    //     differanceStatus.classList.remove('alert-danger', 'alert-warning');
    //     differanceStatus.classList.add('alert-success'); // أزرق
    // } else if (diff < 0) {
    //     differanceStatus.classList.remove('alert-primary', 'alert-warning');
    //     differanceStatus.classList.add('alert-danger'); // أحمر
    // } else { // diff > 0
    //     differanceStatus.classList.remove('alert-primary', 'alert-danger');
    //     differanceStatus.classList.add('alert-warning'); // أصفر
    // }




    displayContainer(cashSessionsCard);
    updatePagination(sessionPaginationBtnContainer, true);
    displayPaginationBtn(sessionPaginationBtnContainer);

}


function renderTransactionsTable(transactions){
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
        hiddenPaginationBtn(transactionPaginationBtnContainer);
        displayContainer(transactionTableCard);
        return;
    }
    currentDisplayedTransactions = transactions;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageTransactions = transactions.slice(start, end);

    tableBody.innerHTML='';

    let counter = (currentPage * 10) - (10);
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

    updatePagination(transactionPaginationBtnContainer);
    displayPaginationBtn(transactionPaginationBtnContainer);
    displayContainer(transactionTableCard);
}


function filterTransactions(transactions){
    allTransactions = transactions;

    additionsTransactions = [];
    expensesTransactions  = [];

    if(transactions.length === 0){
        return;
    } 

    transactions.forEach(transaction => {
        if(transaction.type === 'إضافة'){
            additionsTransactions.push(transaction);
        } else {
            expensesTransactions.push(transaction);
        }
    });
}
function setHeaderFilter(transactionType, iconClass, shwoAll = false){
    const headerFilterType = document.getElementById('headerFilterType');
    if(shwoAll){
        headerFilterType.classList.add('d-none');
        return;
    }
    const badge = document.getElementById('typeBadge');
    const text = document.getElementById('typeText');
    const icon = document.getElementById('typeIcon');

    text.textContent= transactionType;
    icon.className  = iconClass;

    if(transactionType == 'المصروفات'){
        badge.classList.remove('status-add' , 'text-success');
        badge.classList.add('status-withdraw' , 'text-danger');
    }else{
        badge.classList.remove('status-withdraw' , 'text-danger');
        badge.classList.add('status-add', 'text-success');
    }

    headerFilterType.classList.remove('d-none');
}


function prevPage(type) {
    if(type === 'sessions'){
        if (currentPageSessions > 1) {
            currentPageSessions--;
            setCashSessionBoxes();
        }
    }

    else if(type === 'transactions'){
        if (currentPage > 1) {
            currentPage--;
            renderTransactionsTable(currentDisplayedTransactions);
        }

    }
    
}
function nextPage(type) {
    if(type === 'sessions'){
        if (currentPageSessions < totalPagesSessions) {
            currentPageSessions++;
            setCashSessionBoxes();
        }
    }
    else if(type === 'transactions'){
        if (currentPage < totalPages) {
            currentPage++;
            renderTransactionsTable(currentDisplayedTransactions);
        }
    }
}
function handelTotalPage(numOfTransactions){
    if(numOfTransactions==0) return;
    currentPage = 1;
    totalItems = numOfTransactions;
    totalPages = Math.ceil(totalItems / itemsPerPage);
}
function updatePagination(parentContainer, isFroSessions = false) {
    const pageInfo = parentContainer.querySelector('.pageInfo');
    const prevBtn = parentContainer.querySelector('.prevBtn');
    const nextBtn = parentContainer.querySelector('.nextBtn');

    if(isFroSessions){
        pageInfo.textContent = `صفحة ${currentPageSessions} من ${totalPagesSessions}`;
        prevBtn.disabled = currentPageSessions === 1;
        nextBtn.disabled = currentPageSessions === totalPagesSessions;
    }
    else{
        pageInfo.textContent = `صفحة ${currentPage} من ${totalPages}`;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
    }

}

function handelTotalPageSessions(numOfSessionsBoxes){
    if(numOfSessionsBoxes == 0) return;
    currentPageSessions = 1;
    totalItemsSessions = numOfSessionsBoxes;
    totalPagesSessions = Math.ceil(totalItemsSessions / itemsPerPageSessions);
}


function hiddeAllContainer(){
    hiddeContainer(headerSummeryCard);    
    hiddeContainer(cashSessionsCard);
    hiddeContainer(summeryRevenue);       
    hiddeContainer(transactionTableCard);    
}


function checkInputs() {
    if (startDate.value !== "" && endDate.value !=="") {
      serchBtn.disabled = false;
    } else {
      serchBtn.disabled = true;
    }
}



function displayPaginationBtn(parentContainer){
  parentContainer.classList.remove('d-none');  
}
function hiddenPaginationBtn(parentContainer){
    parentContainer.classList.add('d-none');  
}




function formatDateTimeForFilter(dateString) {
    const safeDate = dateString.replace(' ', 'T');
    const date = new Date(safeDate);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day}`;

    const formattedTime = date.toLocaleTimeString('en-PS', {
        timeZone: 'Asia/Jerusalem',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    return {
        date: formattedDate,
        time: formattedTime
    };
}
