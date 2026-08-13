import { showAuthExpired, setActiveNavLink, showPrintLoader, hidePrintLoader, bootboxError, bootboxSuccess } from "../../../component/bootbox.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import { bootboxLoginAsAdmin, closeSideBar, SwitchToAdmin } from "../Switch-user-functionality.js";
import { handelOrderDatabeforPrinting } from "../../../component/invoices.js";
import { formatDateOnly, formatTimeOnly, utcToPalestine } from "../../admin/report/shared-functionality.js";

const header = document.querySelector("site-header");

const orderDetailsModal = document.getElementById('orderDetailsModal');
const openItemsBtn = document.getElementById("openItemsBtn");

const discountInput = document.getElementById("discountAmount");
const beforeEl = document.getElementById("beforeDiscountTotal");
const afterEl = document.getElementById("afterDiscountTotal");
const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
const paymentMethod = document.getElementById('paymentMethod');

const loader = document.getElementById('overlay_loader');
const successModelOrder = document.getElementById('successModal');
const loaderCard        = document.getElementById('loaderCard');

let tablesData;
let currentDisplayedOrderId;
let currentPaymentOrder;
let mainCategories = [];
let items = [];
let cart = [];


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


document.addEventListener('DOMContentLoaded', async function () {
    await loadTableOrders();
});


document.addEventListener("click", async function (e) {
    if (e.target.closest('.add-item-btn')) {
        const btn = e.target.closest('.add-item-btn');
        const itemId = Number(btn.dataset.id);
        addItemToOrder(itemId);
    }

    else if (e.target.closest('.add-size-btn')) {
        const btn = e.target.closest('.add-size-btn');
        const itemId = Number(btn.dataset.id);
        const sizeId = Number(btn.dataset.size);
        addItemToOrder(itemId, sizeId);
    }

    else if (e.target.closest('.delete-item-btn')) {
        const btn = e.target.closest('.delete-item-btn');

        const itemId = Number(btn.dataset.id);
        const sizeindex = Number(btn.dataset.sizeindex);
        deleteItemFromCart(itemId, sizeindex);
    }

    else if (e.target.closest('.update-order-btn')) {
        const total = calculateTotalPrice();
        const note = document.getElementById('orderNotes').value.trim();
        const table = getCurrentTable();

        let finalOrder = {
            tableNum: table.table_id,
            order_id: currentDisplayedOrderId,
            total_price: total,
            new_items: cart,
            note: note
        };
        showConfirmAddItemsDialog(finalOrder);        
    }

    // فتح قسم الدفع
    else if (e.target.closest(".paymentBtn")) {
        const paymentSection = document.getElementById("paymentSection");
        paymentSection.classList.toggle("d-none");

        if (!paymentSection.classList.contains('d-none')) {
            setInitialViewForAddItembtn();
        }

        const table = getCurrentTable();

        document.getElementById('beforeDiscountTotal').textContent = `₪ ${table.order.total_price}`;
        document.getElementById('afterDiscountTotal').textContent = `₪ ${table.order.total_price}`;


    }

    else if (e.target.closest(".confirmPaymentBtn")) {
        const currentClosedTable = getCurrentTable();

        currentPaymentOrder = {
            invoice_num    : currentClosedTable.order.invoice_num,
            time           : formatTimeOnly(utcToPalestine(currentClosedTable.order.created_at)),
            date           : formatDateOnly(utcToPalestine(currentClosedTable.order.created_at)),
            payment_method : paymentMethod.value,
            type           : 'طاولة',
            total_price    : currentClosedTable.order.total_price - Number(discountInput.value),
            discount       : currentClosedTable.order.discount + Number(discountInput.value),
            new_discount   : Number(discountInput.value),
            table_num      : currentClosedTable.table_id,
            order_id       : currentClosedTable.order.id,
            items          : currentClosedTable.order.items
        }
        showPayOrderDialog(currentPaymentOrder);
        //await payOrder(currentPaymentOrder);
    }

    else if (e.target.closest('.deleteTableBtn')) {
        const btn = e.target.closest(".deleteTableBtn");
        const tableId = Number(btn.dataset.id);
        const orderId = Number(btn.dataset.orderId);
        bootboxTableAction({
            title: "حذف الطلب",
            message: `
            <div class="text-danger fw-bold mb-2">
                سيتم حذف الطلب نهائياً, وإغلاق الطاولة.
            </div>
            أدخل رقم الطاولة للتأكيد.
        `,
            currentTable: tableId,
            confirmText: "حذف",
            confirmClass: "btn-danger",

            onConfirm(targetTable) {

                if (targetTable != tableId) {
                    bootbox.alert("رقم الطاولة غير صحيح");
                    return;
                }

                deleteOrder(orderId);
            }
        });
    }
    else if (e.target.closest('.changeTableBtn')) {
        const btn = e.target.closest(".changeTableBtn");
        const tableId = Number(btn.dataset.tableId);

        bootboxTableAction({
            title: "نقل الطاولة",
            message: `
            أدخل رقم الطاولة الجديدة التي تريد نقل الطلب إليها.
        `,
            currentTable: tableId,
            placeholder: "رقم الطاولة الجديدة",
            confirmText: "نقل",
            confirmClass: "btn-primary",

            onConfirm(targetTable) {
                const newTable = Number(targetTable);
                const currentTable = Number(tableId);

                if (newTable === currentTable) {
                    bootbox.alert({
                        title: "خطأ",
                        message: `
                            <div class="text-danger fw-bold">
                                لا يمكنك نقل الطلب إلى نفس الطاولة الحالية (${currentTable})
                            </div>
                        `
                    });
                    return;
                }

                if (!newTable || newTable <= 0) {
                    bootbox.alert("يرجى إدخال رقم طاولة صحيح");
                    return;
                }
                moveOrder(tableId, targetTable);
            }
        });
    }

    else if (e.target.closest('.close-success-modal')) {
        const btn = e.target.closest(".close-success-modal");
        closeSuccessModal();
        await loadTableOrders();
    }

    else if (e.target.closest('.print-invoice-btn')) {
        closeSuccessModal();
        showPrintLoader();
        try{
            await handelOrderDatabeforPrinting(currentPaymentOrder);
        }catch(e){
            bootboxError(e.message);
        }finally{
            hidePrintLoader();
            await loadTableOrders();
        }
    }

    else if (e.target.closest('.switch-admin-btn')) {
        const input = document.getElementById('adminPassword');
        await SwitchToAdmin(url, input.value);
    }

});

