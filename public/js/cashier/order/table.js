// import { showAuthExpired, setActiveNavLink, showPrintLoader, hidePrintLoader, bootboxError, bootboxSuccess } from "../../../component/bootbox.js";
// import { url, urlServer } from "../../../api/urlEndPoint.js";
// import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
// import { bootboxLoginAsAdmin, closeSideBar, SwitchToAdmin } from "../Switch-user-functionality.js";
// import { handelOrderDatabeforPrinting } from "../../../component/invoices.js";
// import { formatDateOnly, formatTimeOnly, utcToPalestine } from "../../admin/report/shared-functionality.js";

// const header = document.querySelector("site-header");

// const orderDetailsModal = document.getElementById('orderDetailsModal');
// const openItemsBtn = document.getElementById("openItemsBtn");

// const discountInput = document.getElementById("discountAmount");
// const beforeEl = document.getElementById("beforeDiscountTotal");
// const afterEl = document.getElementById("afterDiscountTotal");
// const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
// const paymentMethod = document.getElementById('paymentMethod');

// const loader = document.getElementById('overlay_loader');
// const successModelOrder = document.getElementById('successModal');
// const loaderCard        = document.getElementById('loaderCard');

// let tablesData;
// let currentDisplayedOrderId;
// let currentPaymentOrder;
// let mainCategories = [];
// let items = [];
// let cart = [];


// class SiteHeader extends HTMLElement {
//     async connectedCallback() {
//         const res = await fetch('../component/header.html');
//         this.innerHTML = await res.text();

//         this.dispatchEvent(
//             new CustomEvent("header:ready", {
//                 bubbles: true
//             })
//         );
//     }
// }
// customElements.define("site-header", SiteHeader);

// header.addEventListener("header:ready", () => {
//     setActiveNavLink();

//     const logoutFrom = document.getElementById('logoutForm');
//     logoutFrom.addEventListener("submit", async function (e) {
//         e.preventDefault();
//         closeSideBar();
//         bootbox.confirm({
//             title: "تسجيل الخروج",
//             message: "هل أنت متأكد من تسجيل الخروج؟",
//             buttons: {
//                 confirm: {
//                     label: "نعم",
//                 },
//                 cancel: {
//                     label: "إلغاء",
//                 },
//             },
//             callback: function (result) {
//                 if (!result) return;

//                 removeAuthToken();
//                 window.location.href = "../../mainWindow.html";
//             },
//         });
//     });

// });


// document.addEventListener('DOMContentLoaded', async function () {
//     await loadTableOrders();
// });


// document.addEventListener("click", async function (e) {
//     if (e.target.closest('.add-item-btn')) {
//         const btn = e.target.closest('.add-item-btn');
//         const itemId = Number(btn.dataset.id);
//         addItemToOrder(itemId);
//     }

//     else if (e.target.closest('.add-size-btn')) {
//         const btn = e.target.closest('.add-size-btn');
//         const itemId = Number(btn.dataset.id);
//         const sizeId = Number(btn.dataset.size);
//         addItemToOrder(itemId, sizeId);
//     }

//     else if (e.target.closest('.delete-item-btn')) {
//         const btn = e.target.closest('.delete-item-btn');

//         const itemId = Number(btn.dataset.id);
//         const sizeindex = Number(btn.dataset.sizeindex);
//         deleteItemFromCart(itemId, sizeindex);
//     }

//     else if (e.target.closest('.update-order-btn')) {
//         const total = calculateTotalPrice();
//         const note = document.getElementById('orderNotes').value.trim();
//         const table = getCurrentTable();

//         let finalOrder = {
//             tableNum: table.table_id,
//             order_id: currentDisplayedOrderId,
//             total_price: total,
//             new_items: cart,
//             note: note
//         };
//         showConfirmAddItemsDialog(finalOrder);        
//     }

//     // فتح قسم الدفع
//     else if (e.target.closest(".paymentBtn")) {
//         const paymentSection = document.getElementById("paymentSection");
//         paymentSection.classList.toggle("d-none");

//         if (!paymentSection.classList.contains('d-none')) {
//             setInitialViewForAddItembtn();
//         }

//         const table = getCurrentTable();

//         document.getElementById('beforeDiscountTotal').textContent = `₪ ${table.order.total_price}`;
//         document.getElementById('afterDiscountTotal').textContent = `₪ ${table.order.total_price}`;


//     }

//     else if (e.target.closest(".confirmPaymentBtn")) {
//         const currentClosedTable = getCurrentTable();

//         currentPaymentOrder = {
//             invoice_num    : currentClosedTable.order.invoice_num,
//             time           : formatTimeOnly(utcToPalestine(currentClosedTable.order.created_at)),
//             date           : formatDateOnly(utcToPalestine(currentClosedTable.order.created_at)),
//             payment_method : paymentMethod.value,
//             type           : 'طاولة',
//             total_price    : currentClosedTable.order.total_price - Number(discountInput.value),
//             discount       : currentClosedTable.order.discount + Number(discountInput.value),
//             new_discount   : Number(discountInput.value),
//             table_num      : currentClosedTable.table_id,
//             order_id       : currentClosedTable.order.id,
//             items          : currentClosedTable.order.items
//         }
//         showPayOrderDialog(currentPaymentOrder);
//         //await payOrder(currentPaymentOrder);
//     }

//     else if (e.target.closest('.deleteTableBtn')) {
//         const btn = e.target.closest(".deleteTableBtn");
//         const tableId = Number(btn.dataset.id);
//         const orderId = Number(btn.dataset.orderId);
//         bootboxTableAction({
//             title: "حذف الطلب",
//             message: `
//             <div class="text-danger fw-bold mb-2">
//                 سيتم حذف الطلب نهائياً, وإغلاق الطاولة.
//             </div>
//             أدخل رقم الطاولة للتأكيد.
//         `,
//             currentTable: tableId,
//             confirmText: "حذف",
//             confirmClass: "btn-danger",

//             onConfirm(targetTable) {

//                 if (targetTable != tableId) {
//                     bootbox.alert("رقم الطاولة غير صحيح");
//                     return;
//                 }

//                 deleteOrder(orderId);
//             }
//         });
//     }
//     else if (e.target.closest('.changeTableBtn')) {
//         const btn = e.target.closest(".changeTableBtn");
//         const tableId = Number(btn.dataset.tableId);

//         bootboxTableAction({
//             title: "نقل الطاولة",
//             message: `
//             أدخل رقم الطاولة الجديدة التي تريد نقل الطلب إليها.
//         `,
//             currentTable: tableId,
//             placeholder: "رقم الطاولة الجديدة",
//             confirmText: "نقل",
//             confirmClass: "btn-primary",

//             onConfirm(targetTable) {
//                 const newTable = Number(targetTable);
//                 const currentTable = Number(tableId);

//                 if (newTable === currentTable) {
//                     bootbox.alert({
//                         title: "خطأ",
//                         message: `
//                             <div class="text-danger fw-bold">
//                                 لا يمكنك نقل الطلب إلى نفس الطاولة الحالية (${currentTable})
//                             </div>
//                         `
//                     });
//                     return;
//                 }

//                 if (!newTable || newTable <= 0) {
//                     bootbox.alert("يرجى إدخال رقم طاولة صحيح");
//                     return;
//                 }
//                 moveOrder(tableId, targetTable);
//             }
//         });
//     }

//     else if (e.target.closest('.close-success-modal')) {
//         const btn = e.target.closest(".close-success-modal");
//         closeSuccessModal();
//         await loadTableOrders();
//     }

//     else if (e.target.closest('.print-invoice-btn')) {
//         closeSuccessModal();
//         showPrintLoader();
//         try{
//             await handelOrderDatabeforPrinting(currentPaymentOrder);
//         }catch(e){
//             bootboxError(e.message);
//         }finally{
//             hidePrintLoader();
//             await loadTableOrders();
//         }
//     }

//     else if (e.target.closest('.switch-admin-btn')) {
//         const input = document.getElementById('adminPassword');
//         await SwitchToAdmin(url, input.value);
//     }

// });

// orderDetailsModal.addEventListener('show.bs.modal', function (event) {

//     const button = event.relatedTarget;
//     const tableId = Number(button.getAttribute('data-table-id'));

//     const table = tablesData.find(t => t.table_id == tableId);

//     if (!table || !table.order) return;

//     const order = table.order;

//     currentDisplayedOrderId = Number(order.id);

//     document.getElementById("modalOrderId").textContent = tableId || "-";

//     document.getElementById("modaltime").textContent = formatTimeOnly(utcToPalestine(order.created_at));;


//     const itemsBody = document.getElementById("modalItemsTable");
//     itemsBody.innerHTML = "";


//     (order.items || []).forEach(item => {
//         const displayName = item.size_name !== 'NaN'
//             ? `${item?.item_name || 'تم حذف الصنف'} - ${item.size_name}`
//             : item?.item_name || 'تم حذف الصنف';


//         itemsBody.innerHTML += `
//             <tr>
//                 <td>${displayName}</td>
//                 <td>${item.quantity}</td>
//                 <td>${item.price} ₪</td>
//                 <td class="fw-bold">${item.price * item.quantity} ₪</td>
//             </tr>
//         `;
//     });

//     itemsBody.innerHTML += `
//         <tr style="border-top: 2px solid #212529;">
//             <td colspan="3" class="text-end pe-3">
//                 <strong>المجموع</strong>
//             </td>
//             <td>
//                 <strong>${order.total_price + order.discount} ₪</strong>
//             </td>
//         </tr>

//         <tr>
//             <td colspan="3" class="text-end pe-3 text-danger">
//                 <strong>الخصم</strong>
//             </td>
//             <td class="text-danger">
//                 <strong>${order.discount} ₪</strong>
//             </td>
//         </tr>

//         <tr class="table-success">
//             <td colspan="3" class="text-end pe-3">
//                 <strong>الإجمالي</strong>
//             </td>
//             <td>
//                 <strong>${order.total_price} ₪</strong>
//             </td>
//         </tr>
//     `;



//     document.getElementById("cartTable").innerHTML = "";
//     document.getElementById("confirmAddItemBtn").disabled = true;

//     document.getElementById("itemsSelector").classList.add("d-none");
//     document.getElementById("cartSection").classList.add("d-none");

// });

// orderDetailsModal.addEventListener('hidden.bs.modal', () => {
//     openItemsBtn.classList.remove("is-active");
//     openItemsBtn.classList.remove("btn-warning");
//     openItemsBtn.classList.add("btn-success");
//     openItemsBtn.innerHTML = `
//         <i class="fas fa-plus ms-1"></i> إضافة صنف
//     `;
//     document.getElementById("itemsSelector").classList.add("d-none");
//     document.getElementById('cartSection').classList.add('d-none');
//     clearViews();
//     setInitialViewForPayment();
// });


