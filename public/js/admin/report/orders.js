import { showAuthExpired, setActiveNavLink } from "../../../component/bootbox.js";
import { displayLoader, hiddeLoader, hiddeError, displayError, validateDateRange, observer, displayContainer, hiddeContainer, formatHour, formatDateTimeForServer, formatTimeOnly, formatDateOnly, toUTC, utcToPalestine } from "./shared-functionality.js";


import { url, urlServer } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";


const header = document.querySelector("site-header");
const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');
const serchBtn = document.getElementById('searchBtn');
const modal = document.getElementById('orderItemsModal');

const headerSummeryCard = document.getElementById('headerSummeryCard');
const ordersTableCard = document.getElementById('ordersTable');


let currentPage;
let totalPages;
let limit = 20;
let cancelledOrdersCount = 0;
let completedOrdersCount = 0;
let ordersList = [];


let currentDisplayedTotalOrderCount = 0;
let orderCounter = 0;

let isFilterCompletedOrder;


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

startDate.addEventListener('input', checkInputs);
endDate.addEventListener('input', checkInputs);



document.addEventListener("click", async function (e) {

  if (e.target.closest('.search-btn')) {
    const validation = validateDateRange(startDate, endDate);
    if (validation.valid) {
      hiddeAllContainer();
      displayLoader();
      hiddeError();
      await loadOrdersDetails();
      hiddeLoader();
    }
  }

  else if (e.target.closest('.prevBtn')) {
    displayPaginationLoader();
    if (isFilterCompletedOrder) {
      await prevPage(completedOrdersCount, 'مكتمل');
    }
    else {
      await prevPage(cancelledOrdersCount, 'ملغي');
    }
    hiddePaginationLoader();
  }
  else if (e.target.closest('.nextBtn')) {
    displayPaginationLoader();
    if (isFilterCompletedOrder) {
      await nextPage(completedOrdersCount, 'مكتمل');
    }
    else {
      await nextPage(cancelledOrdersCount, 'ملغي');
    }
    hiddePaginationLoader();
  }

});


modal.addEventListener('show.bs.modal', function (event) {
  const button = event.relatedTarget; // العنصر اللي كبست عليه
  const orderId = Number(button.getAttribute('data-order-id'));


  const order = ordersList.find(o => o.id == orderId);


  // البحث عن أصناف الطلب
  const orderItems = order.items;

  // بناء HTML الجدول
  let itemsHtml = '';
  orderItems.forEach(item => {
    const displayName = item.size_name !== 'NaN'
      ? `${item.item_name} - ${item.size_name}`
      : item.item_name;

    itemsHtml += `
          <tr>
              <td>${displayName || 'تم حذف المنتج'}</td>
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
  document.getElementById('modalOrderType').textContent = order.type;
  document.getElementById('modalItemsTable').innerHTML = itemsHtml;

  if (order.cancel_reason != null) {
    displayCanselResonAndTimeUpdated();
    document.getElementById('modalUpdated').textContent = formatTimeOnly(order.updated_at);
    document.getElementById('modalCancelReason').textContent = order.cancel_reason;
  }
  else {
    hiddeCanselResonAndTimeUpdated();
  }

});

document.querySelectorAll(".reveal").forEach(el => {
  observer.observe(el);
});



document.querySelector('.dropdown-menu').addEventListener('click', async (e) => {
  if (e.target.classList.contains('dropdown-item')) {
    const orderType = e.target.textContent;
    if (orderType == 'المكتملة') {
      isFilterCompletedOrder = true;
      setHeaderFilter(orderType);
      setCurrentDisplayedTotalOrderCount(completedOrdersCount);
      await loadMoreOrders(completedOrdersCount, 'مكتمل', 1);
    }
    else {
      isFilterCompletedOrder = false;
      setHeaderFilter(orderType);
      setCurrentDisplayedTotalOrderCount(cancelledOrdersCount);
      await loadMoreOrders(cancelledOrdersCount, 'ملغي', 1);
      
    }
  }
});


async function loadOrdersDetails() {
  try {
    const res = await fetch(urlServer + `/reports/orders/details`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${getAuthToken('auth')}`
      },
      body: JSON.stringify({
        from: toUTC(formatDateTimeForServer(startDate.value)),
        to: toUTC(formatDateTimeForServer(endDate.value)),
      }),
    });
    const data = await res.json();

    if (res.status === 401) {
      showAuthExpired(data.message);
    }
    else if (res.status === 200) {
      ordersList = data.mapItems;
      setOrdersCount(data);
      setHeaderSummery(data);
      isFilterCompletedOrder = true;
      currentPage = 1;
      totalPages = Math.ceil(completedOrdersCount / limit);
      setHeaderFilter('المكتملة');
      setCurrentDisplayedTotalOrderCount(completedOrdersCount);
      renderOrdersTable();
    }
    else {
      displayError(data.message);
    }
  } catch (err) {
    displayError(err.message);
  }
}