orderDetailsModal.addEventListener('show.bs.modal', function (event) {

    const button = event.relatedTarget;
    const tableId = Number(button.getAttribute('data-table-id'));

    const table = tablesData.find(t => t.table_id == tableId);

    if (!table || !table.order) return;

    const order = table.order;

    currentDisplayedOrderId = Number(order.id);

    document.getElementById("modalOrderId").textContent = tableId || "-";

    document.getElementById("modaltime").textContent = formatTimeOnly(utcToPalestine(order.created_at));;


    const itemsBody = document.getElementById("modalItemsTable");
    itemsBody.innerHTML = "";


    (order.items || []).forEach(item => {
        const displayName = item.size_name !== 'NaN'
            ? `${item?.item_name || 'تم حذف الصنف'} - ${item.size_name}`
            : item?.item_name || 'تم حذف الصنف';


        itemsBody.innerHTML += `
            <tr>
                <td>${displayName}</td>
                <td>${item.quantity}</td>
                <td>${item.price} ₪</td>
                <td class="fw-bold">${item.price * item.quantity} ₪</td>
            </tr>
        `;
    });

    itemsBody.innerHTML += `
        <tr style="border-top: 2px solid #212529;">
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



    document.getElementById("cartTable").innerHTML = "";
    document.getElementById("confirmAddItemBtn").disabled = true;

    document.getElementById("itemsSelector").classList.add("d-none");
    document.getElementById("cartSection").classList.add("d-none");

});

orderDetailsModal.addEventListener('hidden.bs.modal', () => {
    openItemsBtn.classList.remove("is-active");
    openItemsBtn.classList.remove("btn-warning");
    openItemsBtn.classList.add("btn-success");
    openItemsBtn.innerHTML = `
        <i class="fas fa-plus ms-1"></i> إضافة صنف
    `;
    document.getElementById("itemsSelector").classList.add("d-none");
    document.getElementById('cartSection').classList.add('d-none');
    clearViews();
    setInitialViewForPayment();
});


openItemsBtn.addEventListener("click", async (event) => {
    clearViews();
    const btn = event.currentTarget;
    btn.classList.toggle("is-active");

    if (btn.classList.contains("is-active")) {
        btn.classList.remove("btn-success");
        btn.classList.add("btn-warning");
        btn.innerHTML = `
            <i class="fas fa-times ms-1"></i> إلغاء العملية
        `;
        setInitialViewForPayment();
    } else {
        btn.classList.remove("btn-warning");
        btn.classList.add("btn-success");

        btn.innerHTML = `
            <i class="fas fa-plus ms-1"></i> إضافة صنف
        `;
    }

    document.getElementById("itemsSelector").classList.toggle("d-none");

    document.getElementById('cartSection').classList.toggle('d-none');

    if (mainCategories.length === 0 || items.length === 0) {
        await fetchMenuDetails();
    }
    renderMainCategories();
});


discountInput.addEventListener("input", updateTotals);


async function loadTableOrders() {
    loaderCard.classList.remove('d-none');
    try {
        const res = await fetch(url + '/table/orders', {
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
            tablesData = data.table_orders;
            renderTables(tablesData);
        }
        else {
            bootboxError(data.message);
        }

    } catch (e) {
        bootboxError(e.message);
    }finally{
        loaderCard.classList.add('d-none');
    }
}

async function fetchMenuDetails() {
    try {
        const res = await fetch(url + '/menu/details', {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            }
        });
        const data = await res.json();
        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }

        if (res.status === 200) {
            mainCategories = data.mainCategories;
            items = data.items;
        }
        else {
            bootboxError(data.message);
        }

    } catch (err) {
        bootboxError(err.message);
    } finally {
        removeLoader();
    }
}

async function addNewItems(finalOrder) {
    displaySpinnerLoader();
    if (finalOrder.length === 0) return;
    try {
        const res = await fetch(url + '/order/add-items', {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            body: JSON.stringify(finalOrder),
        });

        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }

        if (res.status === 200) {
            //splitByStation(finalOrder);
            closeModal();
            bootboxSuccess(data.message);
            await loadTableOrders();
        }
        else {
            bootboxError(data.message);
        }

    } catch (err) {
        bootboxError(err.message);
    } finally {
        hiddeSpinnerLoader();
    }
}

async function payOrder(order) {
    displaySpinnerLoader();
    try {
        const res = await fetch(url + '/order/pay', {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            body: JSON.stringify(order),
        });

        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }

        if (res.status === 200) {
            closeModal();
            showSuccessModal();
            // await loadTableOrders();
        }
        else {
            bootboxError(data.message);
        }

    } catch (err) {
        bootboxError(err.message);
    } finally {
        hiddeSpinnerLoader();
    }
}

async function deleteOrder(id) {
    loader.style.display='flex';
    try{
        const res = await fetch(url + `/order/destroy-table?order_id=${id}`, {
            method: 'DELETE',
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
        if (res.status === 200) {
            bootboxSuccess(data.message);
            await loadTableOrders();
        }
        else {
            bootboxError(data.message);
        }

    }catch(e){
        bootboxError(e.message);
    }finally{
        loader.style.display='none';
    }
}
async function moveOrder(tableId, targetTable) {
    loader.style.display='flex';
    try{
         const res = await fetch(url + '/table/move', {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            body: JSON.stringify({
                from : tableId,
                to   : targetTable
            }),
        });
        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }

        if (res.status === 200) {
            bootboxSuccess(data.message);
            await loadTableOrders();
        }
        else {
            bootboxError(data.message);
        }

    }catch(e){
        bootboxError(e.message);
    }finally{
        loader.style.display='none';
    }
}

function splitByStation(orderDetails) {

    const result = {
        kitchen: {
            station : 'فاتورة المطبخ',
            type: 'طاولة',
            note: orderDetails.note,
            table_num: orderDetails.tableNum,
            printer_name : 'kitchen',
            items: []
        },
        bar: { 
            station : 'فاتورة البار',
            type: 'طاولة',
            note: orderDetails.note,
            table_num: orderDetails.tableNum,
            printer_name : 'bar',
            items: [] 
        },
        shisha: { 
            station : 'فاتورة الأراجيل',
            type: 'طاولة',
            note: orderDetails.note,
            table_num: orderDetails.tableNum,
            printer_name : 'shisha',
            items: [] 
        }
    };

    orderDetails.new_items.forEach(item => {
        result[item.station].items.push(item);
    });


    console.log("Order split by station:", result);

}
function updateTotals() {
    const table = getCurrentTable();
    let discount = parseFloat(discountInput.value) || 0;

    if (discount > table.order.total_price) {
        confirmPaymentBtn.disabled = true;
        displayDiscountErrorMessage('خطأ : قيمة الخصم اكبر من السعر الإجمالي');
    }
    else if (discount < 0) {
        confirmPaymentBtn.disabled = true;
        displayDiscountErrorMessage('خطأ : قيمة الخصم لا يمكن ان تكون بالسالب');
    }

    else {
        confirmPaymentBtn.disabled = false;
        hiddeDiscountErrorMessage();

        let before = table.order.total_price;
        let after = table.order.total_price - discount;

        if (after < 0) after = 0;

        beforeEl.innerText = `₪ ${before}`;
        afterEl.innerText = `₪ ${after}`;
    }

}


function getCurrentTable() {
    const table = tablesData.find(t => t.order.id == currentDisplayedOrderId);
    return structuredClone(table);
}

function setInitialViewForPayment() {
    const paymentSection = document.getElementById("paymentSection");
    paymentSection.classList.add("d-none");
    discountInput.value = '';
    confirmPaymentBtn.disabled = false;
    paymentMethod.value = 'كاش';
    hiddeDiscountErrorMessage();
}

function setInitialViewForAddItembtn() {
    openItemsBtn.classList.remove("is-active");
    openItemsBtn.classList.remove("btn-warning");
    openItemsBtn.classList.add("btn-success");

    openItemsBtn.innerHTML = `
        <i class="fas fa-plus ms-1"></i> إضافة صنف
    `;

    document.getElementById("itemsSelector").classList.add("d-none");
    document.getElementById('cartSection').classList.add('d-none');
    clearViews();
}

function displayDiscountErrorMessage(message) {
    const dev = document.getElementById('errorMessageDev');
    const errMessage = document.getElementById('errorMessage');
    errMessage.textContent = message;
    dev.classList.remove('d-none');
}

function hiddeDiscountErrorMessage() {
    const dev = document.getElementById('errorMessageDev');
    dev.classList.add('d-none');
}

function renderTables(tables) {
    const container = document.getElementById("tablesContainer");

    container.innerHTML = "";

    const bootstrapColors = [
        "secondary",
        "success",
        "danger",
        "warning",
        "info",
        "dark"
    ];


    if (tables.length == 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-info text-center">
                    
                <h5>
                    
                    <i class="fa-solid fa-circle-info me-2"></i>
                    لا يوجد طلبات على أي طاولة حالياً 

                </h5> 
                </div>
            </div>
        `;
        return;

    }


    tables.forEach((table, index) => {
        const order = table.order;

        const color = bootstrapColors[index % bootstrapColors.length];

        const card = `
            <div class="col-md-3 col-sm-6 mb-3 table-item">
                <div class="card border-0 shadow-sm text-center table-card">

                    <!-- الجزء الذي يفتح تفاصيل الطلب -->
                    <div class="card-body"
                        data-bs-toggle="modal"
                        data-bs-target="#orderDetailsModal"
                        data-table-id="${table.table_id}"
                        style="cursor:pointer;">

                        <i class="fa-solid fa-chair fa-2x text-${color} mb-2"></i>

                        <div>
                            <span class="badge bg-${color} mb-2">
                                طاولة ${table.table_id}
                            </span>
                        </div>

                        <div class="fw-bold text-${color} mb-2">
                            <span class="text-muted small">الحساب:</span>
                            <span class= 'badge bg-${color}'> ₪ ${order ? order.total_price : 0} </span>
                            
                        </div>

                        <div class="text-muted small mt-2">
                            اضغط لعرض الطلبات
                        </div>
                    </div>

                    <!-- أزرار الإجراءات -->
                    <div class="card-footer bg-white border-0 pt-0 pb-3">
                        <div class="d-grid gap-2 mx-auto" style="max-width: 220px;">

                            <button class="btn btn-outline-primary btn-sm changeTableBtn"
                                data-table-id="${table.table_id}">
                                <i class="fa-solid fa-right-left me-1"></i>
                                نقل الطاولة
                            </button>

                            <button class="btn btn-outline-danger btn-sm deleteTableBtn"
                                data-id="${table.table_id}"
                                data-order-id="${table.order.id}">
                                <i class="fa-solid fa-trash-can me-1"></i>
                                حذف الطلب
                            </button>

                        </div>
                    </div>

                </div>
            </div>
        `;

        container.innerHTML += card;
    });
}