// openItemsBtn.addEventListener("click", async (event) => {
//     clearViews();
//     const btn = event.currentTarget;
//     btn.classList.toggle("is-active");

//     if (btn.classList.contains("is-active")) {
//         btn.classList.remove("btn-success");
//         btn.classList.add("btn-warning");
//         btn.innerHTML = `
//             <i class="fas fa-times ms-1"></i> إلغاء العملية
//         `;
//         setInitialViewForPayment();
//     } else {
//         btn.classList.remove("btn-warning");
//         btn.classList.add("btn-success");

//         btn.innerHTML = `
//             <i class="fas fa-plus ms-1"></i> إضافة صنف
//         `;
//     }

//     document.getElementById("itemsSelector").classList.toggle("d-none");

//     document.getElementById('cartSection').classList.toggle('d-none');

//     if (mainCategories.length === 0 || items.length === 0) {
//         await fetchMenuDetails();
//     }
//     renderMainCategories();
// });


// discountInput.addEventListener("input", updateTotals);


// async function loadTableOrders() {
//     loaderCard.classList.remove('d-none');
//     try {
//         const res = await fetch(url + '/table/orders', {
//             method: 'GET',
//             headers: {
//                 "Content-Type": "application/json",
//                 "Authorization": `${getAuthToken('user-auth')}`
//             },
//         });

//         const data = await res.json();
//         if (res.status === 401) {
//             showAuthExpired(data.message);
//             return;
//         }
//         else if (res.status === 200) {
//             tablesData = data.table_orders;
//             renderTables(tablesData);
//         }
//         else {
//             bootboxError(data.message);
//         }

//     } catch (e) {
//         bootboxError(e.message);
//     }finally{
//         loaderCard.classList.add('d-none');
//     }
// }

// async function fetchMenuDetails() {
//     try {
//         const res = await fetch(url + '/menu/details', {
//             method: 'GET',
//             headers: {
//                 "Content-Type": "application/json",
//                 "Authorization": `${getAuthToken('user-auth')}`
//             }
//         });
//         const data = await res.json();
//         if (res.status === 401) {
//             showAuthExpired(data.message);
//             return;
//         }

//         if (res.status === 200) {
//             mainCategories = data.mainCategories;
//             items = data.items;
//         }
//         else {
//             bootboxError(data.message);
//         }

//     } catch (err) {
//         bootboxError(err.message);
//     } finally {
//         removeLoader();
//     }
// }

// async function addNewItems(finalOrder) {
//     displaySpinnerLoader();
//     if (finalOrder.length === 0) return;
//     try {
//         const res = await fetch(url + '/order/add-items', {
//             method: 'PUT',
//             headers: {
//                 "Content-Type": "application/json",
//                 "Authorization": `${getAuthToken('user-auth')}`
//             },
//             body: JSON.stringify(finalOrder),
//         });

//         const data = await res.json();

//         if (res.status === 401) {
//             showAuthExpired(data.message);
//             return;
//         }

//         if (res.status === 200) {
//             //splitByStation(finalOrder);
//             closeModal();
//             bootboxSuccess(data.message);
//             await loadTableOrders();
//         }
//         else {
//             bootboxError(data.message);
//         }

//     } catch (err) {
//         bootboxError(err.message);
//     } finally {
//         hiddeSpinnerLoader();
//     }
// }

// async function payOrder(order) {
//     displaySpinnerLoader();
//     try {
//         const res = await fetch(url + '/order/pay', {
//             method: 'PUT',
//             headers: {
//                 "Content-Type": "application/json",
//                 "Authorization": `${getAuthToken('user-auth')}`
//             },
//             body: JSON.stringify(order),
//         });

//         const data = await res.json();

//         if (res.status === 401) {
//             showAuthExpired(data.message);
//             return;
//         }

//         if (res.status === 200) {
//             closeModal();
//             showSuccessModal();
//             // await loadTableOrders();
//         }
//         else {
//             bootboxError(data.message);
//         }

//     } catch (err) {
//         bootboxError(err.message);
//     } finally {
//         hiddeSpinnerLoader();
//     }
// }

// async function deleteOrder(id) {
//     loader.style.display='flex';
//     try{
//         const res = await fetch(url + `/order/destroy-table?order_id=${id}`, {
//             method: 'DELETE',
//             headers: {
//                 "Content-Type": "application/json",
//                 "Authorization": `${getAuthToken('user-auth')}`
//             },
//         });
//         const data = await res.json();

//         if (res.status === 401) {
//             showAuthExpired(data.message);
//             return;
//         }
//         if (res.status === 200) {
//             bootboxSuccess(data.message);
//             await loadTableOrders();
//         }
//         else {
//             bootboxError(data.message);
//         }

//     }catch(e){
//         bootboxError(e.message);
//     }finally{
//         loader.style.display='none';
//     }
// }
// async function moveOrder(tableId, targetTable) {
//     loader.style.display='flex';
//     try{
//          const res = await fetch(url + '/table/move', {
//             method: 'PUT',
//             headers: {
//                 "Content-Type": "application/json",
//                 "Authorization": `${getAuthToken('user-auth')}`
//             },
//             body: JSON.stringify({
//                 from : tableId,
//                 to   : targetTable
//             }),
//         });
//         const data = await res.json();

//         if (res.status === 401) {
//             showAuthExpired(data.message);
//             return;
//         }

//         if (res.status === 200) {
//             bootboxSuccess(data.message);
//             await loadTableOrders();
//         }
//         else {
//             bootboxError(data.message);
//         }

//     }catch(e){
//         bootboxError(e.message);
//     }finally{
//         loader.style.display='none';
//     }
// }

// function splitByStation(orderDetails) {

//     const result = {
//         kitchen: {
//             station : 'فاتورة المطبخ',
//             type: 'طاولة',
//             note: orderDetails.note,
//             table_num: orderDetails.tableNum,
//             printer_name : 'kitchen',
//             items: []
//         },
//         bar: { 
//             station : 'فاتورة البار',
//             type: 'طاولة',
//             note: orderDetails.note,
//             table_num: orderDetails.tableNum,
//             printer_name : 'bar',
//             items: [] 
//         },
//         shisha: { 
//             station : 'فاتورة الأراجيل',
//             type: 'طاولة',
//             note: orderDetails.note,
//             table_num: orderDetails.tableNum,
//             printer_name : 'shisha',
//             items: [] 
//         }
//     };

//     orderDetails.new_items.forEach(item => {
//         result[item.station].items.push(item);
//     });


//     console.log("Order split by station:", result);

// }
// function updateTotals() {
//     const table = getCurrentTable();
//     let discount = parseFloat(discountInput.value) || 0;

//     if (discount > table.order.total_price) {
//         confirmPaymentBtn.disabled = true;
//         displayDiscountErrorMessage('خطأ : قيمة الخصم اكبر من السعر الإجمالي');
//     }
//     else if (discount < 0) {
//         confirmPaymentBtn.disabled = true;
//         displayDiscountErrorMessage('خطأ : قيمة الخصم لا يمكن ان تكون بالسالب');
//     }

//     else {
//         confirmPaymentBtn.disabled = false;
//         hiddeDiscountErrorMessage();

//         let before = table.order.total_price;
//         let after = table.order.total_price - discount;

//         if (after < 0) after = 0;

//         beforeEl.innerText = `₪ ${before}`;
//         afterEl.innerText = `₪ ${after}`;
//     }

// }


// function getCurrentTable() {
//     const table = tablesData.find(t => t.order.id == currentDisplayedOrderId);
//     return structuredClone(table);
// }

// function setInitialViewForPayment() {
//     const paymentSection = document.getElementById("paymentSection");
//     paymentSection.classList.add("d-none");
//     discountInput.value = '';
//     confirmPaymentBtn.disabled = false;
//     paymentMethod.value = 'كاش';
//     hiddeDiscountErrorMessage();
// }

// function setInitialViewForAddItembtn() {
//     openItemsBtn.classList.remove("is-active");
//     openItemsBtn.classList.remove("btn-warning");
//     openItemsBtn.classList.add("btn-success");

//     openItemsBtn.innerHTML = `
//         <i class="fas fa-plus ms-1"></i> إضافة صنف
//     `;

//     document.getElementById("itemsSelector").classList.add("d-none");
//     document.getElementById('cartSection').classList.add('d-none');
//     clearViews();
// }

// function displayDiscountErrorMessage(message) {
//     const dev = document.getElementById('errorMessageDev');
//     const errMessage = document.getElementById('errorMessage');
//     errMessage.textContent = message;
//     dev.classList.remove('d-none');
// }

// function hiddeDiscountErrorMessage() {
//     const dev = document.getElementById('errorMessageDev');
//     dev.classList.add('d-none');
// }

// function renderTables(tables) {
//     const container = document.getElementById("tablesContainer");

//     container.innerHTML = "";

//     const bootstrapColors = [
//         "secondary",
//         "success",
//         "danger",
//         "warning",
//         "info",
//         "dark"
//     ];


//     if (tables.length == 0) {
//         container.innerHTML = `
//             <div class="col-12">
//                 <div class="alert alert-info text-center">
                    
//                 <h5>
                    
//                     <i class="fa-solid fa-circle-info me-2"></i>
//                     لا يوجد طلبات على أي طاولة حالياً 

//                 </h5> 
//                 </div>
//             </div>
//         `;
//         return;

//     }


//     tables.forEach((table, index) => {
//         const order = table.order;

//         const color = bootstrapColors[index % bootstrapColors.length];

//         const card = `
//             <div class="col-md-3 col-sm-6 mb-3 table-item">
//                 <div class="card border-0 shadow-sm text-center table-card">

//                     <!-- الجزء الذي يفتح تفاصيل الطلب -->
//                     <div class="card-body"
//                         data-bs-toggle="modal"
//                         data-bs-target="#orderDetailsModal"
//                         data-table-id="${table.table_id}"
//                         style="cursor:pointer;">

//                         <i class="fa-solid fa-chair fa-2x text-${color} mb-2"></i>

//                         <div>
//                             <span class="badge bg-${color} mb-2">
//                                 طاولة ${table.table_id}
//                             </span>
//                         </div>

//                         <div class="fw-bold text-${color} mb-2">
//                             <span class="text-muted small">الحساب:</span>
//                             <span class= 'badge bg-${color}'> ₪ ${order ? order.total_price : 0} </span>
                            
//                         </div>

//                         <div class="text-muted small mt-2">
//                             اضغط لعرض الطلبات
//                         </div>
//                     </div>

//                     <!-- أزرار الإجراءات -->
//                     <div class="card-footer bg-white border-0 pt-0 pb-3">
//                         <div class="d-grid gap-2 mx-auto" style="max-width: 220px;">

