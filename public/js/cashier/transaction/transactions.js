import { setActiveNavLink, showAuthExpired, bootboxError, bootboxSuccess, hidePrintLoader, showPrintLoader } from "../../../component/bootbox.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import { printTransaction } from "../../../component/invoices.js";
import { bootboxLoginAsAdmin, closeSideBar, SwitchToAdmin } from "../Switch-user-functionality.js";
import { formatDateOnly, formatTimeOnly, utcToPalestine } from "../../admin/report/shared-functionality.js";


const header = document.querySelector("site-header");

const amount = document.getElementById('transactionAmount');
const type = document.getElementById('transactionType');
const note = document.getElementById('transactionNote');
const createBtn = document.getElementById('creatTransactionBtn');
const openModalBtn = document.getElementById('openTransactionModal');




const tooltipEl = document.querySelector('[data-bs-toggle="tooltip"]');
const tooltip = new bootstrap.Tooltip(tooltipEl);

let sessionId = 0;
let cashSummery = {
  opening_cash: 0,
  cash_sales: 0,
  cash_in: 0,
  cash_out: 0,
  expected_cash: 0,
}


let currentPage;
let itemsPerPage = 10;
let totalItems;
let totalPages;

let transactionsData = [];

let currentTransaction = {
  amount: 0,
  note: '',
  type: ''
}


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


amount.addEventListener("input", checkInputs);
type.addEventListener("change", checkInputs);
note.addEventListener("input", checkInputs);



document.addEventListener("click", async function (e) {
  if (e.target.closest('.add-btn')) {
    await createTransaction();
  }
  else if (e.target.closest('.delete-btn')) {
    const btn = e.target.closest(".delete-btn");
    const transaction = JSON.parse(btn.dataset.transaction);
    bootboxDeleteTransaction({
      amount: transaction.amount,
      type: transaction.type,
      note: transaction.note,
      onConfirm: async () => {
        await deleteTransaction(Number(transaction.id));
      }
    });
  }
  else if (e.target.closest('.print-row-btn')) {
    showPrintLoader();
    const btn = e.target.closest(".print-row-btn");
    if (!btn) return;

    const data = JSON.parse(btn.dataset.transaction);
    data.time = formatTimeOnly(utcToPalestine(data.created_at));
    data.date = formatDateOnly(utcToPalestine(data.created_at));

    try{
      await printTransaction(data);

    }catch(e){
      bootboxError(e.message);
    }finally{
      hidePrintLoader();
    }


  }
  else if (e.target.closest('.prevBtn')) {
    prevPage();
  }
  else if (e.target.closest('.nextBtn')) {
    nextPage();
  }
  else if (e.target.closest('.switch-admin-btn')) {
    const input = document.getElementById('adminPassword');
    await SwitchToAdmin(url, input.value);
  }

});


document.getElementById('transactionModal').addEventListener('hidden.bs.modal', function () {
  amount.value = '';
  note.value = '';
  type.value = '';
  createBtn.disabled = true;
});

document.addEventListener('DOMContentLoaded', async function () {
  await loadTransaction();
});




function checkInputs() {
  if (amount.value.trim() !== "" && amount.value.trim() !== "0" && type.value !== "" && note.value.trim() !== "") {
    createBtn.disabled = false;
  } else {
    createBtn.disabled = true;
  }
}


async function loadTransaction() {
  setSpinnerLoader();
  try {
    const res = await fetch(urlServer + '/load-transaction/according-to-session', {
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

      disableModalBtn(data.has_open_session);

      if (data.has_open_session) {
        sessionId = data.session_id;
        cashSummery = data.cash_summery;
        transactionsData = data.transactions;
        handelTotalPage(transactionsData.length);
        renderTransactionsTable(data.transactions);
      }
      else {
        renderTransactionsTable([], false);
      }

    }

    else {
      bootboxError(data.message);
    }

    setCashSummery();

  } catch (err) {
    bootboxError(err.message);
  }
}


async function createTransaction() {
  if (!sessionId) return bootboxError("لا يوجد صندوق مفتوح حاليا");
  displaySpinnerLoader();
  let transType;
  if (transactionType.value === "تسديد دين") {
    transType = 'إضافة';
  }
  else {
    transType = type.value;
  }

  try {
    const res = await fetch(urlServer + `/creat-transaction?session_id=${sessionId}`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${getAuthToken('user-auth')}`
      },
      body: JSON.stringify({
        amount: amount.value,
        note: note.value,
        type: transType,
      }),
    });

    const data = await res.json();

    if (res.status === 401) {
      showAuthExpired(data.message);
    }
    else if (res.status === 200) {
      closeModal();
      updateCurrentTransactionData();
      bootboxSuccess(
        data.message,
        async () => {
          showPrintLoader();              // يبدأ اللودر
          await printTransaction(currentTransaction); // انتظار الطباعة
          hidePrintLoader();             // ينتهي بعد الطباعة
        },
        true,
        async () => await loadTransaction()
      );

    }
    else {
      bootboxError(data.message);
    }

  } catch (err) {
    bootboxError(err.message);
  }
  finally {
    hiddeSpinnerLoader();
  }
}

async function deleteTransaction(id) {
  try {
    const res = await fetch(urlServer + `/delete-transaction?transaction_id=${id}`, {
      method: 'DELETE',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${getAuthToken('user-auth')}`
      },
    });
    const data = await res.json();
    if (res.status === 401) {
      showAuthExpired(data.message);
    }
    else if (res.status === 200) {
      bootboxSuccess(data.message);
      await loadTransaction();
    }
    else {
      bootboxError(data.message);
    }
  } catch (err) {
    bootboxError(err.message);
  }
}