function displaySpinnerLoader() {
    const spinnerLoader = document.getElementById("modal-loading-overlay");
    spinnerLoader.classList.remove('d-none');
}
function hiddeSpinnerLoader() {
    const spinnerLoader = document.getElementById("modal-loading-overlay");
    spinnerLoader.classList.add('d-none');
}



function closeModal() {
    const modal = bootstrap.Modal.getInstance(orderDetailsModal);
    modal.hide();
}

function clearViews() {
    document.getElementById("categoriesBar").innerHTML = "";
    document.getElementById("subCategoriesBar").innerHTML = "";
    document.getElementById("itemsGrid").innerHTML = "";
    const labelIds = ["mainCategoriesLabel", "subCategoriesLabel", "itemsLabel"];
    labelIds.forEach(id => {
        const label = document.getElementById(id);
        if (label) {
            label.remove();
        }
    });

    clearCart();
}


function clearCart() {
    cart = [];
    document.getElementById("cartTable").innerHTML = "";
    document.getElementById("totalPrice").innerText = "0";
    updateConfirmButton();
}

function removeLoader() {
    document.getElementById('itemsLoading').remove();
}

function showSuccessModal() {
    const modal = new bootstrap.Modal(successModelOrder);
    modal.show();
}

function closeSuccessModal() {
    bootstrap.Modal.getInstance(successModelOrder).hide();
}