//                             <button class="btn btn-outline-primary btn-sm changeTableBtn"
//                                 data-table-id="${table.table_id}">
//                                 <i class="fa-solid fa-right-left me-1"></i>
//                                 نقل الطاولة
//                             </button>

//                             <button class="btn btn-outline-danger btn-sm deleteTableBtn"
//                                 data-id="${table.table_id}"
//                                 data-order-id="${table.order.id}">
//                                 <i class="fa-solid fa-trash-can me-1"></i>
//                                 حذف الطلب
//                             </button>

//                         </div>
//                     </div>

//                 </div>
//             </div>
//         `;

//         container.innerHTML += card;
//     });
// }




// function displaySpinnerLoader() {
//     const spinnerLoader = document.getElementById("modal-loading-overlay");
//     spinnerLoader.classList.remove('d-none');
// }
// function hiddeSpinnerLoader() {
//     const spinnerLoader = document.getElementById("modal-loading-overlay");
//     spinnerLoader.classList.add('d-none');
// }



// function closeModal() {
//     const modal = bootstrap.Modal.getInstance(orderDetailsModal);
//     modal.hide();
// }

// function clearViews() {
//     document.getElementById("categoriesBar").innerHTML = "";
//     document.getElementById("subCategoriesBar").innerHTML = "";
//     document.getElementById("itemsGrid").innerHTML = "";
//     const labelIds = ["mainCategoriesLabel", "subCategoriesLabel", "itemsLabel"];
//     labelIds.forEach(id => {
//         const label = document.getElementById(id);
//         if (label) {
//             label.remove();
//         }
//     });

//     clearCart();
// }


// function clearCart() {
//     cart = [];
//     document.getElementById("cartTable").innerHTML = "";
//     document.getElementById("totalPrice").innerText = "0";
//     updateConfirmButton();
// }

// function removeLoader() {
//     document.getElementById('itemsLoading').remove();
// }

// function showSuccessModal() {
//     const modal = new bootstrap.Modal(successModelOrder);
//     modal.show();
// }

// function closeSuccessModal() {
//     bootstrap.Modal.getInstance(successModelOrder).hide();
// }

// /* ===========================
//     MAIN CATEGORIES
// =========================== */

// function renderMainCategories() {



//     const bar = document.getElementById("categoriesBar");

//     if (!document.getElementById("mainCategoriesLabel")) {
//         const label = document.createElement("label");
//         label.id = "mainCategoriesLabel";
//         label.textContent = "اختر قسم *";
//         label.className = "fw-light small text-muted mb-1";

//         bar.parentNode.insertBefore(label, bar);
//     }

//     bar.innerHTML = mainCategories.map(main => `

//         <button
//             class="btn btn-outline-primary btn-sm main-category-btn"
//             data-id="${main.id}"
//         >

//             ${main.name}

//         </button>

//     `).join("");


//     document.querySelectorAll(".main-category-btn").forEach(btn => {

//         btn.addEventListener("click", function () {

//             document.querySelectorAll(".main-category-btn").forEach(b => {
//                 b.classList.remove("active");
//             });

//             this.classList.add("active");




//             selectMainCategory(this.dataset.id);

//         });

//     });

// }


// /* ===========================
//     MAIN CATEGORY CLICK
// =========================== */

// function selectMainCategory(mainCategoryId) {

//     const mainCategory = mainCategories.find(
//         c => c.id == mainCategoryId
//     );

//     if (!mainCategory) return;

//     const bar = document.getElementById("subCategoriesBar");


//     if (!document.getElementById("subCategoriesLabel")) {
//         const label = document.createElement("label");
//         label.id = "subCategoriesLabel";
//         label.textContent = "اختر فئة *";
//         label.className = "fw-light small text-muted mb-1";

//         bar.parentNode.insertBefore(label, bar);
//     }

//     bar.innerHTML = mainCategory.categories.map(category => `

//         <button
//             class="btn btn-outline-success btn-sm sub-category-btn"
//             data-id="${category.id}"
//         >

//             ${category.name}

//         </button>

//     `).join("");


//     document.querySelectorAll(".sub-category-btn").forEach(btn => {

//         btn.addEventListener("click", function () {

//             document.querySelectorAll(".sub-category-btn").forEach(b => {
//                 b.classList.remove("active");
//             });

//             this.classList.add("active");

//             selectCategory(this.dataset.id);

//         });

//     });


//     // تنظيف الأصناف
//     document.getElementById("itemsGrid").innerHTML = "";


//     // اختيار أول فئة تلقائياً
//     // if (mainCategory.categories.length > 0) {

//     //     selectCategory(mainCategory.categories[0].id);

//     // }

// }


// /* ===========================
//     CATEGORY CLICK
// =========================== */

// function selectCategory(categoryId) {

//     const filteredItems = items.filter(item => {

//         return item.category_id == categoryId;

//     });

//     renderItems(filteredItems);

// }


// /* ===========================
//     ITEMS
// =========================== */




// function renderItems(filteredItems) {
//     const container = document.getElementById("itemsGrid");

//     if (!document.getElementById("itemsLabel")) {
//         const label = document.createElement("label");
//         label.id = "itemsLabel";
//         label.textContent = "اختر صنف *";
//         label.className = "fw-light small text-muted mb-1";

//         container.parentNode.insertBefore(label, container);
//     }

//     container.innerHTML = filteredItems.map(item => {

//         // إذا عنده sizes → dropdown
//         if (item.sizes && item.sizes.length > 0) {

//             return `
//             <div class="dropdown d-inline-block m-1 item-dropdown">

//                 <button class="btn btn-outline-primary btn-sm dropdown-toggle"
//                         data-bs-toggle="dropdown">
//                     ${item.name}
//                 </button>

//                 <ul class="dropdown-menu">

//                     ${item.sizes.map(size => `
//                         <li dir="ltr">
//                             <button class="dropdown-item add-size-btn"
//                                     data-id="${item.id}"
//                                     data-size="${size.id}"
//                                     >
//                                 ${size.name} - ${size.price} ₪
//                             </button>
//                         </li>
//                     `).join("")}

//                 </ul>

//             </div>
//             `;
//         }

//         // بدون sizes → زر مباشر
//         return `
//         <button class="btn btn-outline-primary btn-sm m-1 add-item-btn"
//             data-id="${item.id}"
//             >
//             ${item.name}
//         </button>
//         `;

//     }).join("");

// }

// /* ===========================
//     ADD ITEM
// =========================== */

// function addItemToOrder(itemId, sizeId = 0) {

//     const item = items.find(i => i.id == itemId);

//     if (!item) return;


//     if (sizeId > 0) {
//         const size = item.sizes.find(s => s.id === sizeId);
//         addToCart({
//             id: item.id,
//             name: item.name + ' - ' + size.name,
//             price: size.price,
//             station: item.station,
//             qty: 1,
//             sizeindex: size.id
//         });

//         return;
//     }

//     addToCart({
//         id: item.id,
//         name: item.name,
//         price: item.price,
//         station: item.station,
//         qty: 1,
//         sizeindex: 0
//     });

// }


// /* ===========================
//     CART
// =========================== */

// function addToCart(item) {
//     const existing = cart.find(i => {

//         return (
//             i.id == item.id
//             &&
//             (item.sizeindex > 0 ? i.sizeindex === item.sizeindex : true)
//         );

//     });

//     if (existing) {
//         existing.qty++;
//     }

//     else {
//         cart.push(item);
//         updateConfirmButton();
//     }
//     renderCart();

// }


// /* ===========================
//     CART RENDER
// =========================== */

// function renderCart() {

//     const table = document.getElementById("cartTable");

//     table.innerHTML = cart.map(item => `

//         <tr>

//             <td class="text-center align-middle nowrap-cell">${item.name}</td>

//             <td class="text-center align-middle">${item.qty}</td>

//             <td class="text-center align-middle">${item.price}</td>

//             <td class="text-center align-middle">${item.qty * item.price}</td>

//             <td class="d-flex justify-content-center align-items-center p-2">
//                 <button class="remove-item btn-sm delete-item-btn" data-id="${item.id}" data-sizeindex="${item.sizeindex}">
//                     <i class="fa fa-xmark"></i>
//                 </button>
//             </td>
//         </tr>

//     `).join("");


//     handelTotalPrice();

// }


// /* ===========================
//     TOTAL
// =========================== */

// function handelTotalPrice() {

//     const total = calculateTotalPrice();


//     document.getElementById("totalPrice").innerText = total;

// }


// function calculateTotalPrice() {
//     let total = 0;

//     cart.forEach(item => {

//         total += item.price * item.qty;

//     });

//     return total;

// }

// function deleteItemFromCart(itemId, sizeindex) {

//     const index = cart.findIndex(i => i.id == itemId && i.sizeindex == sizeindex);
//     if (index !== -1) {
//         cart.splice(index, 1);
//         renderCart();
//     }

//     updateConfirmButton();
// }




// function updateConfirmButton() {
//     const btn = document.getElementById("confirmAddItemBtn");

//     const hasItems = cart.length > 0;

//     btn.disabled = !hasItems;
// }




// function bootboxTableAction({
//     title,
//     message,
//     currentTable,
//     confirmText,
//     confirmClass = "btn-primary",
//     placeholder = "أدخل رقم الطاولة",
//     onConfirm
// }) {

//     const dialog = bootbox.dialog({
//         title: `
//             <div class="d-flex align-items-center">
//                 <i class="fa-solid fa-circle-exclamation text-warning me-2 fs-4"></i>
//                 <span>${title}</span>
//             </div>
//         `,
//         message: `
//             <div class="text-center">

//                 <p class="mb-2">${message}</p>

//                 <div class="alert alert-light border mb-3">
//                     <strong>الطاولة الحالية:</strong>
//                     ${currentTable}
//                 </div>

//                 <input
//                     id="targetTable"
//                     type="number"
//                     min="1"
//                     class="form-control text-center"
//                     placeholder="${placeholder}">
//             </div>
//         `,
//         buttons: {
//             cancel: {
//                 label: "إلغاء",
//                 className: "btn-secondary"
//             },
//             confirm: {
//                 label: confirmText,
//                 className: confirmClass,
//                 callback: async function () {

//                     const targetTable = Number($("#targetTable").val());

//                     if (!targetTable) {
//                         $("#targetTable").addClass("is-invalid");
//                         return false;
//                     }

//                   await  onConfirm(targetTable);
//                 }
//             }
//         }
//     });

//     dialog.init(() => {
//         $("#targetTable").trigger("focus");
//     });
// }



// function showPayOrderDialog(order) {

//     bootbox.dialog({
//         title: '<i class="fas fa-cash-register me-2"></i> تسديد الطاولة',

//         message: `
//             <div class="container-fluid">

//                 <div class="row mb-2">
//                     <div class="col-6 fw-bold">طريقة الدفع</div>
//                     <div class="col-6 text-end fw-bold">${order.payment_method}</div>
//                 </div>