async function loadMoreOrders(totalOrder, status, page) {
  try {
    const res = await fetch(urlServer + `/reports/orders/list`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${getAuthToken('auth')}`
      },
      body: JSON.stringify({
        from: toUTC(formatDateTimeForServer(startDate.value)),
        to: toUTC(formatDateTimeForServer(endDate.value)),
        page: page,
        status: status,
        totalOrder: totalOrder
      }),
    });
    const data = await res.json();

    if (res.status === 401) {
      showAuthExpired(data.message);
    }
    else if (res.status === 200) {
      handelPaginationData(data.pagination);
      ordersList = data.mapItems;
      renderOrdersTable();
      return;
    }
    else {
      displayError(data.message);
    }
  } catch (e) {
    displayError(err.message);
  }

}

function setHeaderSummery(data) {
  const totalOrder = document.getElementById('totalOrder');
  const completedOrder = document.getElementById('completedOrder');
  const deletedOrder = document.getElementById('deletedOrder');

  const totalSales = document.getElementById('totalSales');
  const cashSales = document.getElementById('cashSales');
  const cardSales = document.getElementById('cardSales');

  const avgDemand = document.getElementById('averageDemand');
  totalOrder.textContent = completedOrdersCount + cancelledOrdersCount;
  completedOrder.innerHTML = `<i class="fas fa-check-circle"></i> ${completedOrdersCount} مكتملة`;
  deletedOrder.innerHTML = `<i class="fas fa-times-circle"></i> ${cancelledOrdersCount} ملغية`;

  totalSales.textContent = `${data.orderDetails.card_revenue + data.orderDetails.cash_revenue} ₪`;
  cashSales.innerHTML = `<i class="fas fa-money-bill-wave"></i> ${data?.orderDetails.cash_revenue || 0} ₪ كاش `;
  cardSales.innerHTML = `<i class="fas fa-credit-card"></i> ${data?.orderDetails.card_revenue || 0} ₪ بطاقة `;



  avgDemand.textContent = completedOrdersCount === 0 ? '0 ₪'
    : `${((data.orderDetails.cash_revenue + data.orderDetails.card_revenue) / completedOrdersCount).toFixed(2)} ₪`;




  displayContainer(headerSummeryCard);
}



async function prevPage(totalOrder, status) {
  if (currentPage > 1) {
    currentPage--;
    await loadMoreOrders(totalOrder, status, currentPage);
  }
}
async function nextPage(totalOrder, status) {
  if (currentPage < totalPages) {
    currentPage++;
    await loadMoreOrders(totalOrder, status, currentPage);
  }
}
function handelPaginationData(pagination) {
  currentPage = pagination.current_page;
  totalPages = pagination.total_page;
}


function updatePagination() {
  displayPaginationBtn();
  const pageInfo = document.getElementById('pageInfo');

  // تحديث معلومات الصفحة
  pageInfo.textContent = `صفحة ${currentPage} من ${totalPages}`;

  // إخفاء/إظهار الأسهم
  document.getElementById('prevBtn').disabled = currentPage === 1;
  document.getElementById('nextBtn').disabled = currentPage === totalPages;

}
function checkInputs() {
  if (startDate.value !== "" && endDate.value !== "") {
    serchBtn.disabled = false;
  } else {
    serchBtn.disabled = true;
  }
}


function renderOrdersTable() {
  const tbody = document.getElementById('ordersTableBody');

  tbody.innerHTML = '';

  let html = '';

  if (ordersList.length === 0) {
    tbody.innerHTML = `
      <tr>
          <td colspan="7" class="empty-state">
              <i class="fas fa-inbox"></i>
              <p>لا توجد طلبات لعرضها</p>
          </td>
      </tr>
    `;
    hiddePaginationBtn();
    displayContainer(ordersTableCard);
    return;
  }

  orderCounter = currentPage === 1 ? 0 : (currentPage - 1) * limit;




  ordersList.forEach((order , index) => {
    let badgeClass = '';
    if (order.status === 'مكتمل') badgeClass = 'badge-completed';
    else badgeClass = 'badge-cancelled';


    const paymentClass = order.payment_method === 'كاش' ? 'status-completed' :
            order.payment_method === 'بطاقة' ? 'bg-info text-white' : 'status-pending';
    html += `
      <tr>
        <td>${getCurrentDisplayedTotalOrderCount() - orderCounter}</td>
        
        <td class='nowrap-cell'>${renderOrderType(order)}</td>
        <td><span class='status-badge ${paymentClass}'>  ${order.payment_method}</span></td>
        <td class='nowrap-cell'>${formatDateOnly(utcToPalestine(order.created_at))}</td>
        <td class='nowrap-cell'>${formatTimeOnly(utcToPalestine(order.created_at))}</td>
        <td class='nowrap-cell'>${order.total_price} ₪</td>
        <td><span class="badge ${badgeClass}">${order.status}</span></td>
        <td>
          <button class="btn btn-sm btn-light"

            data-bs-toggle="modal"
            data-bs-target="#orderItemsModal"
            data-order-id="${order.id}"
          >
            <i class="fas fa-eye"></i>
          </button>
        </td>
      </tr>
    `;
    orderCounter++;

  });

  tbody.innerHTML = html;


  updatePagination();
  displayContainer(ordersTableCard);
}

function renderOrderType(order) {
  if(order.type === "سفري") {
    return `
      <span class="badge text-secondary border border-secondary bg-transparent px-3 py-2">
      <i class="fa-solid fa-box"></i>
      سفري
    </span>
    `;
  }

  if(order.type === "طاولة") {
    return `
       <span class="badge text-primary border border-primary bg-transparent px-3 py-2">
            <i class="bi bi-person-seat me-1"></i>
            طاولة - ${order.table_num}
        </span>
    `;
  }

}

function displayPaginationBtn() {
  const paginationBtn = document.getElementById('paginationBtn');
  paginationBtn.classList.remove('d-none');
}
function hiddePaginationBtn() {
  const paginationBtn = document.getElementById('paginationBtn');
  paginationBtn.classList.add('d-none');
}

function setHeaderFilter(status) {
  const typeDiv = document.getElementById('typeText');
  if (status === 'المكتملة') {
    typeDiv.className = 'badge badge-completed';
  } else {
    typeDiv.className = 'badge badge-cancelled';
  }
  typeDiv.textContent = status;
}
function setOrdersCount(data) {
  cancelledOrdersCount = data.orderDetails.cancelled_orders;
  completedOrdersCount = data.orderDetails.completed_orders;
  document.getElementById('completedOrdersCount').textContent = `${completedOrdersCount} طلبات مكتملة`;
  document.getElementById('deletedOrdersCount').textContent = `${cancelledOrdersCount} تم حذفهم`;
}

function displayCanselResonAndTimeUpdated() {
  const timeUpdated = document.getElementById('modalUpdated').parentElement;;
  const cancelReson = document.getElementById('modalCancelReason').parentElement;;
  if (cancelReson.classList.contains('d-none')) {
    cancelReson.classList.remove('d-none');
    timeUpdated.classList.remove('d-none');
  }
}
function hiddeCanselResonAndTimeUpdated() {
  const timeUpdated = document.getElementById('modalUpdated').parentElement;
  const cancelReson = document.getElementById('modalCancelReason').parentElement;

  if (!cancelReson.classList.contains('d-none')) {
    cancelReson.classList.add('d-none');
    timeUpdated.classList.add('d-none');
  }
}

function hiddeAllContainer() {
  hiddeContainer(headerSummeryCard);
  hiddeContainer(ordersTable);
}

function displayPaginationLoader() {
  const loader = document.getElementById('paginationLoder');
  loader.classList.remove('d-none');
}
function hiddePaginationLoader() {
  const loader = document.getElementById('paginationLoder');
  loader.classList.add('d-none');
}


function setCurrentDisplayedTotalOrderCount(count) {
  currentDisplayedTotalOrderCount = count;
}
function getCurrentDisplayedTotalOrderCount() {
  return currentDisplayedTotalOrderCount;
}