/* ===========================
    MAIN CATEGORIES
=========================== */

function renderMainCategories() {



    const bar = document.getElementById("categoriesBar");

    if (!document.getElementById("mainCategoriesLabel")) {
        const label = document.createElement("label");
        label.id = "mainCategoriesLabel";
        label.textContent = "اختر قسم *";
        label.className = "fw-light small text-muted mb-1";

        bar.parentNode.insertBefore(label, bar);
    }

    bar.innerHTML = mainCategories.map(main => `

        <button
            class="btn btn-outline-primary btn-sm main-category-btn"
            data-id="${main.id}"
        >

            ${main.name}

        </button>

    `).join("");


    document.querySelectorAll(".main-category-btn").forEach(btn => {

        btn.addEventListener("click", function () {

            document.querySelectorAll(".main-category-btn").forEach(b => {
                b.classList.remove("active");
            });

            this.classList.add("active");




            selectMainCategory(this.dataset.id);

        });

    });

}


/* ===========================
    MAIN CATEGORY CLICK
=========================== */

function selectMainCategory(mainCategoryId) {

    const mainCategory = mainCategories.find(
        c => c.id == mainCategoryId
    );

    if (!mainCategory) return;

    const bar = document.getElementById("subCategoriesBar");


    if (!document.getElementById("subCategoriesLabel")) {
        const label = document.createElement("label");
        label.id = "subCategoriesLabel";
        label.textContent = "اختر فئة *";
        label.className = "fw-light small text-muted mb-1";

        bar.parentNode.insertBefore(label, bar);
    }

    bar.innerHTML = mainCategory.categories.map(category => `

        <button
            class="btn btn-outline-success btn-sm sub-category-btn"
            data-id="${category.id}"
        >

            ${category.name}

        </button>

    `).join("");


    document.querySelectorAll(".sub-category-btn").forEach(btn => {

        btn.addEventListener("click", function () {

            document.querySelectorAll(".sub-category-btn").forEach(b => {
                b.classList.remove("active");
            });

            this.classList.add("active");

            selectCategory(this.dataset.id);

        });

    });


    // تنظيف الأصناف
    document.getElementById("itemsGrid").innerHTML = "";


    // اختيار أول فئة تلقائياً
    // if (mainCategory.categories.length > 0) {

    //     selectCategory(mainCategory.categories[0].id);

    // }

}