//                 <hr>

//                 <div class="row mb-2">
//                     <div class="col-6 fw-bold">السعر الأساسي</div>
//                     <div class="col-6 text-end fw-bold"> ₪ ${order.total_price + order.new_discount} </div>
//                 </div>

//                 <div class="row mb-2">
//                     <div class="col-6 fw-bold">الخصم</div>
//                     <div class="col-6 text-end fw-bold">₪ ${order.new_discount} </div>
//                 </div>

//                 <hr>

//                 <div class="row">
//                     <div class="col-6 fw-bold text-success fs-5">الإجمالي</div>
//                     <div class="col-6 text-end fs-5 text-success fw-bold">
//                         ₪ ${order.total_price} 
//                     </div>
//                 </div>

//             </div>
//         `,
//         buttons: {

//             cancel: {
//                 label: "إلغاء",
//                 className: "btn-secondary"
//             },
            

//             confirm: {
//                 label: '<i class="fas fa-check me-1"></i> تسديد',
//                 className: "btn-success fw-bold",

//                 callback: async function () {
//                     await payOrder(order);
//                     return false;
//                 }
//             }

//         }
//     });

// }

// function showConfirmAddItemsDialog(finalOrder) {
//        const itemsHtml = finalOrder.new_items.map(item => `
//         <tr>
//             <td class="text-center">${item.name}</td>
//             <td class="text-center">${item.qty}</td>
//             <td class="text-center">₪ ${item.price}</td>
//             <td class="text-center fw-bold">₪ ${item.qty * item.price}</td>
//         </tr>
//     `).join('');


//     bootbox.dialog({

//         title: '<i class="fas fa-cart-plus me-2"></i> تأكيد إضافة أصناف',
//         message: `
//             <div class="container-fluid">

//                 <div class="text-center mb-4">
//                     <i class="fas fa-circle-question text-warning fs-1 mb-3"></i>

//                     <p class="mb-0 fw-bold">
//                         هل أنت متأكد من إضافة الأصناف الجديدة إلى الطلب؟
//                     </p>
//                 </div>

//                 <hr>
//                 <div style="max-height:250px; overflow:auto;">

//                     <table class="table table-sm table-bordered text-center align-middle">

//                         <thead class="table-light">
//                             <tr>
//                                 <th>الصنف</th>
//                                 <th>الكمية</th>
//                                 <th>السعر</th>
//                                 <th>الإجمالي</th>
//                             </tr>
//                         </thead>

//                         <tbody>
//                             ${itemsHtml}
//                         </tbody>

//                     </table>

//                 </div>

//                 <hr>

//                 <div class="row">
//                     <div class="col-6 fw-bold text-success fs-5">
//                         إجمالي الإضافة
//                     </div>

//                     <div class="col-6 text-end text-success fw-bold fs-5">
//                         ₪ ${finalOrder.total_price}
//                     </div>
//                 </div>

//             </div>
//         `,

//         buttons: {

//             cancel: {
//                 label: "إلغاء",
//                 className: "btn-secondary"
//             },

//             confirm: {
//                 label: '<i class="fas fa-check me-1"></i> تأكيد الإضافة',
//                 className: "btn-success fw-bold",

//                 callback: async function () {
//                     await addNewItems(finalOrder);
//                     return false;
//                 }
//             }

//         }

//     });

// }


import { showAuthExpired, setActiveNavLink, showPrintLoader, hidePrintLoader, bootboxError, bootboxSuccess } from "../../../component/bootbox.js";
import { url} from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken} from "../../../component/auth.js";
import { closeSideBar } from "../Switch-user-functionality.js";
import { handelOrderDatabeforPrinting, generateStationInvoice } from "../../../component/invoices.js";
import { formatDateOnly, formatTimeOnly, utcToPalestine } from "../../admin/report/shared-functionality.js";

const header = document.querySelector("site-header");

const orderDetailsModal = document.getElementById('orderDetailsModal');
const openItemsBtn = document.getElementById("openItemsBtn");
const editItemsBtn = document.getElementById("editItemsBtn");
const discountInput = document.getElementById("discountAmount");
const discountPercentageInput = document.getElementById("discountPercentage");
const NewDiscountPercentageValue = document.getElementById("newDiscount");
const beforeEl = document.getElementById("beforeDiscountTotal");
const afterEl = document.getElementById("afterDiscountTotal");
const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
const paymentMethod = document.getElementById('paymentMethod');

const loader = document.getElementById('overlay_loader');
const loaderCard = document.getElementById('loaderCard');

let tablesData;
let currentDisplayedOrderId;
let currentPaymentOrder;
let remmainingAmoutForCurrentOrder;
let mainCategories = [];
let items = [];
let cart = [];
let currentOrderItems = [];


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

    else if (e.target.closest('.edit-item-btn')) {
        const btn = e.target.closest('.edit-item-btn');
        const orderItemId = Number(btn.dataset.orderItemId);

        const itemIndex = currentOrderItems.findIndex(
            item => Number(item.order_item_id) === orderItemId
        );
        if (itemIndex !== -1) {
            currentOrderItems[itemIndex].quantity--;

            if (currentOrderItems[itemIndex].quantity <= 0) {
                currentOrderItems.splice(itemIndex, 1);
            }
        }
        displayOrderItems();
    }

    else if (e.target.closest('.delete-item-btn')) {
        const btn = e.target.closest('.delete-item-btn');

        const itemId = Number(btn.dataset.id);
        const sizeindex = Number(btn.dataset.sizeindex);
        deleteItemFromCart(itemId, sizeindex);
    }

    else if (e.target.closest('.increase-item-btn')) {
        const btn = e.target.closest('.increase-item-btn');

        const itemId = Number(btn.dataset.id);
        const sizeindex = Number(btn.dataset.sizeindex);
        increaseItemFromCart(itemId, sizeindex);
    }

    else if (e.target.closest('.decrease-item-btn')) {
        const btn = e.target.closest('.decrease-item-btn');

        const itemId = Number(btn.dataset.id);
        const sizeindex = Number(btn.dataset.sizeindex);
        decreaseItemFromCart(itemId, sizeindex);
    }

    else if (e.target.closest('.update-order-btn')) {
        const total = calculateTotalPrice();
        const table = getCurrentTable();

        let finalOrder = {
            table_num: table.table_id,
            order_id: currentDisplayedOrderId,
            total_price: total,
            new_items: cart,
            note: '',
        };
        showConfirmAddItemsDialog(finalOrder);
    }

    else if (e.target.closest('.edit-items-btn')) {
        showConfirmUpdateItemsDialog(currentOrderItems);
    }


    // فتح قسم الدفع
    else if (e.target.closest(".paymentBtn")) {
        const paymentSection = document.getElementById("paymentSection");
        paymentSection.classList.toggle("d-none");

        if (!paymentSection.classList.contains('d-none')) {
            setInitialViewForAddItembtn();
        }

        const table = getCurrentTable();

        // let total = 0; 

        // table.order.items.forEach(item =>{
        //     total += item.quantity * item.price;
        // });


        
        const total = Number(table.order.total_price);

        // const currentPaid = calculatePaidAmount(table.order.items);


        const currentPaid = Number((Number(table.order.cash_paid) + Number(table.order.card_paid)).toFixed(2));

        const remmainingAmount = total - currentPaid;




        document.getElementById('totalAmount').textContent = `₪ ${Number(total) + Number(table.order.discount)}`;
        document.getElementById('oldDescount').textContent = `₪ ${Number(table.order.discount)}`;

        document.getElementById('paidAmount').textContent = `₪ ${currentPaid}`;


        document.getElementById('remainingAmount').textContent = `₪ ${remmainingAmount}`;

        document.getElementById('beforeDiscountTotal').textContent = `₪ ${remmainingAmount}`;
        document.getElementById('afterDiscountTotal').textContent = `₪ ${remmainingAmount}`;


        remmainingAmoutForCurrentOrder = remmainingAmount; 
        document.getElementById('paymentStatus').classList.remove('d-none');

    }

    else if (e.target.closest(".confirmPaymentBtn")) {
        const currentClosedTable = getCurrentTable();

        currentPaymentOrder = {
            payment_method: paymentMethod.value,
            new_discount: Number(discountInput.value),
            table_num: currentClosedTable.table_id,
            order_id: currentClosedTable.order.id,
            items: currentClosedTable.order.items,
            remmaing_amount: remmainingAmoutForCurrentOrder
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
                    سيتم حذف الطلب نهائياً، وإغلاق الطاولة.
                </div>
            `,

            currentTable: tableId,

            confirmText: "حذف",

            confirmClass: "btn-danger",

            requireReason: true,

            reasonLabel: "سبب الحذف",

            reasonPlaceholder: "أدخل سبب حذف الطلب...",

            onConfirm(targetTable, cancelReason) {

                deleteOrder(orderId, cancelReason);
            }
        });
    }
    else if (e.target.closest('.changeTableBtn')) {
        const btn = e.target.closest(".changeTableBtn");
        const tableId = Number(btn.dataset.tableId);

        bootboxMoveTableAction({
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

    else if (e.target.closest('.mergeTableBtn')) {
        const btn = e.target.closest(".mergeTableBtn");
        const tableId = Number(btn.dataset.tableId);

        bootboxMergeTableAction({
            title: "دمج الطاولات",
            message: `
        أدخل رقم الطاولة التي تريد دمج الطلب معها.
    `,
            currentTable: tableId,
            placeholder: "رقم الطاولة المراد دمجها",
            confirmText: "دمج",
            confirmClass: "btn-warning",

            onConfirm(currentTable, targetTable) {

                const current = Number(currentTable);
                const target = Number(targetTable);

                if (target === current) {
                    bootbox.alert({
                        title: "خطأ",
                        message: `
                    <div class="text-danger fw-bold">
                        لا يمكنك دمج الطاولة مع نفسها (${current})
                    </div>
                `
                    });
                    return;
                }

                if (!target || target <= 0) {
                    bootbox.alert("يرجى إدخال رقم طاولة صحيح");
                    return;
                }

                mergeTables(current, target);
            }
        });
    }

    else if (e.target.closest('#partialPaymentBtn')) {
        const btn = e.target.closest("#partialPaymentBtn");
        const section = document.getElementById('partialPaymentSection');

        if (btn.classList.contains("is-active")) {
            btn.classList.remove("is-active");
            section.classList.add('d-none');

            btn.classList.add("btn-primary");
            btn.classList.remove("btn-warning");
            btn.innerHTML = `
               <i class="fas fa-money-bill-wave ms-1"></i>
                تسديد جزئي
            `;


        }
        else {
            btn.classList.add("is-active");

            btn.classList.remove("btn-primary");
            btn.classList.add("btn-warning");
            btn.innerHTML = `
                <i class="fas fa-times ms-1"></i> إلغاء العملية
            `;


            const table = getCurrentTable();


            if (!table?.order?.items?.length) {
                return;
            }

            const tbody = document.getElementById('partialPaymentItems');

            tbody.innerHTML = '';

            table.order.items.forEach(item => {

                const quantity = Number(item.quantity);
                const paidQuantity = Number(item.paid_quantity || 0);

                const remainingQuantity = quantity - paidQuantity;

                // الصنف مدفوع بالكامل
                if (remainingQuantity <= 0) {
                    return;
                }

                const price = Number(item.price || 0);

                const tr = document.createElement('tr');

                const displayName = item.size_name !== 'NaN'
                    ? `${item?.item_name || 'تم حذف الصنف'} - ${item.size_name}`
                    : item?.item_name || 'تم حذف الصنف';

                tr.innerHTML = `
                <td>
                    <div class="form-check d-flex justify-content-center">
                        <input
                            class="form-check-input partial-item-check"
                            type="checkbox"
                            data-order-item-id="${item.order_item_id}"
                            style="width: 20px; height: 20px; cursor:pointer;"
                        >
                    </div>
                </td>

                <td class="fw-bold">
                    ${displayName}
                </td>

                <td>
                    <select
                        class="form-select form-select-sm partial-quantity mx-auto"
                        data-order-item-id="${item.order_item_id}"
                        data-price="${price}"
                        disabled
                        style="width: 80px;"
                    >
                        ${Array.from(
                    { length: remainingQuantity },
                    (_, index) => {
                        const qty = index + 1;

                        return `
                                    <option value="${qty}">
                                        ${qty}
                                    </option>
                                `;
                    }
                ).join('')}
                    </select>
                </td>

                <td>
                    ${price.toFixed(2)} ₪
                </td>
                <td>
                    <div class="input-group input-group-sm mx-auto" style="width: 100px;">
                        <input
                            type="number"
                            class="form-control partial-discount"
                            data-order-item-id="${item.order_item_id}"
                            value="0"
                            min="0"
                            max="100"
                            step="0.01"
                            disabled
                        >
                        <span class="input-group-text">%</span>
                    </div>
                </td>

                <td>
                    <span
                        class="partial-item-total fw-bold"
                        data-order-item-id="${item.order_item_id}"
                    >
                        0.00 ₪
                    </span>
                </td>
            `;

                tbody.appendChild(tr);
            });

            section.classList.remove('d-none');

            updatePartialPaymentTotal();
        }


    }

    else if (e.target.closest('.printBtn')) {
        showPrintLoader();
        const table = getCurrentTable();

        const currentOroder = {
            invoice_num: null,
            time: formatTimeOnly(utcToPalestine(table.order.created_at)),
            date: formatDateOnly(utcToPalestine(table.order.created_at)),
            payment_method: 'غير محدد',
            type: 'طاولة',
            total_price: Number(table.order.total_price),
            discount: Number(table.order.discount),
            table_num: table.table_id,
            order_id: table.order.id,
            items: table.order.items,
            card_paid: table.order.card_paid,
            cash_paid: table.order.cash_paid
        }
        try {
            await handelOrderDatabeforPrinting(currentOroder, 'cashier_printer');
        } catch (e) {
            bootboxError(e.message);
        } finally {
            hidePrintLoader();
            await loadTableOrders();
        }
    }

    else if(e.target.closest('.re-fetch-btn')){
        const btn = e.target.closest('.re-fetch-btn');

        btn.disabled = true;
        btn.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin me-1"></i>
            جاري التحديث...
        `;
        
        
        const container = document.getElementById("tablesContainer");
        container.innerHTML = "";
        
        await loadTableOrders();
        
        btn.disabled = false;
        btn.innerHTML = `
            <i class="fa-solid fa-arrows-rotate me-1"></i>
            تحديث البيانات
               
        `;
        
    }

});