function setCashSummery() {
  document.getElementById('expectedCash').textContent = `${cashSummery?.expected_cash || 0} ₪`;
  document.getElementById('openingCash').textContent = `${cashSummery?.opening_cash || 0} ₪`;
  document.getElementById('cashSales').textContent = `${cashSummery?.cash_sales || 0} ₪`;
  document.getElementById('cashIn').textContent = `+${cashSummery?.cash_in || 0} ₪`;
  document.getElementById('cashOut').textContent = `-${cashSummery?.cash_out || 0} ₪`;
}
function setSpinnerLoader() {
  const spinner = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';
  const tableBody = document.getElementById('transactions-table-body');

  tableBody.innerHTML = '';

  const spinnerTable = `
    <tr id="loading-row">
      <td colspan="100%" class="text-center py-5">
        <div class="d-flex flex-column align-items-center gap-2">
          <div class="spinner-border text-primary" role="status"></div>
          <span class="text-muted">جاري تحميل...</span>
        </div>
      </td>
    </tr>
  `;

  document.getElementById('expectedCash').innerHTML = spinner;
  document.getElementById('openingCash').innerHTML = spinner;
  document.getElementById('cashSales').innerHTML = spinner;
  document.getElementById('cashIn').innerHTML = spinner;
  document.getElementById('cashOut').innerHTML = spinner;

  tableBody.innerHTML = spinnerTable;
}

function disableModalBtn(hasOpeningSession) {
  openModalBtn.disabled = !hasOpeningSession;

  const badge = document.getElementById('cashSessionStatus');

  if (openModalBtn.disabled) {
    tooltip.enable();
    badge.className = "badge bg-danger me-2";
    badge.textContent = "لا يوجد صندوق مفتوح";
  } else {
    tooltip.disable();
    badge.className = "badge bg-success me-2";
    badge.textContent = "الصندوق مفتوح";
  }


}

function displaySpinnerLoader() {
  const spinnerLoader = document.getElementById("modal-loading-overlay");
  spinnerLoader.classList.remove('d-none');
  spinnerLoader.classList.add('d-flex');
}
function hiddeSpinnerLoader() {
  const spinnerLoader = document.getElementById("modal-loading-overlay");
  spinnerLoader.classList.add('d-none');
  spinnerLoader.classList.remove('d-flex');
}


function renderTransactionsTable(transactions, hasOpeningSession = true) {
  const tableBody = document.getElementById('transactions-table-body');
  if (!hasOpeningSession) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>لا يوجد صندوق مفتوح</p>
        </td>
      </tr>
    `;
    return;
  }

  if (transactions.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>لم يتم إنشاء اي معاملات مالية اليوم </p>
        </td>
      </tr>
    `;
    return;
  }


  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageTransactions = transactions.slice(start, end);

  let counter = (currentPage * 10) - (10);

  tableBody.innerHTML = pageTransactions.map((t, index) => {

    const isAdd = t.type === "إضافة";

    return `
      <tr>

        <td>${(++counter).toString().padStart(3, '0')}</td>
    
        <td class="nowrap-cell">${formatTimeOnly(utcToPalestine(t.created_at))}</td>

        <td class="nowrap-cell">${formatDateOnly(utcToPalestine(t.created_at))}</td>

        <td class="fw-bold ${isAdd ? 'text-success' : 'text-danger'} nowrap-cell">
          ${isAdd ? '+' : '-'} ${t.amount.toLocaleString()} ₪
        </td>

        <td>
          <span class="badge ${isAdd ? 'status-add' : 'status-withdraw'}">
            ${t.type}
          </span>
        </td>

        <td>${t.note}</td>

        <td>

          <button class="btn btn-sm print-row-btn" title="طباعة" 
           data-transaction='{"created_at":"${t.created_at}", "amount":${t.amount}, "type":"${t.type}", "note":"${t.note}"}'
          >
            <i class="fas fa-print"></i>
          </button>

          
        </td>

      </tr>
    `;
  }).join('');

  updatePagination();


}
function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTransactionsTable(transactionsData);
  }
}

function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    renderTransactionsTable(transactionsData);
  }
}

function handelTotalPage(numOfTransactions) {
  if (numOfTransactions == 0) return;
  currentPage = 1;
  totalItems = numOfTransactions;
  totalPages = Math.ceil(totalItems / itemsPerPage);
}

function updatePagination() {
  const pageInfo = document.getElementById('pageInfo');

  // تحديث معلومات الصفحة
  pageInfo.textContent = `صفحة ${currentPage} من ${totalPages}`;

  // إخفاء/إظهار الأسهم
  document.getElementById('prevBtn').disabled = currentPage === 1;
  document.getElementById('nextBtn').disabled = currentPage === totalPages;
}
function updateCurrentTransactionData() {
  currentTransaction.amount = amount.value;
  currentTransaction.note = note.value;
  currentTransaction.type = type.value;
}



function closeModal() {
  const modal = bootstrap.Modal.getInstance(document.getElementById('transactionModal'));
  modal.hide();
}
function bootboxDeleteTransaction(options = {}) {

  const {
    amount,
    type,
    note,
    onConfirm,
    onCancel
  } = options;

  const isAdd = type === "إضافة";

  const dialog = bootbox.dialog({
    title: `<i class="bi bi-trash text-danger"></i> حذف معاملة`,
    message: `
      <p class="mb-2">
        هل أنت متأكد أنك تريد حذف هذه المعاملة؟
      </p>
      <p class="fw-bold ${isAdd ? 'text-success' : 'text-danger'}">
        ${isAdd ? '+' : '-'} ${Number(amount).toLocaleString()} ₪ (${type})
        <br>
        ${note}
      </p>
      
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
        label: 'حذف',
        className: 'btn-danger',
        callback() {
          if (typeof onConfirm === 'function') {
            onConfirm();
          }
        }
      }
    }
  });

}