/* ===========================
    CATEGORY CLICK
=========================== */

function selectCategory(categoryId) {

    const filteredItems = items.filter(item => {

        return item.category_id == categoryId;

    });

    renderItems(filteredItems);

}


/* ===========================
    ITEMS
=========================== */




function renderItems(filteredItems) {
    const container = document.getElementById("itemsGrid");

    if (!document.getElementById("itemsLabel")) {
        const label = document.createElement("label");
        label.id = "itemsLabel";
        label.textContent = "اختر صنف *";
        label.className = "fw-light small text-muted mb-1";

        container.parentNode.insertBefore(label, container);
    }

    container.innerHTML = filteredItems.map(item => {

        // إذا عنده sizes → dropdown
        if (item.sizes && item.sizes.length > 0) {

            return `
            <div class="dropdown d-inline-block m-1 item-dropdown">

                <button class="btn btn-outline-primary btn-sm dropdown-toggle"
                        data-bs-toggle="dropdown">
                    ${item.name}
                </button>

                <ul class="dropdown-menu">

                    ${item.sizes.map(size => `
                        <li dir="ltr">
                            <button class="dropdown-item add-size-btn"
                                    data-id="${item.id}"
                                    data-size="${size.id}"
                                    >
                                ${size.name} - ${size.price} ₪
                            </button>
                        </li>
                    `).join("")}

                </ul>

            </div>
            `;
        }

        // بدون sizes → زر مباشر
        return `
        <button class="btn btn-outline-primary btn-sm m-1 add-item-btn"
            data-id="${item.id}"
            >
            ${item.name}
        </button>
        `;

    }).join("");

}