document.getElementById("cartTable").addEventListener("input", function (e) {

    if (!e.target.classList.contains("item-note")) return;

    const itemId = Number(e.target.dataset.id);
    const sizeIndex = Number(e.target.dataset.sizeindex);

    const item = cart.find(item =>
        item.id === itemId &&
        item.sizeindex === sizeIndex
    );

    if (item) {
        item.note = e.target.value;
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

    let totalPrice = 0;

    (order.items || []).forEach(item => {
        const displayName = item.size_name !== 'NaN'
            ? `${item?.item_name || 'تم حذف الصنف'} - ${item.size_name}`
            : item?.item_name || 'تم حذف الصنف';


            totalPrice += item.price * item.quantity;

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
                <strong>${totalPrice} ₪</strong>
            </td>
        </tr>

        <tr>
            <td colspan="3" class="text-end pe-3 text-danger">
                <strong>الخصم</strong>
            </td>
            <td class="text-danger">
                <strong>${Number(order.discount)} ₪</strong>
            </td>
        </tr>

        <tr class="table-success">
            <td colspan="3" class="text-end pe-3">
                <strong>الإجمالي</strong>
            </td>
            <td>
                <strong>${Number(order.total_price)} ₪</strong>
            </td>
        </tr>
    `;



    document.getElementById("cartTable").innerHTML = "";
    document.getElementById("confirmAddItemBtn").disabled = true;

    document.getElementById("itemsSelector").classList.add("d-none");
    document.getElementById("cartSection").classList.add("d-none");

    renderPaidItems(order.items);
});

orderDetailsModal.addEventListener('hidden.bs.modal', () => {
    openItemsBtn.classList.remove("is-active");
    openItemsBtn.classList.remove("btn-warning");
    openItemsBtn.classList.add("btn-success");
    openItemsBtn.innerHTML = `
        <i class="fas fa-plus ms-1"></i> إضافة صنف
    `;

    editItemsBtn.classList.remove("is-active");
    editItemsBtn.classList.remove("btn-warning");
    editItemsBtn.classList.add("btn-success");
    editItemsBtn.innerHTML = `
        <i class="fas fa-edit ms-1"></i> تعديل الطلب
        
    `;


    const payPartialBtn = document.getElementById('partialPaymentBtn');
    const section = document.getElementById('partialPaymentSection');

    payPartialBtn.classList.remove("is-active");
    section.classList.add('d-none');
    payPartialBtn.classList.add("btn-primary");
    payPartialBtn.classList.remove("btn-warning");
    payPartialBtn.innerHTML = `
        <i class="fas fa-money-bill-wave ms-1"></i>
        تسديد جزئي
    `;

    document.getElementById("itemsSelector").classList.add("d-none");
    document.getElementById('cartSection').classList.add('d-none');
    clearViews();
    setInitialViewForPayment();
});


openItemsBtn.addEventListener("click", async (event) => {
    clearViews();

    if (!openItemsBtn.classList.contains("is-active")) {
        openItemsBtn.classList.add("is-active");
        editItemsBtn.classList.remove("is-active");
        openItemsBtn.classList.remove("btn-success");
        openItemsBtn.classList.add("btn-warning");
        openItemsBtn.innerHTML = `
            <i class="fas fa-times ms-1"></i> إلغاء العملية
        `;
        setInitialViewForPayment();

        editItemsBtn.innerHTML = `
            <i class="fas fa-edit ms-1"></i> تعديل الطلب
        `;
        editItemsBtn.classList.remove("btn-warning");
        editItemsBtn.classList.add("btn-success");
        document.getElementById("itemsSelector").classList.remove("d-none");

        document.getElementById('cartSection').classList.remove('d-none');
        document.getElementById("confirmUpdateOrderBtn").classList.add("d-none");
        document.getElementById("confirmAddItemBtn").classList.remove("d-none");
        document.getElementById('operation').textContent = 'إضافة أصنافة جديدة';
    } else {
        openItemsBtn.classList.remove("is-active");
        openItemsBtn.classList.remove("btn-warning");
        openItemsBtn.classList.add("btn-success");

        openItemsBtn.innerHTML = `
            <i class="fas fa-plus ms-1"></i> إضافة صنف
        `;
        document.getElementById("itemsSelector").classList.add("d-none");

        document.getElementById('cartSection').classList.add('d-none');
    }

    if (mainCategories.length === 0 || items.length === 0) {
        await fetchMenuDetails();
    }
    renderMainCategories();
});

editItemsBtn.addEventListener("click", async (event) => {
    clearViews();

    if (!editItemsBtn.classList.contains("is-active")) {
        editItemsBtn.classList.add("is-active");
        openItemsBtn.classList.remove("is-active");
        editItemsBtn.classList.remove("btn-success");
        editItemsBtn.classList.add("btn-warning");
        editItemsBtn.innerHTML = `
            <i class="fas fa-times ms-1"></i> إلغاء العملية
        `;
        setInitialViewForPayment();

        openItemsBtn.innerHTML = `
            <i class="fas fa-plus ms-1"></i> إضافة صنف
        `;
        openItemsBtn.classList.remove("btn-warning");
        openItemsBtn.classList.add("btn-success");

        document.getElementById("itemsSelector").classList.add("d-none");

        document.getElementById('cartSection').classList.remove('d-none');

        document.getElementById("confirmUpdateOrderBtn").classList.remove("d-none");
        document.getElementById("confirmAddItemBtn").classList.add("d-none");

        document.getElementById('operation').textContent = 'تعديل أصناف الطلب';


        const table = getCurrentTable();
        currentOrderItems = table.order.items;
        displayOrderItems();
    } else {
        editItemsBtn.classList.remove("is-active");

        editItemsBtn.classList.remove("btn-warning");
        editItemsBtn.classList.add("btn-success");

        editItemsBtn.innerHTML = `
            <i class="fas fa-edit ms-1"></i> تعديل الطلب
        `;


        document.getElementById('cartSection').classList.add('d-none');
    }

});

document.addEventListener('change', function (e) {

    // اختيار / إلغاء اختيار الصنف
    if (e.target.classList.contains('partial-item-check')) {

        const orderItemId = e.target.dataset.orderItemId;

        const select = document.querySelector(
            `.partial-quantity[data-order-item-id="${orderItemId}"]`
        );

        const discount = document.querySelector(
            `.partial-discount[data-order-item-id="${orderItemId}"]`
        );

        if (e.target.checked) {
            select.disabled = false;
            discount.disabled = false;
        } else {
            select.disabled = true;
            discount.disabled = true;
            discount.value = 0;
        }

        calculatePartialItemTotal(orderItemId);
        updatePartialPaymentTotal();
    }


    // تغيير الكمية
    if (e.target.classList.contains('partial-quantity')) {

        const orderItemId = e.target.dataset.orderItemId;

        calculatePartialItemTotal(orderItemId);
        updatePartialPaymentTotal();
    }

});


document.getElementById('confirmPartialPaymentBtn').addEventListener('click', async function () {

    const selectedItems = [];

    document.querySelectorAll('.partial-item-check:checked').forEach(checkbox => {
        const orderItemId = Number(checkbox.dataset.orderItemId);

        const select = document.querySelector(
            `.partial-quantity[data-order-item-id="${orderItemId}"]`
        );
        const discountInput = document.querySelector(
            `.partial-discount[data-order-item-id="${orderItemId}"]`
        );
        selectedItems.push({
            order_item_id: orderItemId,
            paid_quantity: Number(select.value),
            discount_percentage: Number(discountInput.value || 0)
        });
    });

    const paymentMethod = document.getElementById('paymentMethodPartial').value;

    const paidItems = {
        order_id: currentDisplayedOrderId,
        items: selectedItems,
        payment_method: paymentMethod
    }
    const items = getSelectedPartialItems();

    showConfirmPayPartialItemsDialog(items, paidItems);
});

document.addEventListener('input', function (e) {

    if (e.target.classList.contains('partial-discount')) {

        const orderItemId = e.target.dataset.orderItemId;

        calculatePartialItemTotal(orderItemId);
        updatePartialPaymentTotal();
    }

    if (e.target.closest('#receivedAmount')) {
        const receivedAmount = Number(e.target.value) || 0;

        const finalTotal = Number(currentPaymentOrder.remmaing_amount) - Number(currentPaymentOrder.new_discount) ;

        const change = receivedAmount - finalTotal;

        document.getElementById('changeAmountSummary').textContent =
            `₪ ${Math.max(0, change)}`;
    }
    

});


document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        try {
            await openCashDrawer();
        } catch (error) {
            bootboxError("Cash drawer error:", error);
        }
    }
});


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
    } finally {
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
            splitByStation(finalOrder);
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

async function updateOrderItems(editedOrder) {

    if (editedOrder.length === 0) {
        bootboxError("لا يمكن حذف جميع الأصناف من تعديل الطلب. لحذف الطلب بالكامل، استخدم زر حذف الطلب.");
        return;
    }
    displaySpinnerLoader();
    try {
        const res = await fetch(url + '/order/edit-items', {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            body: JSON.stringify(editedOrder),
        });

        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }

        if (res.status === 200) {
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

async function deleteOrder(id, cancelReason) {
    loader.style.display = 'flex';
    try {
        const res = await fetch(url + `/delete/order?order_id=${id}`, {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            body: JSON.stringify({
                cancel_reason: cancelReason
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

    } catch (e) {
        bootboxError(e.message);
    } finally {
        loader.style.display = 'none';
    }
}
async function moveOrder(tableId, targetTable) {
    loader.style.display = 'flex';
    try {
        const res = await fetch(url + '/table/move', {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            body: JSON.stringify({
                from: tableId,
                to: targetTable
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

    } catch (e) {
        bootboxError(e.message);
    } finally {
        loader.style.display = 'none';
    }
}

async function mergeTables(currentTable, targetTable) {

    loader.style.display = 'flex';
    try {
        const res = await fetch(url + '/table/merge', {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            body: JSON.stringify({
                current: currentTable,
                target: targetTable
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

    } catch (e) {
        bootboxError(e.message);
    } finally {
        loader.style.display = 'none';
    }
}

async function partialPayOrder(paidItems) {
    displaySpinnerLoader();
    try {
        const res = await fetch(url + '/order/partial-pay', {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            body: JSON.stringify(paidItems),
        });

        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }

        if (res.status === 200) {
            await openCashDrawer().catch(error => {
                bootboxError("Cash drawer error:", error);
            });
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


function splitByStation(orderDetails) {

    const result = {
        kitchen: {
            station: 'فاتورة المطبخ',
            type: 'طاولة',
            note: orderDetails.note,
            table_num: orderDetails.tableNum,
            printer_name: 'kitchen',
            items: []
        },
        bar: {
            station: 'فاتورة البار',
            type: 'طاولة',
            note: orderDetails.note,
            table_num: orderDetails.tableNum,
            printer_name: 'bar',
            items: []
        },
        shisha: {
            station: 'فاتورة الأراجيل',
            type: 'طاولة',
            note: orderDetails.note,
            table_num: orderDetails.tableNum,
            printer_name: 'shisha',
            items: []
        },
        oven: {
            station: 'فاتورة الفرن',
            type: 'طاولة',
            note: orderDetails.note,
            table_num: orderDetails.tableNum,
            printer_name: 'oven',
            items: []
        }
    };

    // orderDetails.new_items.forEach(item => {
    //     result[item.station].items.push(item);
    // });

    orderDetails.new_items.forEach(item => {
        if (item.station === 'oven & kitchen') {
            // إضافة الصنف للمطبخ
            result.kitchen.items.push(item);

            // إضافة الصنف للفرن
            result.oven.items.push(item);

        } else {
            // الحالة العادية: قسم واحد
            result[item.station].items.push(item);
        }
    });

    // الأقسام التي يوجد فيها أصناف فعلًا
    const activeStations = Object.keys(result)
        .filter(key => result[key].items.length > 0);

    // نحدد لكل فاتورة الأقسام الأخرى الموجودة في نفس الطلب
    Object.keys(result).forEach(stationKey => {

        if (result[stationKey].items.length === 0) return;

        result[stationKey].otherStations = activeStations
            .filter(otherStation => otherStation !== stationKey)
            .map(otherStation => result[otherStation].station);
    });


    generateStationInvoice(result.kitchen).catch(error => {
        bootboxError("خطأ في طابعة المطبخ:", error)
    });

    generateStationInvoice(result.bar).catch(error => {
        bootboxError("خطأ في طابعة البار : ", error)
    });
    generateStationInvoice(result.shisha).catch(error => {
        bootboxError("خطأ في طابعة الأراجيل", error)
    });

    generateStationInvoice(result.oven).catch(error => {
        bootboxError("خطأ في طابعة الفرن", error)
    });

}


function getCurrentTable() {
    const table = tablesData.find(t => t.order.id == currentDisplayedOrderId);
    return structuredClone(table);
}

function setInitialViewForPayment() {
    const paymentSection = document.getElementById("paymentSection");
    paymentSection.classList.add("d-none");
    discountInput.value = '';
    discountPercentageInput.value = '';
    NewDiscountPercentageValue.textContent = '%0';
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
        const card = `
            <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-2 table-item">

                <div class="table-card occupied">

                    <!-- الطاولة -->
                    <div
                        class="table-main"
                        data-bs-toggle="modal"
                        data-bs-target="#orderDetailsModal"
                        data-table-id="${table.table_id}">

                        <div class="table-icon">
                            <i class="fa-solid fa-chair"></i>
                        </div>

                        <div class="table-number">
                            طاولة ${table.table_id}
                        </div>

                        <div class="table-status">
                            طلب مفتوح
                        </div>

                    </div>


                    <!-- أزرار الإجراءات -->
                   
                    <div class="table-actions">

                        
                        <button
                            class="btn btn-outline-primary btn-sm changeTableBtn"
                            data-table-id="${table.table_id}"
                            title="نقل الطاولة">

                            <i class="fa-solid fa-right-left"></i>

                        </button>

                        <button
                            class="btn btn-outline-warning btn-sm mergeTableBtn"
                            data-table-id="${table.table_id}"
                            title="دمج الطاولات">

                            <i class="fa-solid fa-object-group"></i>

                        </button>

                        <button
                            class="btn btn-outline-danger btn-sm deleteTableBtn"
                            data-id="${table.table_id}"
                            data-order-id="${order.id}"
                            title="حذف الطلب">

                            <i class="fa-solid fa-trash-can"></i>

                        </button>

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
    // const modal = new bootstrap.Modal(successModelOrder);
    // modal.show();
    const modal = bootstrap.Modal.getOrCreateInstance(successModelOrder);
    modal.show();
}

function closeSuccessModal() {
    // bootstrap.Modal.getInstance(successModelOrder).hide();
    // document.activeElement?.blur();

    // const modal = bootstrap.Modal.getInstance(orderDetailsModal);
    // modal?.hide();

    document.activeElement?.blur();

    const modal = bootstrap.Modal.getInstance(
        document.getElementById('successModal')
    );

    modal?.hide();
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
            sizeindex: size.id,
            note: ''
        });

        return;
    }

    addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        station: item.station,
        qty: 1,
        sizeindex: 0,
        note: ''
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

            

            <td class="text-center p-2">
                <div class="btn-group" role="group">

                    <!-- ناقص -->
                    <button 
                        type="button"
                        class="btn btn-sm btn-outline-warning decrease-item-btn"
                        data-id="${item.id}"
                        data-sizeindex="${item.sizeindex}"
                        title="تقليل الكمية">
                        <i class="fa fa-minus"></i>
                    </button>

                    <!-- زائد -->
                    <button 
                        type="button"
                        class="btn btn-sm btn-outline-success increase-item-btn"
                        data-id="${item.id}"
                        data-sizeindex="${item.sizeindex}"
                        title="زيادة الكمية">
                        <i class="fa fa-plus"></i>
                    </button>

                    <!-- حذف -->
                    <button 
                        type="button"
                        class="btn btn-sm btn-outline-danger remove-item delete-item-btn"
                        data-id="${item.id}"
                        data-sizeindex="${item.sizeindex}"
                        title="حذف الصنف">
                        <i class="fa fa-xmark"></i>
                    </button>

                </div>
            </td>

            <td>
                <input 
                    class="w-100 item-note"
                    type="text"
                    placeholder="ملاحظة..."
                    data-id="${item.id}"
                    data-sizeindex="${item.sizeindex}"
                    value="${item.note || ''}"
                >
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


function increaseItemFromCart(itemId, sizeindex) {

    const index = cart.findIndex(i => i.id == itemId && i.sizeindex == sizeindex);
    if (index !== -1) {
        cart[index].qty += 1;
        renderCart();
    }

    updateConfirmButton();
}

function decreaseItemFromCart(itemId, sizeindex) {

    const index = cart.findIndex(
        i => i.id == itemId && i.sizeindex == sizeindex
    );

    if (index !== -1) {
        if (cart[index].qty > 1) {
            cart[index].qty -= 1;
        } else {
            cart.splice(index, 1);
        }

        renderCart();
    }

    updateConfirmButton();
}



function updateConfirmButton() {
    const btn = document.getElementById("confirmAddItemBtn");

    const hasItems = cart.length > 0;

    btn.disabled = !hasItems;
}






function bootboxMoveTableAction({
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

                    dialog.modal('hide');

                    dialog.one('hidden.bs.modal', async function () {
                        await onConfirm(targetTable);
                    });

                    return false;
                }
            }
        }
    });

    dialog.init(() => {
        $("#targetTable").trigger("focus");
    });
}