/* ===========================
    ADD ITEM
=========================== */

function addItemToOrder(itemId, sizeId = 0) {

    const item = items.find(i => i.id == itemId);

    if (!item) return;


    if (sizeId > 0) {
        const size = item.sizes.find(s => s.id === sizeId);
        addToCart({
            id: item.id,
            name: item.name + ' - ' + size.name,
            price: size.price,
            station: item.station,
            qty: 1,
            sizeindex: size.id
        });

        return;
    }

    addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        station: item.station,
        qty: 1,
        sizeindex: 0
    });

}


/* ===========================
    CART
=========================== */

function addToCart(item) {
    const existing = cart.find(i => {

        return (
            i.id == item.id
            &&
            (item.sizeindex > 0 ? i.sizeindex === item.sizeindex : true)
        );

    });

    if (existing) {
        existing.qty++;
    }

    else {
        cart.push(item);
        updateConfirmButton();
    }
    renderCart();

}


/* ===========================
    CART RENDER
=========================== */

function renderCart() {

    const table = document.getElementById("cartTable");

    table.innerHTML = cart.map(item => `

        <tr>

            <td class="text-center align-middle nowrap-cell">${item.name}</td>

            <td class="text-center align-middle">${item.qty}</td>

            <td class="text-center align-middle">${item.price}</td>

            <td class="text-center align-middle">${item.qty * item.price}</td>

            <td class="d-flex justify-content-center align-items-center p-2">
                <button class="remove-item btn-sm delete-item-btn" data-id="${item.id}" data-sizeindex="${item.sizeindex}">
                    <i class="fa fa-xmark"></i>
                </button>
            </td>
        </tr>

    `).join("");


    handelTotalPrice();

}


/* ===========================
    TOTAL
=========================== */

function handelTotalPrice() {

    const total = calculateTotalPrice();


    document.getElementById("totalPrice").innerText = total;

}


function calculateTotalPrice() {
    let total = 0;

    cart.forEach(item => {

        total += item.price * item.qty;

    });

    return total;

}

function deleteItemFromCart(itemId, sizeindex) {

    const index = cart.findIndex(i => i.id == itemId && i.sizeindex == sizeindex);
    if (index !== -1) {
        cart.splice(index, 1);
        renderCart();
    }

    updateConfirmButton();
}




function updateConfirmButton() {
    const btn = document.getElementById("confirmAddItemBtn");

    const hasItems = cart.length > 0;

    btn.disabled = !hasItems;
}




function bootboxTableAction({
    title,
    message,
    currentTable,
    confirmText,
    confirmClass = "btn-primary",
    placeholder = "أدخل رقم الطاولة",
    onConfirm
}) {

    const dialog = bootbox.dialog({
        title: `
            <div class="d-flex align-items-center">
                <i class="fa-solid fa-circle-exclamation text-warning me-2 fs-4"></i>
                <span>${title}</span>
            </div>
        `,
        message: `
            <div class="text-center">

                <p class="mb-2">${message}</p>

                <div class="alert alert-light border mb-3">
                    <strong>الطاولة الحالية:</strong>
                    ${currentTable}
                </div>

                <input
                    id="targetTable"
                    type="number"
                    min="1"
                    class="form-control text-center"
                    placeholder="${placeholder}">
            </div>
        `,
        buttons: {
            cancel: {
                label: "إلغاء",
                className: "btn-secondary"
            },
            confirm: {
                label: confirmText,
                className: confirmClass,
                callback: async function () {

                    const targetTable = Number($("#targetTable").val());

                    if (!targetTable) {
                        $("#targetTable").addClass("is-invalid");
                        return false;
                    }

                  await  onConfirm(targetTable);
                }
            }
        }
    });

    dialog.init(() => {
        $("#targetTable").trigger("focus");
    });
}



function showPayOrderDialog(order) {

    bootbox.dialog({
        title: '<i class="fas fa-cash-register me-2"></i> تسديد الطاولة',

        message: `
            <div class="container-fluid">

                <div class="row mb-2">
                    <div class="col-6 fw-bold">طريقة الدفع</div>
                    <div class="col-6 text-end fw-bold">${order.payment_method}</div>
                </div>

                <hr>

                <div class="row mb-2">
                    <div class="col-6 fw-bold">السعر الأساسي</div>
                    <div class="col-6 text-end fw-bold"> ₪ ${order.total_price + order.new_discount} </div>
                </div>

                <div class="row mb-2">
                    <div class="col-6 fw-bold">الخصم</div>
                    <div class="col-6 text-end fw-bold">₪ ${order.new_discount} </div>
                </div>

                <hr>

                <div class="row">
                    <div class="col-6 fw-bold text-success fs-5">الإجمالي</div>
                    <div class="col-6 text-end fs-5 text-success fw-bold">
                        ₪ ${order.total_price} 
                    </div>
                </div>

            </div>
        `,
        buttons: {

            cancel: {
                label: "إلغاء",
                className: "btn-secondary"
            },
            

            confirm: {
                label: '<i class="fas fa-check me-1"></i> تسديد',
                className: "btn-success fw-bold",

                callback: async function () {
                    await payOrder(order);
                    return false;
                }
            }

        }
    });

}

function showConfirmAddItemsDialog(finalOrder) {
       const itemsHtml = finalOrder.new_items.map(item => `
        <tr>
            <td class="text-center">${item.name}</td>
            <td class="text-center">${item.qty}</td>
            <td class="text-center">₪ ${item.price}</td>
            <td class="text-center fw-bold">₪ ${item.qty * item.price}</td>
        </tr>
    `).join('');


    bootbox.dialog({

        title: '<i class="fas fa-cart-plus me-2"></i> تأكيد إضافة أصناف',
        message: `
            <div class="container-fluid">

                <div class="text-center mb-4">
                    <i class="fas fa-circle-question text-warning fs-1 mb-3"></i>

                    <p class="mb-0 fw-bold">
                        هل أنت متأكد من إضافة الأصناف الجديدة إلى الطلب؟
                    </p>
                </div>

                <hr>
                <div style="max-height:250px; overflow:auto;">

                    <table class="table table-sm table-bordered text-center align-middle">

                        <thead class="table-light">
                            <tr>
                                <th>الصنف</th>
                                <th>الكمية</th>
                                <th>السعر</th>
                                <th>الإجمالي</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${itemsHtml}
                        </tbody>

                    </table>

                </div>

                <hr>

                <div class="row">
                    <div class="col-6 fw-bold text-success fs-5">
                        إجمالي الإضافة
                    </div>

                    <div class="col-6 text-end text-success fw-bold fs-5">
                        ₪ ${finalOrder.total_price}
                    </div>
                </div>

            </div>
        `,

        buttons: {

            cancel: {
                label: "إلغاء",
                className: "btn-secondary"
            },

            confirm: {
                label: '<i class="fas fa-check me-1"></i> تأكيد الإضافة',
                className: "btn-success fw-bold",

                callback: async function () {
                    await addNewItems(finalOrder);
                    return false;
                }
            }

        }

    });

}