function bootboxTableAction({
    title,
    message,
    currentTable,
    confirmText,
    confirmClass = "btn-primary",
    placeholder = "أدخل رقم الطاولة",
    requireReason = false,
    reasonLabel = "سبب العملية",
    reasonPlaceholder = "أدخل السبب...",
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

                <div class="mb-3">
                    ${message}
                </div>

                <div class="alert alert-light border mb-3">
                    <strong>الطاولة الحالية:</strong>
                    ${currentTable}
                </div>

                <div class="mb-3">
                    <label class="form-label fw-bold">
                        رقم الطاولة للتأكيد
                    </label>

                    <input
                        id="targetTable"
                        type="number"
                        min="1"
                        class="form-control text-center"
                        placeholder="${placeholder}">
                    
                    <div
                        id="targetTableError"
                        class="invalid-feedback">
                        يجب إدخال رقم الطاولة.
                    </div>
                </div>

                ${requireReason
                ? `
                            <div class="mb-3 text-start">
                                <label class="form-label fw-bold">
                                    ${reasonLabel}
                                    <span class="text-danger">*</span>
                                </label>

                                <textarea
                                    id="actionReason"
                                    class="form-control"
                                    rows="3"
                                    placeholder="${reasonPlaceholder}"
                                ></textarea>

                                <div
                                    id="actionReasonError"
                                    class="text-danger small mt-1"
                                    style="display: none;">
                                    يجب إدخال ${reasonLabel}.
                                </div>
                            </div>
                        `
                : ""
            }

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

                callback: function () {

                    const targetTable = Number(
                        $("#targetTable").val()
                    );

                    // =========================
                    // التحقق من رقم الطاولة
                    // =========================

                    if (!targetTable) {

                        $("#targetTable")
                            .addClass("is-invalid")
                            .focus();

                        $("#targetTableError").show();

                        return false;
                    }

                    $("#targetTable")
                        .removeClass("is-invalid");

                    $("#targetTableError").hide();


                    // =========================
                    // الحصول على السبب
                    // =========================

                    let reason = "";

                    if (requireReason) {

                        reason = $("#actionReason")
                            .val()
                            .trim();

                        // =========================
                        // التحقق من السبب
                        // =========================

                        if (!reason) {

                            $("#actionReason")
                                .addClass("is-invalid")
                                .focus();

                            $("#actionReasonError").show();

                            return false;
                        }

                        $("#actionReason")
                            .removeClass("is-invalid");

                        $("#actionReasonError").hide();
                    }


                    // =========================
                    // التحقق من رقم الطاولة
                    // =========================

                    if (targetTable != currentTable) {

                        bootbox.alert({
                            title: "خطأ",
                            message: `
                                <div class="text-danger fw-bold">
                                    رقم الطاولة غير مطابق للطاولة الحالية.
                                    يرجى التأكد من إدخال الرقم الصحيح.
                                </div>
                            `,
                            callback: function () {

                                $("#targetTable")
                                    .addClass("is-invalid")
                                    .focus();
                            }
                        });

                        return false;
                    }


                    // =========================
                    // تنفيذ العملية
                    // =========================

                    try {

                        const result = onConfirm(
                            targetTable,
                            reason
                        );

                        // إذا رجعت false
                        if (result === false) {
                            return false;
                        }

                        // إذا كانت Promise
                        if (
                            result &&
                            typeof result.then === "function"
                        ) {

                            result
                                .then(function (success) {

                                    if (success === false) {
                                        return;
                                    }

                                    if (document.activeElement) {
                                        document.activeElement.blur();
                                    }

                                    dialog.modal("hide");

                                })
                                .catch(function (error) {

                                    bootbox.alert(
                                        "حدث خطأ أثناء تنفيذ العملية."
                                    );
                                });

                            return false;
                        }

                        if (document.activeElement) {
                            document.activeElement.blur();
                        }

                        dialog.modal("hide");

                    } catch (error) {

                        bootbox.alert(
                            "حدث خطأ أثناء تنفيذ العملية."
                        );
                    }

                    return false;
                }
            }
        }
    });


    // =========================
    // بعد فتح البوت بوكس
    // =========================

    dialog.init(function () {

        $("#targetTable").trigger("focus");


        // إزالة خطأ رقم الطاولة
        $("#targetTable").on("input", function () {

            if ($(this).val()) {

                $(this).removeClass("is-invalid");

                $("#targetTableError").hide();
            }
        });


        // إزالة خطأ السبب
        if (requireReason) {

            $("#actionReason").on("input", function () {

                if ($(this).val().trim()) {

                    $(this).removeClass("is-invalid");

                    $("#actionReasonError").hide();
                }
            });
        }
    });
}



function bootboxMergeTableAction({
    title,
    message,
    currentTable,
    confirmText,
    confirmClass = "btn-warning",
    placeholder = "أدخل رقم الطاولة المراد دمجها",
    onConfirm
}) {

    const dialog = bootbox.dialog({
        title: `
            <div class="d-flex align-items-center">
                <i class="fa-solid fa-object-group text-warning me-2 fs-4"></i>
                <span>${title}</span>
            </div>
        `,
        message: `
         <div class="text-center">

    <p class="mb-3 text-muted">
        سيتم نقل طلب الطاولة الحالية إلى طاولة أخرى
    </p>

    <!-- Current Table -->
    <div class="border border-warning rounded-3 p-3 bg-light mb-2">
        <div class="text-muted small mb-1">
            <i class="fa-solid fa-location-dot me-1"></i>
            الطاولة الحالية
        </div>

        <div class="fw-bold fs-2 text-dark">
            ${currentTable}
        </div>

        <div class="text-danger fw-bold small mt-1">
            <i class="fa-solid fa-trash-can me-1"></i>
            سيتم حذف هذه الطاولة
        </div>
    </div>

    <!-- Arrow -->
    <div class="my-2 text-warning">
        <i class="fa-solid fa-arrow-down fa-lg"></i>
        <div class="small fw-bold">
            سيتم نقل الطلب إلى
        </div>
    </div>

    <!-- Target Table -->
    <div class="border rounded-3 p-3 mb-3">
        <div class="text-muted small mb-2">
            <i class="fa-solid fa-table-cells me-1"></i>
            الطاولة التي سيتم نقل الطلب إليها
        </div>

        <input
            id="targetTable"
            type="number"
            min="1"
            class="form-control form-control-lg text-center fw-bold"
            placeholder="أدخل رقم الطاولة"
        >
    </div>

    <!-- Explanation -->
    <div class="alert alert-warning text-start mb-0">
        <div class="fw-bold mb-1">
            <i class="fa-solid fa-circle-exclamation me-1"></i>
            ماذا سيحدث؟
        </div>

        <div class="small">
            سيتم نقل طلب الطاولة
            <strong>${currentTable}</strong>
            إلى الطاولة التي تدخل رقمها،
            ثم سيتم حذف الطاولة
            <strong>${currentTable}</strong>.
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
                label: confirmText,
                className: confirmClass,
                callback: async function () {

                    const targetTable = Number($("#targetTable").val());

                    if (!targetTable) {
                        $("#targetTable").addClass("is-invalid");
                        return false;
                    }

                    dialog.modal('hide');

                    dialog.one('hidden.bs.modal', async function () {
                        await onConfirm(currentTable, targetTable);
                    });

                    return false;
                }
            }
        }
    });

    dialog.init(() => {
        $("#targetTable").trigger("focus");
    });
}


function showPayOrderDialog(order) {

    const dialog = bootbox.dialog({
        title: '<i class="fas fa-cash-register me-2"></i> تسديد الطاولة',

        message: `
            <div class="container-fluid">

                <div class="row mb-2">
                    <div class="col-6 fw-bold">طريقة الدفع</div>
                    <div class="col-6 text-end fw-bold">${order.payment_method}</div>
                </div>

                <hr>

                <div class="row mb-2">
                    <div class="col-6 fw-bold">المبلغ المتبقي</div>
                    <div class="col-6 text-end fw-bold"> ₪ ${Number(order.remmaing_amount)} </div>
                </div>

                <div class="row mb-2">
                    <div class="col-6 fw-bold text-danger">الخصم</div>
                    <div class="col-6 text-end fw-bold text-danger">₪ ${order.new_discount} </div>
                </div>

                <hr>

                <div class="row">
                    <div class="col-6 fw-bold text-success fs-5">الإجمالي</div>
                    <div class="col-6 text-end fs-5 text-success fw-bold">
                        ₪ ${Math.floor(Number(order.remmaing_amount) - Number(order.new_discount))} 
                    </div>
                </div>

                <div class="border rounded-3 bg-white p-2 mt-3">

                    <label class="form-label fw-bold mb-1">
                        <i class="fas fa-hand-holding-dollar ms-1 text-success"></i>
                        المبلغ المستلم
                    </label>

                    <div class="input-group">

                        <input type="number"
                            class="form-control fw-bold text-center"
                            id="receivedAmount"
                            placeholder="0"
                            min="0"
                            step="1">

                        <span class="input-group-text fw-bold">
                            ₪
                        </span>

                    </div>

                </div>


                <div class="d-flex justify-content-between align-items-center
                            border border-success rounded-3
                            p-2 mt-2 bg-success-subtle">

                    <span class="fw-bold">
                        الباقي للترجيع:
                    </span>

                    <strong id="changeAmountSummary"
                            class="fs-5 text-success">
                        ₪ 0
                    </strong>

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
                    openCashDrawer().catch(error => {
                        bootboxError("Cash drawer error:", error);
                    });


                    // await payOrder(order);
                    // return false;

                    dialog.find('.btn-success').prop('disabled', true);

                    dialog.one('hidden.bs.modal', async function () {
                        await payOrder(order);
                    });

                    dialog.modal('hide');

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


    const dialog = bootbox.dialog({

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
                    // await addNewItems(finalOrder);
                    // return false;
                    dialog.find('.btn-success').prop('disabled', true);

                    dialog.one('hidden.bs.modal', async function () {
                        await addNewItems(finalOrder);
                    });

                    dialog.modal('hide');

                    return false;
                }
            }

        }

    });

}

function showConfirmUpdateItemsDialog(finalOrder) {
    const itemsHtml = finalOrder.map(item => `
        <tr>
            <td class="text-center">
                ${item.item_name}
                    ${item.size_name && item.size_name !== "NaN"
            ? ` - ${item.size_name}`
            : ""}
            </td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-center">₪ ${item.price}</td>
            <td class="text-center fw-bold">₪ ${item.quantity * item.price}</td>
        </tr>
    `).join('');

    const totalPrice = finalOrder.reduce(
        (total, item) => total + (Number(item.quantity) * Number(item.price)),
        0
    );
    const dialog = bootbox.dialog({

        title: '<i class="fas fa-pen-to-square me-2"></i> تأكيد تعديل الطلب',

        message: `
            <div class="container-fluid">

                <div class="text-center mb-4">
                    <i class="fas fa-circle-question text-info fs-1 mb-3"></i>

                    <p class="mb-0 fw-bold">
                        هل أنت متأكد من حفظ تعديلات الطلب؟
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
                    <div class="col-6 fw-bold text-info fs-5">
                        إجمالي الطلب
                    </div>

                    <div class="col-6 text-end text-dark fw-bold fs-5">
                        ₪ ${totalPrice}
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
                label: '<i class="fas fa-check me-1"></i> تأكيد التعديل',
                className: "btn-info fw-bold",

                callback: async function () {
                    // await updateOrderItems(finalOrder);
                    // return false;
                    dialog.find('.btn-info').prop('disabled', true);

                    dialog.one('hidden.bs.modal', async function () {
                        await updateOrderItems(finalOrder);
                    });

                    dialog.modal('hide');

                    return false;
                }
            }

        }

    });

}


async function openCashDrawer() {
    return;
    // const success = await window.electronAPI.openCashDrawer();
    // if (!success) {
    //     bootboxError('تعذّر فتح صندوق الكاش. يرجى التأكد من تشغيل طابعة الكاشير وتوصيل صندوق الكاش بها، ثم المحاولة مرة أخرى.');
    // }

}

function displayOrderItems() {
    const table = document.getElementById("cartTable");
    table.innerHTML = "";
    if (currentOrderItems.length === 0) return;
    let newTotalPrice = 0;
    table.innerHTML = currentOrderItems.map(item => {
        const qty = Number(item.quantity);
        const price = Number(item.price);
        const total = qty * price;
        newTotalPrice += total;
        return `
            <tr>

                <td class="text-center align-middle nowrap-cell">
                    ${item.item_name}
                    ${item.size_name && item.size_name !== "NaN"
                ? ` - ${item.size_name}`
                : ""
            }
                </td>

                <td class="text-center align-middle">
                    ${qty}
                </td>

                <td class="text-center align-middle">
                    ${price}
                </td>

                <td class="text-center align-middle">
                    ${total}
                </td>

                <td class="d-flex justify-content-center align-items-center p-2">
                    <button 
                        class="btn btn-sm edit-item-btn btn-danger"
                        data-id="${item.item_id}"
                        data-order-item-id="${item.order_item_id}"
                    >
                        <i class="fa fa-minus"></i>
                    </button>
                </td>

            </tr>
        `;

    }).join("");

    document.getElementById("totalPrice").innerText = newTotalPrice;
}


function formatPalestineTime(utcTime) {
    if (!utcTime) return 'غير محدد';
    const [hours, minutes, seconds] = utcTime.split(":").map(Number);

    const date = new Date();
    date.setUTCHours(hours, minutes, seconds || 0, 0);

    return new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Gaza",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }).format(date).toLowerCase();
}



function updatePartialPaymentTotal() {

    let total = 0;

    document
        .querySelectorAll('.partial-item-check:checked')
        .forEach(checkbox => {

            const orderItemId = checkbox.dataset.orderItemId;

            const select = document.querySelector(
                `.partial-quantity[data-order-item-id="${orderItemId}"]`
            );

            const quantity = Number(select.value);
            const price = Number(select.dataset.price);

            total += quantity * price;
        });



    document.getElementById('confirmPartialPaymentBtn').disabled =
        total <= 0;
}


function calculatePartialItemTotal(orderItemId) {

    const select = document.querySelector(
        `.partial-quantity[data-order-item-id="${orderItemId}"]`
    );

    const discountInput = document.querySelector(
        `.partial-discount[data-order-item-id="${orderItemId}"]`
    );

    const total = document.querySelector(
        `.partial-item-total[data-order-item-id="${orderItemId}"]`
    );

    const quantity = Number(select.value || 0);
    const price = Number(select.dataset.price || 0);
    const discountPercentage = Number(discountInput.value || 0);

    const subtotal = quantity * price;

    let discountAmount =
        subtotal * (discountPercentage / 100);
    discountAmount = roundDiscount(discountAmount);

    const finalTotal = subtotal - discountAmount;

    total.textContent = `${finalTotal} ₪`;
}




discountInput.addEventListener("input", () => {
    updateDiscountFromAmount();
});

discountPercentageInput.addEventListener("input", () => {
    updateDiscountFromPercentage();
});


function updateDiscountFromAmount() {
    const table = getCurrentTable();

    const total = Number(table.order.total_price);

    const paid = Number(table.order.cash_paid || 0) + Number(table.order.card_paid || 0);
    const remaining = total - paid ;


    let discount = parseFloat(discountInput.value) || 0;

    discount = roundDiscount(discount);

    // تحديث النسبة
    if (remaining > 0) {
        const percentage = (discount / remaining) * 100;
        discountPercentageInput.value = percentage.toFixed(2);
    } else {
        discountPercentageInput.value = "0";
    }

    

    updateTotals(discount, remaining);
}


function updateDiscountFromPercentage() {
    const table = getCurrentTable();

    const total = Number(table.order.total_price);
    const paid = Number(table.order.cash_paid || 0) + Number(table.order.card_paid || 0);

    const remaining = total - paid;



    let percentage = parseFloat(discountPercentageInput.value) || 0;

    // تحديث قيمة الخصم بالشيكل
    let discount = (remaining * percentage) / 100;

    discount = roundDiscount(discount);

    discountInput.value = discount.toFixed(2);

    updateTotals(discount, remaining);
}


function updateTotals(discount, remaining) {

    if (discount > remaining) {
        confirmPaymentBtn.disabled = true;

        displayDiscountErrorMessage(
            'خطأ : قيمة الخصم أكبر من السعر الإجمالي'
        );

        return;
    }

    if (discount < 0) {
        confirmPaymentBtn.disabled = true;

        displayDiscountErrorMessage(
            'خطأ : قيمة الخصم لا يمكن أن تكون بالسالب'
        );

        return;
    }

    confirmPaymentBtn.disabled = false;
    hiddeDiscountErrorMessage();

    const before = remaining;
    const after = Math.max(remaining - discount, 0);

    beforeEl.innerText = `₪ ${Number(before.toFixed(2))}`;

    afterEl.innerText = `₪ ${Number(after)}`;

    NewDiscountPercentageValue.textContent = `%${Number(discountPercentageInput.value)}`;
}

function getSelectedPartialItems() {

    const items = [];

    document.querySelectorAll('.partial-item-check:checked').forEach(checkbox => {

        const orderItemId = Number(checkbox.dataset.orderItemId);
        const row = checkbox.closest('tr');

        const itemName = row.querySelector('td:nth-child(2)').textContent.trim();

        const quantity = Number(
            row.querySelector(`.partial-quantity[data-order-item-id="${orderItemId}"]`).value
        );

        const price = Number(
            row.querySelector(`.partial-quantity[data-order-item-id="${orderItemId}"]`).dataset.price
        );

        const discount = Number(
            row.querySelector(`.partial-discount[data-order-item-id="${orderItemId}"]`).value || 0
        );

        const totalText = row.querySelector(
            `.partial-item-total[data-order-item-id="${orderItemId}"]`
        ).textContent;

        const total = Number(
            totalText.replace(/[^\d.-]/g, '')
        );

        items.push({
            order_item_id: orderItemId,
            name: itemName,
            quantity: quantity,
            price: price,
            discount_percentage: discount,
            total: total
        });
    });

    return items;
}


function showConfirmPayPartialItemsDialog(items, paidItems) {
    let totalPartialPayPrice = 0;

    const itemsHtml = items.map(item => {

        totalPartialPayPrice += Number(item.total);

        return `
            <tr>
                <td class="text-center">${item.name}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-center">₪ ${item.price}</td>
                <td class="text-center">%${item.discount_percentage}</td>
                <td class="text-center fw-bold">₪ ${item.total}</td>
            </tr>
        `;

    }).join('');

    const dialog = bootbox.dialog({

        title: '<i class="fas fa-money-bill-wave me-2"></i> تسديد جزئي',

        message: `
        <div class="container-fluid">

            <div class="text-center mb-4">
                <i class="fas fa-circle-question text-warning fs-1 mb-3"></i>

                <p class="mb-0 fw-bold">
                    هل أنت متأكد من تسديد الأصناف المحددة من الطلب؟
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
                            <th>الخصم</th>
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
                    إجمالي التسديد
                </div>

                <div class="col-6 text-end text-success fw-bold fs-5">
                    ₪ ${totalPartialPayPrice}
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
                label: '<i class="fas fa-check me-1"></i> تأكيد التسديد',
                className: "btn-primary fw-bold",

                callback: async function () {
                    dialog.find('.btn-primary').prop('disabled', true);

                    dialog.one('hidden.bs.modal', async function () {
                        await partialPayOrder(paidItems);
                    });

                    dialog.modal('hide');

                    return false;
                }
            }

        }

    });

}

function renderPaidItems(items) {

    const paidItemsBody = document.getElementById('paidItemsBody');

    paidItemsBody.innerHTML = '';
    let paidTotal = 0;

    (items || []).forEach(item => {

        const paidQuantity = Number(item.paid_quantity || 0);

        // الصنف ما اندفع منه شيء
        if (paidQuantity <= 0) {
            return;
        }

        const price = Number(item.price || 0);
        const discount = Number(item.discount_item || 0);

        // المبلغ قبل الخصم للكمية المدفوعة
        const paidBeforeDiscount = paidQuantity * price;

        // المبلغ الفعلي بعد الخصم
        const total = paidBeforeDiscount - discount;

        // تجميع المبلغ النهائي
        paidTotal += Math.floor(total);

        const displayName = item.size_name !== 'NaN'
            ? `${item?.item_name || 'تم حذف الصنف'} - ${item.size_name}`
            : item?.item_name || 'تم حذف الصنف';

        paidItemsBody.innerHTML += `
            <tr>
                <td>${displayName}</td>

                <td>
                    ${paidQuantity}
                </td>

                <td>
                    ${price} ₪
                </td>

                <td>
                    ${Number(price) * Number(paidQuantity)} ₪
                </td>

                <td class="text-danger">
                    ${discount} ₪
                </td>

                <td class="fw-bold">
                    ${Math.floor(total)} ₪
                </td>
            </tr>
        `;
    });

    // بعد انتهاء الـ forEach
    paidItemsBody.innerHTML += `
        <tr class="fw-bold border-top">
            <td colspan="5" class="text-end">
                 إجمالي الأصناف المسددة
            </td>
            <td class="text-success">
                ${Math.floor(paidTotal)} ₪
            </td>
        </tr>
    `;

}


function roundDiscount(discount) {
    if (discount === 0) return 0;

    const firstDecimal = Math.floor(discount * 10) % 10;

    return Math.floor(discount) + (firstDecimal >= 4 ? 1 : 0);
}