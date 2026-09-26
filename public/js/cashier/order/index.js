// import { setActiveNavLink, showAuthExpired, showError, hiddeError, bootboxSuccess, bootboxError, showPrintLoader, hidePrintLoader } from "../../../component/bootbox.js";
// import { url, urlServer} from "../../../api/urlEndPoint.js";
// import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
// import { printInvoiceFromCashier } from "../../../component/invoices.js";
// import { bootboxLoginAsAdmin, closeSideBar, SwitchToAdmin } from "../Switch-user-functionality.js";


// const header = document.querySelector("site-header");
// const mainCategoriesContainer = document.getElementById('mainCategoriesContainer');
// const categoryContainer = document.getElementById('categoryContainer');
// const categoryDivider = document.getElementById('categoryDivider');
// const orderType = document.getElementById('orderType');
// const paymentMethod = document.getElementById('paymentMethod');
// const tableNumber = document.getElementById('tableNumber');
// const customerPhone = document.getElementById('customerPhone');
// const customerAddress = document.getElementById('customerAddress');
// const orderNotes = document.getElementById('orderNotes');
// const spinnerLoad = document.getElementById('spinnerLoad');
// const errorBox = document.getElementById('error-box');
// const cashBalance = document.getElementById('cash-balance');
// const cardBalance = document.getElementById('card-balance');

// const confirmSendBtn = document.getElementById('confirmSendBtn');
// const confirmOrderModal = document.getElementById('confirmOrderModal');
// const successModelOrder = document.getElementById('successModal');

// const searchInput = document.getElementById("search-input");
// const searchResults = document.getElementById("search-results");
// let lastCategoryIdBySearchResults = 0;

// const discountInput = document.getElementById("discountAmount");
// const finalTotalPrice = document.getElementById("finalTotalPrice");

// let finalOrderDetails = {
//     items: [],
//     totalPrice: 0,
//     orderType: '',
//     paymentMethod: '',
//     note: '',
//     tableNum: 0,
//     phoneNum: '',
//     address: '',
//     discount: 0,
// };

// let sessionId = 0;

// let currentOrder = [];

// let products = [];
// let categoriesData = [];

// let hasOneMainCategory = false;
// let selectedProductForSize = null;

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


// document.addEventListener("DOMContentLoaded", async function () {
//     displaySpinner();
//     const hasOpeningSession = await checkSession();
//     if (hasOpeningSession) {
//         await loadAndRenderItems();
//     }
//     else {
//         handleSessionStatus();
//     }
//     hiddeSpinner();

//     initHorizontalScroll({
//         container: document.getElementById("mainCategories"),
//         leftArrow: document.getElementById("scrollLeft"),
//         rightArrow: document.getElementById("scrollRight"),
//         step: 300
//     });

//     initHorizontalScroll({
//         container: document.getElementById("categoryContainer"),
//         leftArrow: document.getElementById("subScrollLeft"),
//         rightArrow: document.getElementById("subScrollRight"),
//         step: 300
//     });
// });

// confirmOrderModal.addEventListener('hidden.bs.modal', () => {
//     paymentMethod.value = 'كاش';
//     orderType.value = 'طاولة';
//     toggleDeliveryFields();
//     discountInput.value = '';
//     finalTotalPrice.textContent = '0 ₪';
//     confirmSendBtn.disabled = false;
//     tableNumber.value = '';
//     customerPhone.value = '';
//     customerAddress.value = '';
//     orderNotes.value = '';
// });


// discountInput.addEventListener("input", updateFinalTotal);


// function updateFinalTotal() {
//     // استخراج الرقم من النص
//     const totalText = document.getElementById('modal-total-price').textContent;

//     // مثال: "120 ₪" => 120
//     const total = parseFloat(totalText.replace(/[^\d.]/g, "")) || 0;

//     // قيمة الخصم
//     const discount = parseFloat(discountInput.value) || 0;


//     checkDiscount(discount, total);

//     // منع الخصم الأكبر من المجموع
//     const finalPrice = Math.max(total - discount, 0);

//     // تحديث المجموع النهائي
//     finalTotalPrice.textContent = `${finalPrice} ₪`;
// }

// function checkDiscount(discount, total) {
//     if (discount > total || discount < 0) {
//         confirmSendBtn.disabled = true;
//     }
//     else {
//         confirmSendBtn.disabled = false;
//     }
// }

// orderType.addEventListener('change', toggleDeliveryFields);


// document.addEventListener("click", async function (e) {

//     if (e.target.closest('.product-card')) {
//         const card = e.target.closest(".product-card");
//         const productId = card.dataset.id;

//         let overlay = card.querySelector('.card-overlay');
//         if (!overlay) {
//             overlay = document.createElement('div');
//             overlay.className = 'card-overlay';
//             card.appendChild(overlay);
//         }

//         let checkIcon = card.querySelector('.check-icon');
//         if (!checkIcon) {
//             checkIcon = document.createElement('i');
//             checkIcon.className = 'fas fa-check-circle check-icon';
//             card.appendChild(checkIcon);
//         }
//         overlay.style.display = 'block';
//         checkIcon.style.display = 'block';




//         showSizeModal(Number(productId));




//         setTimeout(() => {
//             overlay.style.display = 'none';
//             checkIcon.style.display = 'none';
//         }, 1000);

//         return;
//     }

//     else if (e.target.closest('.size-option')) {
//         const sizeBtn = e.target.closest('.size-option');
//         const index = sizeBtn.dataset.index;
//         selectSize(Number(index));
//         return;
//     }

//     else if (e.target.closest('.qty-plus')) {
//         const item = e.target.closest('.qty-plus');
//         const id = item.dataset.id;
//         const sizeindex = item.dataset.sizeindex;

//         if (sizeindex === 'hasOnePrice') {
//             changeQty(Number(id), sizeindex, 1);
//         }

//         else {
//             changeQty(Number(id), Number(sizeindex), 1);
//         }

//         return;
//     }

//     else if (e.target.closest('.qty-minus')) {
//         const item = e.target.closest('.qty-minus');
//         const id = item.dataset.id;
//         const sizeindex = item.dataset.sizeindex;
//         if (sizeindex === 'hasOnePrice') {
//             changeQty(Number(id), sizeindex, -1);
//         }
//         else {
//             changeQty(Number(id), Number(sizeindex), -1);
//         }
//         return;
//     }

//     else if (e.target.closest('.remove-item')) {
//         const item = e.target.closest('.remove-item');
//         const id = item.dataset.id;
//         const sizeindex = item.dataset.sizeindex;

//         if (sizeindex === 'hasOnePrice') {
//             removeFromOrder(Number(id), sizeindex);
//             return;
//         }
//         removeFromOrder(Number(id), Number(sizeindex));
//         return;
//     }

//     else if (e.target.closest('.submit-order-btn')) {
//         submitOrder();
//         return;
//     }

//     else if (e.target.closest('.send-order-btn')) {
//         confirmAndSendOrder();
//         return;
//     }

//     else if (e.target.closest('.print-invoice-btn')) {
//         closeSuccessModal();
//         showPrintLoader();
//         try {
//             await printInvoiceFromCashier(finalOrderDetails);
//         } catch (e) {
//             bootboxError(e.message);
//         } finally {
//             hidePrintLoader();
//             clearFinalOrderDetails();
//         }
//     }

//     else if (e.target.closest('.close-success-modal')) {
//         clearFinalOrderDetails();
//         closeSuccessModal();
//         return;
//     }

//     else if (e.target.closest('.switch-admin-btn')) {
//         const input = document.getElementById('adminPassword');
//         await SwitchToAdmin(url, input.value);
//     }

//     else if(e.target.closest('.search-item')){
//         const itemEl = e.target.closest('.search-item');

//         const product = JSON.parse(itemEl.dataset.product);

//         searchInput.value = product.name;
//         searchResults.style.display = "none";
//         setCategoryIdForSearchResults(product.category_id);
//         fillterCategoriesByProduct(product.category_id);

//         requestAnimationFrame(() => {
//             fillterProducts(product);
//         });
        
//     }
// });

// document.querySelectorAll('input[name="payment_status"]').forEach(input => {
//     input.addEventListener("change", handlePaymentStatus);
// });



// searchInput.addEventListener("input", function () {

//     const value = this.value.trim();

//     if(value === ""){
//         searchResults.style.display = "none";
//         if(lastCategoryIdBySearchResults > 0){
//             renderProducts(lastCategoryIdBySearchResults);
//         }
//         return;
//     }

//     const filteredProducts = products
//         .filter(product => product.name.includes(value))
//         .slice(0, 10);

//     searchResults.innerHTML = "";

//     filteredProducts.forEach(product => {

//         searchResults.innerHTML += `
//             <div class="search-item" data-product='${JSON.stringify(product)}'>
//                 ${product.name}
//             </div>
//         `;

//     });

//     if(filteredProducts.length > 0){
//         searchResults.style.display = "block";
//     }else{
//         searchResults.style.display = "none";
//     }

// });

// function handlePaymentStatus() {
//     const selected = document.querySelector(
//         'input[name="payment_status"]:checked'
//     );

//     if (!selected) return;

//     const paymentMethodDiv = document.getElementById('paymentMethodDiv');

//     if (selected.value === "paid") {
//         paymentMethodDiv.style.display = 'block';
//     } else {
//         paymentMethodDiv.style.display = 'none';
//     }
// }

// function setPayLater() {
//     const payLaterInput = document.getElementById("pay_later");

//     if (!payLaterInput) return;

//     payLaterInput.checked = true;

//     // مهم جداً: تشغيل نفس منطق الـ change
//     handlePaymentStatus();
// }



// function renderMainCategories(mainCategories) {
//     const container = document.getElementById("mainCategories");
//     container.innerHTML = "";


//     if (mainCategories.length === 1) {
//         hasOneMainCategory = true;
//         mainCategoriesContainer.classList.add('d-none');
//     }
//     mainCategories.forEach((category, index) => {

//         const button = document.createElement("button");
//         button.className = "btn btn-md btn-outline-primary main-category-btn";


//         // أول عنصر active
//         if (index === 0) {
//             button.classList.add("active");
//         }

//         button.innerText = `${category.name}`;


//         // event click (اختياري – للمراحل الجاية)
//         button.addEventListener("click", () => {
//             document
//                 .querySelectorAll(".main-category-btn")
//                 .forEach(el => el.classList.remove("active"));

//             button.classList.add("active");
//             renderSubCategories(category.categories);
//         });

//         container.appendChild(button);
//     });

//     if (mainCategories.length) {
//         renderSubCategories(mainCategories[0].categories);
//     }
// }

// function renderSubCategories(categories) {
//     categoryContainer.innerHTML = "";

//     if (categories.length === 1 && hasOneMainCategory) {
//         categoryContainer.classList.add('d-none');
//     }

//     categories.forEach((cat, index) => {
//         const button = document.createElement("button");
//         button.className = "btn btn-sm btn-outline-primary category-btn";
//         button.innerText = cat.name;

//         if (index === 0) {
//             button.classList.add("active");
//         }

//         button.addEventListener("click", () => {
//             document
//                 .querySelectorAll(".category-btn")
//                 .forEach(el => el.classList.remove("active"));

//             button.classList.add("active");
//             renderProducts(cat.id);

//         });

//         categoryContainer.appendChild(button);
//     });

//     renderProducts(categories[0].id);
// }


// function renderProducts(category_id = 'all') {
//     const grid = document.getElementById('products-grid');
//     grid.innerHTML = '';

//     let prices;
//     let minPrice;
//     let maxPrice;

//     const filtered = category_id === 'all'
//         ? products
//         : products.filter(p => p.category_id === category_id);

//     filtered.forEach(product => {

//         if (product.sizes.length > 1) {
//             prices = product.sizes.map(s => s.price);
//             minPrice = Math.min(...prices);
//             maxPrice = Math.max(...prices);
//         }


//         const card = document.createElement('div');

//         card.innerHTML = `
//             <div class="card product-card shadow-sm h-100" data-id="${product.id}">
//                 <div class="card-body text-center p-2">
//                     <h6 class="card-title fw-bold mb-1" style="font-size: 0.9rem;">${product.name}</h6>
//                     <p class="text-muted mb-1" style="font-size: 0.85rem;">
//                         ${product.sizes.length > 1
//                 ? `${minPrice}-${maxPrice} ₪`
//                 : `${product.price} ₪`}
//                     </p>
//                     ${product.sizes.length > 1
//                 ? '<small class="text-primary d-block mb-1" style="font-size: 0.7rem;"> <i class="fas fa-layer-group"></i> اختر الحجم</small>'
//                 : ''}
//                 </div>
//                 <div class='p-2'>
//                     <button class="btn btn-sm btn-primary w-100 py-1" style="font-size: 0.8rem;">
//                         <i class="fas fa-plus"></i> إضافة
//                     </button>
//                 </div>
                
                
                
//             </div>
//         `;
//         grid.appendChild(card);
//     });
// }
// function showSizeModal(productId) {

//     const product = products.find(p => p.id === productId);
//     selectedProductForSize = product;


//     const container = document.getElementById('sizesContainer');
//     const modalTitle = document.getElementById('modalProductName');

//     modalTitle.innerText = `${product.name}`;

//     if (product.sizes.length === 0) {
//         addToOrder(product.id, 0);
//         return;
//     }

//     // إنشاء أزرار الأحجام
//     let html = '<div class="d-flex flex-column gap-2">';
//     product.sizes.forEach((size, index) => {
//         html += `
//             <button class="btn btn-outline-primary btn-lg py-3 size-option" 
//                    data-index = "${index}" id="sizeBtn${index}">
//                 <div class="d-flex justify-content-between align-items-center px-3">
//                     <span>
//                         <i class="fas fa-check-circle me-2"></i>
//                         <strong>${size.name}</strong>
//                     </span>
//                     <span class="badge bg-primary fs-6">${size.price} ₪</span>
//                 </div>
//             </button>
//         `;
//     });
//     html += '</div>';

//     container.innerHTML = html;

//     // إظهار النافذة
//     const modal = new bootstrap.Modal(document.getElementById('sizeModal'));
//     modal.show();
// }
// function selectSize(sizeIndex) {
//     if (selectedProductForSize) {
//         addToOrder(selectedProductForSize.id, sizeIndex);
//         bootstrap.Modal.getInstance(document.getElementById('sizeModal')).hide();
//     }
// }
// function addToOrder(productId, sizeIndex) {
//     const product = products.find(p => p.id === productId);
//     if (product.sizes.length === 0) {
//         const existingItem = currentOrder.find(
//             item => item.id === productId
//         );
//         if (existingItem) {
//             existingItem.qty++;
//         }
//         else {
//             currentOrder.push({
//                 id: product.id,
//                 name: product.name,
//                 price: product.price,
//                 station: product.station,
//                 qty: 1
//             });
//         }
//     }
//     else {
//         const size = product.sizes[sizeIndex];
//         const existingItem = currentOrder.find(
//             item => item.id === productId && item.sizeIndex === sizeIndex
//         );

//         if (existingItem) {
//             existingItem.qty++;
//         } else {
//             currentOrder.push({
//                 id: product.id,
//                 name: product.name,
//                 sizeName: size.name,
//                 price: size.price,
//                 station: product.station,
//                 sizeIndex: sizeIndex,
//                 qty: 1
//             });
//         }
//     }

//     updateOrderUI(true);

// }
// function removeFromOrder(productId, sizeIndex) {
//     if (sizeIndex === 'hasOnePrice') {
//         currentOrder = currentOrder.filter(item => item.id !== productId);
//     }
//     else {
//         currentOrder = currentOrder.filter(
//             item => !(item.id === productId && item.sizeIndex === sizeIndex)
//         );
//     }
//     updateOrderUI();
// }
// function changeQty(productId, sizeIndex, change) {
//     let item;
//     if (sizeIndex === 'hasOnePrice') {
//         item = currentOrder.find(i => i.id === productId);
//     }
//     else {
//         item = currentOrder.find(
//             i => i.id === productId && i.sizeIndex === sizeIndex
//         );
//     }

//     if (item) {
//         item.qty += change;
//         if (item.qty <= 0) removeFromOrder(productId, sizeIndex);
//         else updateOrderUI();
//     }
// }


// function updateOrderUI(addNewItem = false) {
//     const list = document.getElementById('order-items-list');
//     const totalEl = document.getElementById('total-price');

//     if (currentOrder.length === 0) {
//         list.innerHTML = '<p class="text-center text-muted fs-5 mt-2">سلة الطلب فارغة</p>';
//         totalEl.innerText = '0 ₪';
//         return;
//     }

//     let html = '';
//     let total = 0;

//     currentOrder.forEach((item , index) => {
//         const itemTotal = item.price * item.qty;
//         total += itemTotal;

//         html += `
//             <div class="order-item"  ${index != currentOrder.length - 1 ? 'style="border-bottom:1px solid #000000;"' : ''}>
//                 <div class="d-flex justify-content-between align-items-start mb-2">
//                     <div>
//                         <h6 class="mb-0">
//                             ${item.name}
                            
//                             ${item.sizeName ? `<span class="size-item">- ${item.sizeName}</span>` : ''}
//                         </h6>
//                         <small class="text-muted" dir="ltr">
//                             ${item.price} ₪ × ${item.qty}
//                         </small>
//                     </div>
//                     <div class="text-end">
//                         <strong>${itemTotal} ₪</strong>
//                     </div>
//                 </div>
//                 <div class="d-flex justify-content-between align-items-center">
//                     <div class="btn-group" role="group">
//                         <button class="btn btn-sm btn-outline-secondary qty-btn qty-minus" 
//                                 data-id="${item.id}" data-sizeindex="${item.sizeIndex ?? 'hasOnePrice'}">
//                             <i class="fas fa-minus"></i>
//                         </button>
//                         <span class="btn btn-sm btn-light disabled">${item.qty}</span>
//                         <button class="btn btn-sm btn-outline-secondary qty-btn qty-plus" 
//                                 data-id="${item.id}" 
//                                 data-sizeindex="${item.sizeIndex ?? 'hasOnePrice'}"
//                             >
//                             <i class="fas fa-plus"></i>
//                         </button>
//                     </div>
//                     <button class="btn btn-sm btn-danger remove-item" data-id="${item.id}" data-sizeindex="${item.sizeIndex ?? 'hasOnePrice'}">
//                         <i class="fas fa-trash"></i>
//                     </button>
//                 </div>
//             </div>
//         `;
//     });
//     list.innerHTML = html;
//     totalEl.innerText = total + ' ₪';


//     if(addNewItem){
//         list.scrollTop = list.scrollHeight;
//     }
// }



// function submitOrder() {
//     if (currentOrder.length === 0) {
//         bootboxError('الرجاء إضافة عناصر للطلب أولاً');
//         return;
//     }
//     updateOrderDetailsModal();
//     const modal = new bootstrap.Modal(document.getElementById('confirmOrderModal'));
//     modal.show();
// }
// function updateOrderDetailsModal() {
//     const list = document.getElementById('order-details-list');
//     let html = '';
//     let total = 0;

//     currentOrder.forEach(item => {
//         const itemTotal = item.price * item.qty;
//         total += itemTotal;

//         html += `
//             <div class="order-summary-item">
//                 <div class = "d-flex gap-2">
//                     <div class="item-name">
//                         ${item.name}
//                         ${item.sizeName ? `<span class="item-size"> - ${item.sizeName}</span>` : ''}
//                     </div>
//                     <span class="item-qty">${item.qty}</span>
//                 </div>
//                 <div class="d-flex align-items-center gap-2">
//                     <span class="item-qty">${item.qty}</span>
//                     <span class="item-total" dir="ltr"> = ${item.price} x</span>
//                     <span class="item-total">${itemTotal} ₪</span>
//                 </div>
//             </div>
//         `;
//     });

//     list.innerHTML = html;
//     document.getElementById('modal-total-price').innerText = total + ' ₪';
//     finalTotalPrice.textContent = total + ' ₪';
// }
// function toggleDeliveryFields() {

//     const tableNumberDiv = document.getElementById('tableNumberDiv');
//     const customerPhoneDiv = document.getElementById('customerPhoneDiv');
//     const customerAddressDiv = document.getElementById('customerAddressDiv');
//     const paymentStatusDiv = document.getElementById('paymentStatusDiv');
//     const paymentMethodDiv = document.getElementById('paymentMethodDiv');



//     if (orderType.value === 'سفري') {
//         customerPhoneDiv.style.display = 'block';
//         customerAddressDiv.style.display = 'block';
//         paymentMethodDiv.style.display = 'block';
//         tableNumberDiv.style.display = 'none';
//         paymentStatusDiv.style.display = 'none';
//         tableNumber.value = '';

//     }
//     else {
//         tableNumberDiv.style.display = 'block';
//         customerPhoneDiv.style.display = 'none';
//         customerAddressDiv.style.display = 'none';
//         paymentStatusDiv.style.display = 'block';
//         setPayLater();
//     }
// }
// async function confirmAndSendOrder() {
//     let total_price = 0;
//     currentOrder.forEach(item => {
//         total_price += item.price * item.qty;
//     });

//     finalOrderDetails.items = currentOrder;
//     finalOrderDetails.totalPrice = total_price;
//     finalOrderDetails.orderType = orderType.value;
//     finalOrderDetails.paymentMethod = paymentMethod.value;
//     finalOrderDetails.note = orderNotes.value;
//     finalOrderDetails.tableNum = Number(tableNumber.value);
//     finalOrderDetails.phoneNum = customerPhone.value;
//     finalOrderDetails.address = customerAddress.value;
//     finalOrderDetails.discount = Number(discountInput.value);

//     finalOrderDetails.paymentStatus = getPaymentStatus();


//     // console.log(finalOrderDetails);

   

//     const res = await createOrder();
//     if (res.success) {
//         finalOrderDetails.inv_num = res.inv_num;
//         //splitByStation(finalOrderDetails);
//         bootstrap.Modal.getInstance(document.getElementById('confirmOrderModal')).hide();
//         currentOrder = [];
//         updateOrderUI();
//         clearModalData();
//         showSuccessModal();
//     }

// }
// function clearFinalOrderDetails() {
//     finalOrderDetails = {
//         items: [],
//         totalPrice: 0,
//         orderType: '',
//         paymentMethod: '',
//         note: '',
//         tableNum: 0,
//         phoneNum: '',
//         address: '',
//         discount: 0,
//     };
// }

// function getPaymentStatus() {
//     const selected = document.querySelector('input[name="payment_status"]:checked');

//     if (!selected) return null;

//     return selected.value;
// }

// function splitByStation(orderDetails) {

//     const result = {
//         kitchen: {
//             station : 'فاتورة المطبخ',
//             inv_num : orderDetails.inv_num,
//             type: orderDetails.orderType,
//             note: orderDetails.note,
//             table_num: orderDetails.tableNum,
//             phone_num: orderDetails.phoneNum,
//             address: orderDetails.address,
//             printer_name : 'kitchen',
//             items: []
//         },
//         bar: { 
//             station : 'فاتورة البار',
//             inv_num : orderDetails.inv_num,
//             type: orderDetails.orderType,
//             note: orderDetails.note,
//             table_num: orderDetails.tableNum,
//             phone_num: orderDetails.phoneNum,
//             address: orderDetails.address,
//             printer_name : 'bar',
//             items: [] 
//         },
//         shisha: { 
//             station : 'فاتورة الأراجيل',
//             inv_num : orderDetails.inv_num,
//             type: orderDetails.orderType,
//             note: orderDetails.note,
//             table_num: orderDetails.tableNum,
//             phone_num: orderDetails.phoneNum,
//             address: orderDetails.address,
//             printer_name : 'shisha',
//             items: [] 
//         }
//     };

//     orderDetails.items.forEach(item => {
//         result[item.station].items.push(item);
//     });


// }

// function clearModalData() {
//     orderType.value = 'طاولة';
//     paymentMethod.value = 'كاش';
//     tableNumber.value = '';
//     customerPhone.value = '';
//     customerAddress.value = '';
//     orderNotes.value = '';
//     toggleDeliveryFields();
// }
// function showSuccessModal() {
//     const modal = new bootstrap.Modal(successModelOrder);
//     modal.show();
// }

// function closeSuccessModal() {
//     bootstrap.Modal.getInstance(successModelOrder).hide();
// }

// async function fetchMenuDetails() {
//     hiddeError(errorBox);
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
//             if (data.length === 0) {
//                 showError(errorBox, 'لا يوجد أصناف مضافة');
//                 return;
//             }

//             categoriesData = data.mainCategories;
//             products = data.items;

//         }
//         else {
//             showError(errorBox, data.message);
//         }

//     } catch (err) {
//         showError(errorBox, err.message);
//     }
// }
// async function createOrder() {
//     displaySpinnerLoader(confirmOrderModal);
//     try {
//         // urlServer + `/creat/order?session_id=${sessionId}`;
//         // /api/order/creat?session_id=${sessionId}

//         const res = await fetch(urlServer + `/creat/order?session_id=${sessionId}`, {
//             method: 'POST',
//             headers: {
//                 "Content-Type": "application/json",
//                 "Authorization": `${getAuthToken('user-auth')}`
//             },
//             body: JSON.stringify(finalOrderDetails),
//         });
//         const data = await res.json();
//         if (res.status === 401) {
//             showAuthExpired(data.message);
//             return false;
//         }
//         else if (res.status === 200) {
//             return {
//                 inv_num: data.invoiceNum,
//                 success: data.success
//             };
//         }
//         else {
//             bootboxError(data.message);
//             return false;
//         }

//     } catch (err) {
//         bootboxError(err.message);
//         return false;
//     }
//     finally {
//         hiddeSpinnerLoader(confirmOrderModal);
//     }
// }
// async function checkSession() {
//     try {
//         const res = await fetch(urlServer + '/check/cash-session', {
//             method: 'GET',
//             headers: {
//                 "Content-Type": "application/json",
//                 "Authorization": `${getAuthToken('user-auth')}`
//             }
//         });
//         const data = await res.json();
//         if (res.status === 401) {
//             showAuthExpired(data.message);
//             return false;
//         }
//         else if (res.status === 200) {
//              if (data.hasOpeningSession) {
//                 sessionId = data.session_id;
//              }
//             return data.hasOpeningSession
//         }
//         else {
//             showError(errorBox, data.message);
//             return false;
//         }
//     } catch (e) {
//         showError(errorBox, e);
//     }

// }
// async function loadAndRenderItems() {
//     await fetchMenuDetails();
//     renderMainCategories(categoriesData);
// }



// function displaySpinner() {
//     spinnerLoad.classList.add('d-flex');
//     spinnerLoad.classList.remove('hidden');
// }
// function hiddeSpinner() {
//     spinnerLoad.classList.remove('d-flex');
//     spinnerLoad.classList.add('hidden');
// }

// function displaySpinnerLoader(modal) {
//     const spinnerLoader = modal.querySelector(".modal-loading-overlay");
//     spinnerLoader.classList.remove('hidden');
//     spinnerLoader.classList.add('d-flex');
// }
// function hiddeSpinnerLoader(modal) {
//     const spinnerLoader = modal.querySelector(".modal-loading-overlay");
//     spinnerLoader.classList.add('hidden');
//     spinnerLoader.classList.remove('d-flex');
// }
// function handleSessionStatus() {
//     const sessionStatusDiv = document.getElementById('sessionStatus');
//     sessionStatusDiv.classList.remove('d-none');
// }


// function setCategoryIdForSearchResults(categoryId){
//     lastCategoryIdBySearchResults = categoryId;
// }
// function fillterProducts(product){
//     const grid = document.getElementById('products-grid');
//     grid.innerHTML = '';

//     let prices ;
//     let minPrice ;
//     let maxPrice ;


//     if(product.sizes.length > 1){
//         prices = product.sizes.map(s => s.price);
//         minPrice = Math.min(...prices);
//         maxPrice = Math.max(...prices);
//     }
    
    
//     const card = document.createElement('div');

//     card.innerHTML = `
//         <div class="card product-card shadow-sm h-100" data-id="${product.id}">
//             <div class="card-body text-center p-2">
//                 <h6 class="card-title fw-bold mb-1" style="font-size: 0.9rem;">${product.name}</h6>
//                 <p class="text-muted mb-1" style="font-size: 0.85rem;">
//                     ${product.sizes.length > 1 
//                         ? `${minPrice}-${maxPrice} ₪` 
//                         : `${product.price} ₪`}
//                 </p>
//                 ${product.sizes.length > 1 
//                     ? '<small class="text-primary d-block mb-1" style="font-size: 0.7rem;"> <i class="fas fa-layer-group"></i> اختر الحجم</small>' 
//                     : ''}
//             </div>
//             <div class='p-2'>
//                 <button class="btn btn-sm btn-primary w-100 py-1" style="font-size: 0.8rem;">
//                     <i class="fas fa-plus"></i> إضافة
//                 </button>
//             </div>
            
            
            
//         </div>
//     `;

//     grid.appendChild(card);

// }
// function fillterCategoriesByProduct(categoryId){
//     let result = null;
//     for (const main of categoriesData) {
//         const foundSub = main.categories.find(cat => cat.id === categoryId);

//         if (foundSub) {
//             result = {
//                 mainCategoryName: main.name,
//                 subCategoryName: foundSub.name
//             };
//             break;
//         }
//     }
//     activateCategoryButtons(result);
// }

// function activateCategoryButtons(mainAndSubCategoryForProduct){
//     const mainBtn = getMainCategoryBtn(mainAndSubCategoryForProduct.mainCategoryName);

//     mainBtn?.click();

//     requestAnimationFrame(() => {
//         const subBtn = getSubCategoryBtn(mainAndSubCategoryForProduct.subCategoryName);
//         subBtn?.click();
//     });
// }

// function getMainCategoryBtn(mainCategoryName){
//     return [...document.querySelectorAll(".main-category-btn")]
//     .find(btn => btn.innerText.trim() === mainCategoryName);
// }
// function getSubCategoryBtn(subCategoryName){
//     return [...document.querySelectorAll(".category-btn")]
//     .find(btn => btn.innerText.trim() === subCategoryName);
// }




// function initHorizontalScroll({ container, leftArrow, rightArrow, step }) {
//     function updateArrows() {


//         if (window.innerWidth < 992) {
//             leftArrow.classList.add("hidden");
//             rightArrow.classList.add("hidden");
//             return;
//         }


//         const maxScroll = container.scrollWidth - container.clientWidth;

//         if (maxScroll <= 0) {
//             leftArrow.classList.add("hidden");
//             rightArrow.classList.add("hidden");
//             return;
//         }


//         const current = Math.abs(container.scrollLeft);

//         rightArrow.classList.toggle("hidden", current <= 5);
//         leftArrow.classList.toggle("hidden", current >= maxScroll - 5);
//     }

//     leftArrow.onclick = () => {
//         container.scrollBy({ left: -step, behavior: "smooth" });
//     };

//     rightArrow.onclick = () => {
//         container.scrollBy({ left: step, behavior: "smooth" });
//     };



//     container.addEventListener("scroll", updateArrows);
//     window.addEventListener("load", updateArrows);
//     window.addEventListener("resize", updateArrows);

//     requestAnimationFrame(updateArrows);
// }



import { setActiveNavLink, showAuthExpired, showError, hiddeError, bootboxError, showPrintLoader, hidePrintLoader } from "../../../component/bootbox.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken} from "../../../component/auth.js";
import { printInvoiceFromCashier, generateStationInvoice } from "../../../component/invoices.js";
import { closeSideBar } from "../Switch-user-functionality.js";

const header = document.querySelector("site-header");
const mainCategoriesContainer = document.getElementById('mainCategoriesContainer');
const categoryContainer = document.getElementById('categoryContainer');
const orderType = document.getElementById('orderType');
const paymentMethod = document.getElementById('paymentMethod');
const tableNumber = document.getElementById('tableNumber');
const spinnerLoad = document.getElementById('spinnerLoad');
const errorBox = document.getElementById('error-box');

const confirmSendBtn = document.getElementById('confirmSendBtn');
const confirmOrderModal = document.getElementById('confirmOrderModal');
const successModelOrder = document.getElementById('successModal');

const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
let lastCategoryIdBySearchResults = 0;

const discountInput = document.getElementById("discountAmount");
const finalTotalPrice = document.getElementById("finalTotalPrice");
const discountPercentageInput = document.getElementById("discountPercentage");


const paymentTotalSummary = document.getElementById('paymentTotalSummary');

const changeAmountSummary = document.getElementById('changeAmountSummary');


let finalOrderDetails = {
    items: [],
    totalPrice: 0,
    orderType: '',
    paymentMethod: '',
    note: '',
    tableNum: 0,
    phoneNum: '',
    address: '',
    discount: 0,
};

let sessionId = 0;

let currentOrder = [];

let products = [];
let categoriesData = [];

let usdRate = 0;
let jodRate = 0;
let eurRate = 0;


let hasOneMainCategory = false;
let selectedProductForSize = null;

let cashDrawerPromise;

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


document.addEventListener("DOMContentLoaded", async function () {
    document.getElementById('employeeName').textContent = 'كاشير';
    displaySpinner();
    const hasOpeningSession = await checkSession();
    if (hasOpeningSession) {
        await loadAndRenderItems();
    }
    else {
        handleSessionStatus();
    }
    hiddeSpinner();

    initHorizontalScroll({
        container: document.getElementById("mainCategories"),
        leftArrow: document.getElementById("scrollLeft"),
        rightArrow: document.getElementById("scrollRight"),
        step: 300
    });

    initHorizontalScroll({
        container: document.getElementById("categoryContainer"),
        leftArrow: document.getElementById("subScrollLeft"),
        rightArrow: document.getElementById("subScrollRight"),
        step: 300
    });
});

confirmOrderModal.addEventListener('hidden.bs.modal', () => {
    paymentMethod.value = 'كاش';
    orderType.value = 'سفري';
    toggleDeliveryFields();
    discountInput.value = '';
    discountPercentageInput.value = '';
    finalTotalPrice.textContent = '0 ₪';
    paymentTotalSummary.textContent = '0 ₪';
    setChangeAmountSummary();
    confirmSendBtn.disabled = false;
    tableNumber.value = '';
    orderCurrency.value = 'ILS';
    updateCurrencyFields();
});



discountInput.addEventListener("input", () => {
    updateFinalTotal("amount");
});

discountPercentageInput.addEventListener("input", () => {
    updateFinalTotal("percentage");
});

function updateFinalTotal(type) {
    // استخراج المجموع الأساسي
    const totalText = document.getElementById("modal-total-price").textContent;
    const total = parseFloat(totalText.replace(/[^\d.]/g, "")) || 0;

    let discount = 0;
    let percentage = 0;

    // المستخدم أدخل الخصم بالشيكل
    if (type === "amount") {
        discount = parseFloat(roundDiscount(Number(discountInput.value))) || 0;

        // منع الخصم من أن يكون أكبر من المجموع
        discount = Math.min(discount, total);

        // حساب النسبة المئوية
        percentage = total > 0
            ? (discount / total) * 100
            : 0;

        // تحديث مدخل النسبة
        discountPercentageInput.value =
            percentage > 0 ? percentage.toFixed(2) : "";
    }

    // المستخدم أدخل الخصم بالنسبة المئوية
    if (type === "percentage") {
        percentage = parseFloat(discountPercentageInput.value) || 0;

        // منع النسبة من تجاوز 100%
        percentage = Math.min(percentage, 100);

        // حساب قيمة الخصم بالشيكل
        discount = (total * percentage) / 100;

        // تحديث مدخل الخصم
        discountInput.value =
            discount > 0 ? roundDiscount(Number(discount)) : "";
    }

    // التحقق من الخصم
    checkDiscount(discount, total);

    // حساب السعر النهائي
    const finalPrice = Math.max(total - discount, 0);

    // تحديث المجموع النهائي
    finalTotalPrice.textContent = `${finalPrice.toFixed(2)} ₪`;

    // paymentTotalSummary.textContent = `${Math.floor(finalPrice)} ₪`;

    paymentTotalSummary.textContent = `${Number(total) - Number(discountInput.value)} ₪`;
    setChangeAmountSummary();
}

function checkDiscount(discount, total) {
    if (discount > total || discount < 0) {
        confirmSendBtn.disabled = true;
    }
    else {
        confirmSendBtn.disabled = false;
    }
}

orderType.addEventListener('change', toggleDeliveryFields);


document.addEventListener("click", async function (e) {

    if (e.target.closest('.product-card')) {
        const card = e.target.closest(".product-card");
        const productId = card.dataset.id;

        let overlay = card.querySelector('.card-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'card-overlay';
            card.appendChild(overlay);
        }

        let checkIcon = card.querySelector('.check-icon');
        if (!checkIcon) {
            checkIcon = document.createElement('i');
            checkIcon.className = 'fas fa-check-circle check-icon';
            card.appendChild(checkIcon);
        }
        overlay.style.display = 'block';
        checkIcon.style.display = 'block';




        showSizeModal(Number(productId));




        setTimeout(() => {
            overlay.style.display = 'none';
            checkIcon.style.display = 'none';
        }, 1000);

        return;
    }

    else if (e.target.closest('.size-option')) {
        const sizeBtn = e.target.closest('.size-option');
        const index = sizeBtn.dataset.index;
        selectSize(Number(index));
        return;
    }

    else if (e.target.closest('.qty-plus')) {
        const item = e.target.closest('.qty-plus');
        const id = item.dataset.id;
        const sizeindex = item.dataset.sizeindex;

        if (sizeindex === 'hasOnePrice') {
            changeQty(Number(id), sizeindex, 1);
        }

        else {
            changeQty(Number(id), Number(sizeindex), 1);
        }

        return;
    }

    else if (e.target.closest('.qty-minus')) {
        const item = e.target.closest('.qty-minus');
        const id = item.dataset.id;
        const sizeindex = item.dataset.sizeindex;
        if (sizeindex === 'hasOnePrice') {
            changeQty(Number(id), sizeindex, -1);
        }
        else {
            changeQty(Number(id), Number(sizeindex), -1);
        }
        return;
    }

    else if (e.target.closest('.remove-item')) {
        const item = e.target.closest('.remove-item');
        const id = item.dataset.id;
        const sizeindex = item.dataset.sizeindex;

        if (sizeindex === 'hasOnePrice') {
            removeFromOrder(Number(id), sizeindex);
            return;
        }
        removeFromOrder(Number(id), Number(sizeindex));
        return;
    }

    else if (e.target.closest('.submit-order-btn')) {
        submitOrder();
        return;
    }

    else if (e.target.closest('.send-order-btn')) {
        confirmAndSendOrder();
        return;
    }


    else if (e.target.closest('.print-invoice-btn')) {
        closeSuccessModal();
        await cashDrawerPromise;
        try {
            await printInvoiceFromCashier(finalOrderDetails, 'cashier_printer');
        } catch (e) {
            bootboxError(e.message);
        } finally {
            cashDrawerPromise = null;
            clearFinalOrderDetails();
        }
    }



    else if (e.target.closest('.close-success-modal')) {
        clearFinalOrderDetails();
        closeSuccessModal();
        return;
    }

    else if (e.target.closest('.switch-admin-btn')) {
        const input = document.getElementById('adminPassword');
        await SwitchToAdmin(url, input.value);
    }

    else if (e.target.closest('.search-item')) {
        const itemEl = e.target.closest('.search-item');

        const product = JSON.parse(itemEl.dataset.product);

        searchInput.value = product.name;
        searchResults.style.display = "none";
        setCategoryIdForSearchResults(product.category_id);
        fillterCategoriesByProduct(product.category_id);

        requestAnimationFrame(() => {
            fillterProducts(product);
        });

    }
});

document.querySelectorAll('input[name="payment_status"]').forEach(input => {
    input.addEventListener("change", handlePaymentStatus);
});

document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        try {
            await openCashDrawer('سفري');
        } catch (error) {
            bootboxError("Cash drawer error:", error);
        }
    }
});



searchInput.addEventListener("input", function () {

    const value = this.value.trim();

    if (value === "") {
        searchResults.style.display = "none";
        if (lastCategoryIdBySearchResults > 0) {
            renderProducts(lastCategoryIdBySearchResults);
        }
        return;
    }

    const filteredProducts = products
        .filter(product => product.name.includes(value))
        .slice(0, 10);

    searchResults.innerHTML = "";

    filteredProducts.forEach(product => {

        searchResults.innerHTML += `
            <div class="search-item" data-product='${JSON.stringify(product)}'>
                ${product.name}
            </div>
        `;

    });

    if (filteredProducts.length > 0) {
        searchResults.style.display = "block";
    } else {
        searchResults.style.display = "none";
    }

});

function handlePaymentStatus() {
    const selected = document.querySelector(
        'input[name="payment_status"]:checked'
    );

    if (!selected) return;

    const paymentMethodDiv = document.getElementById('paymentMethodDiv');

    if (selected.value === "paid") {
        paymentMethodDiv.style.display = 'block';
    } else {
        paymentMethodDiv.style.display = 'none';
    }
}

function setPayLater() {
    const payLaterInput = document.getElementById("pay_later");

    if (!payLaterInput) return;

    payLaterInput.checked = true;

    // مهم جداً: تشغيل نفس منطق الـ change
    handlePaymentStatus();
}



function renderMainCategories(mainCategories) {
    const container = document.getElementById("mainCategories");
    container.innerHTML = "";


    if (mainCategories.length === 1) {
        hasOneMainCategory = true;
        mainCategoriesContainer.classList.add('d-none');
    }
    mainCategories.forEach((category, index) => {

        const button = document.createElement("button");
        button.className = "btn btn-md btn-outline-primary main-category-btn";


        // أول عنصر active
        if (index === 0) {
            button.classList.add("active");
        }

        button.innerText = `${category.name}`;


        // event click (اختياري – للمراحل الجاية)
        button.addEventListener("click", () => {
            document
                .querySelectorAll(".main-category-btn")
                .forEach(el => el.classList.remove("active"));

            button.classList.add("active");
            renderSubCategories(category.categories);
        });

        container.appendChild(button);
    });

    if (mainCategories.length) {
        renderSubCategories(mainCategories[0].categories);
    }
}

function renderSubCategories(categories) {
    categoryContainer.innerHTML = "";

    if (categories.length === 1 && hasOneMainCategory) {
        categoryContainer.classList.add('d-none');
    }

    categories.forEach((cat, index) => {
        const button = document.createElement("button");
        button.className = "btn btn-sm btn-outline-primary category-btn";
        button.innerText = cat.name;

        if (index === 0) {
            button.classList.add("active");
        }

        button.addEventListener("click", () => {
            document
                .querySelectorAll(".category-btn")
                .forEach(el => el.classList.remove("active"));

            button.classList.add("active");
            renderProducts(cat.id);

        });

        categoryContainer.appendChild(button);
    });

    renderProducts(categories[0].id);
}


function renderProducts(category_id = 'all') {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';

    let prices;
    let minPrice;
    let maxPrice;

    const filtered = category_id === 'all'
        ? products
        : products.filter(p => p.category_id === category_id);

    filtered.forEach(product => {

        if (product.sizes.length > 1) {
            prices = product.sizes.map(s => s.price);
            minPrice = Math.min(...prices);
            maxPrice = Math.max(...prices);
        }


        const card = document.createElement('div');

        card.innerHTML = `
            <div class="card product-card shadow-sm h-100" data-id="${product.id}">
                <div class="card-body text-center p-2">
                    <h6 class="card-title fw-bold mb-1" style="font-size: 0.9rem;">${product.name}</h6>
                    <p class="text-muted mb-1" style="font-size: 0.85rem;">
                        ${product.sizes.length > 1
                ? `${minPrice}-${maxPrice} ₪`
                : `${product.price} ₪`}
                    </p>
                    ${product.sizes.length > 1
                ? '<small class="text-primary d-block mb-1" style="font-size: 0.7rem;"> <i class="fas fa-layer-group"></i> اختر الحجم</small>'
                : ''}
                </div>
                <div class='p-2'>
                    <button class="btn btn-sm btn-primary w-100 py-1" style="font-size: 0.8rem;">
                        <i class="fas fa-plus"></i> إضافة
                    </button>
                </div>
                
                
                
            </div>
        `;
        grid.appendChild(card);
    });
}
function showSizeModal(productId) {

    const product = products.find(p => p.id === productId);
    selectedProductForSize = product;


    const container = document.getElementById('sizesContainer');
    const modalTitle = document.getElementById('modalProductName');

    modalTitle.innerText = `${product.name}`;

    if (product.sizes.length === 0) {
        addToOrder(product.id, 0);
        return;
    }

    // إنشاء أزرار الأحجام
    let html = '<div class="d-flex flex-column gap-2">';
    product.sizes.forEach((size, index) => {
        html += `
            <button class="btn btn-outline-primary btn-lg py-3 size-option" 
                   data-index = "${index}" id="sizeBtn${index}">
                <div class="d-flex justify-content-between align-items-center px-3">
                    <span>
                        <i class="fas fa-check-circle me-2"></i>
                        <strong>${size.name}</strong>
                    </span>
                    <span class="badge bg-primary fs-6">${size.price} ₪</span>
                </div>
            </button>
        `;
    });
    html += '</div>';

    container.innerHTML = html;

    // إظهار النافذة
    const modal = new bootstrap.Modal(document.getElementById('sizeModal'));
    modal.show();
}
function selectSize(sizeIndex) {
    if (selectedProductForSize) {
        addToOrder(selectedProductForSize.id, sizeIndex);
        bootstrap.Modal.getInstance(document.getElementById('sizeModal')).hide();
    }
}
function addToOrder(productId, sizeIndex) {
    const product = products.find(p => p.id === productId);
    if (product.sizes.length === 0) {
        const existingItem = currentOrder.find(
            item => item.id === productId
        );
        if (existingItem) {
            existingItem.qty++;
        }
        else {
            currentOrder.push({
                id: product.id,
                name: product.name,
                price: product.price,
                station: product.station,
                discount_item: 0,
                qty: 1
            });
        }
    }
    else {
        const size = product.sizes[sizeIndex];
        const existingItem = currentOrder.find(
            item => item.id === productId && item.sizeIndex === sizeIndex
        );

        if (existingItem) {
            existingItem.qty++;
        } else {
            currentOrder.push({
                id: product.id,
                name: product.name,
                sizeName: size.name,
                price: size.price,
                station: product.station,
                sizeIndex: sizeIndex,
                discount_item: 0,
                qty: 1
            });
        }
    }

    updateOrderUI(true);

}
function removeFromOrder(productId, sizeIndex) {
    if (sizeIndex === 'hasOnePrice') {
        currentOrder = currentOrder.filter(item => item.id !== productId);
    }
    else {
        currentOrder = currentOrder.filter(
            item => !(item.id === productId && item.sizeIndex === sizeIndex)
        );
    }
    updateOrderUI();
}
function changeQty(productId, sizeIndex, change) {
    let item;
    if (sizeIndex === 'hasOnePrice') {
        item = currentOrder.find(i => i.id === productId);
    }
    else {
        item = currentOrder.find(
            i => i.id === productId && i.sizeIndex === sizeIndex
        );
    }

    if (item) {
        item.qty += change;
        if (item.qty <= 0) removeFromOrder(productId, sizeIndex);
        else updateOrderUI();
    }
}


function updateOrderUI(addNewItem = false) {
    const list = document.getElementById('order-items-list');
    const totalEl = document.getElementById('total-price');

    if (currentOrder.length === 0) {
        list.innerHTML = '<p class="text-center text-muted fs-5 mt-2">سلة الطلب فارغة</p>';
        totalEl.innerText = '0 ₪';
        return;
    }

    let html = '';
    let total = 0;

    currentOrder.forEach((item, index) => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;

        html += `
            <div class="order-item"  ${index != currentOrder.length - 1 ? 'style="border-bottom:1px solid #000000;"' : ''}>
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h6 class="mb-0">
                            ${item.name}
                            
                            ${item.sizeName ? `<span class="size-item">- ${item.sizeName}</span>` : ''}
                        </h6>
                        <small class="text-muted" dir="ltr">
                            ${item.price} ₪ × ${item.qty}
                        </small>
                    </div>
                    <div class="text-end">
                        <strong>${itemTotal} ₪</strong>
                    </div>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-secondary qty-btn qty-minus" 
                                data-id="${item.id}" data-sizeindex="${item.sizeIndex ?? 'hasOnePrice'}">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="btn btn-sm btn-light disabled">${item.qty}</span>
                        <button class="btn btn-sm btn-outline-secondary qty-btn qty-plus" 
                                data-id="${item.id}" 
                                data-sizeindex="${item.sizeIndex ?? 'hasOnePrice'}"
                            >
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <button class="btn btn-sm btn-danger remove-item" data-id="${item.id}" data-sizeindex="${item.sizeIndex ?? 'hasOnePrice'}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
    totalEl.innerText = total + ' ₪';


    if (addNewItem) {
        list.scrollTop = list.scrollHeight;
    }
}



function submitOrder() {
    if (currentOrder.length === 0) {
        bootboxError('الرجاء إضافة عناصر للطلب أولاً');
        return;
    }
    updateOrderDetailsModal();
    const modal = new bootstrap.Modal(document.getElementById('confirmOrderModal'));
    modal.show();
}
function updateOrderDetailsModal() {
    const list = document.getElementById('order-details-list');

    let total = 0;
    let html = `
        <div class="table-responsive">
            <table class="table table-bordered table-sm align-middle text-center mb-0">
                <thead class="table-light">
                    <tr>
                        <th>الصنف</th>
                        <th>سعر الوحدة</th>
                        <th>الكمية</th>
                        <th>المجموع</th>
                        <th>ملاحظة</th>
                    </tr>
                </thead>
                <tbody>
    `;

    currentOrder.forEach((item, index) => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;

        html += `
        <tr>
            <td class="text-start">
                ${item.name}
                ${item.sizeName
                ? `<span class="text-muted"> - ${item.sizeName}</span>`
                : ''
            }
            </td>

            <td dir="ltr">
                ${item.price} ₪
            </td>

            <td>
                ${item.qty}
            </td>

            <td class="fw-bold" dir="ltr">
                ${itemTotal} ₪
            </td>

            <td>
                <input 
                    type="text"
                    class="form-control form-control-sm item-note"
                    data-index="${index}"
                    value="${item.note || ''}"
                    placeholder="ملاحظة..."
                >
            </td>
        </tr>
    `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    list.innerHTML = html;

    list.querySelectorAll('.item-note').forEach(input => {
        input.addEventListener('input', function () {
            const index = Number(this.dataset.index);
            currentOrder[index].note = this.value;
        });
    });


    document.getElementById('modal-total-price').innerText = total + ' ₪';
    finalTotalPrice.textContent = total + ' ₪';
    paymentTotalSummary.textContent = Math.floor(total) + ' ₪';
    setChangeAmountSummary();
}
function toggleDeliveryFields() {

    const tableNumberDiv = document.getElementById('tableNumberDiv');
    const paymentStatusDiv = document.getElementById('paymentStatusDiv');
    const paymentMethodDiv = document.getElementById('paymentMethodDiv');
    const discountDev = document.getElementById('discountDev');


    if (orderType.value === 'سفري') {
        paymentMethodDiv.style.display = 'block';
        tableNumberDiv.style.display = 'none';
        paymentStatusDiv.style.display = 'none';
        tableNumber.value = '';
        discountDev.style.display = 'block';
    }
    else {
        tableNumberDiv.style.display = 'block';
        paymentStatusDiv.style.display = 'block';
        discountDev.style.display = 'none';
        setPayLater();
    }

    resSetDiscountInput();



}
async function confirmAndSendOrder() {
    let total_price = 0;
    currentOrder.forEach(item => {
        total_price += item.price * item.qty;
    });

    finalOrderDetails.items = currentOrder;
    finalOrderDetails.totalPrice = total_price;
    finalOrderDetails.orderType = orderType.value;
    finalOrderDetails.paymentMethod = paymentMethod.value;
    finalOrderDetails.tableNum = Number(tableNumber.value);
    finalOrderDetails.discount = Number(discountInput.value);
    finalOrderDetails.currency = orderCurrency.value;

    finalOrderDetails.paymentStatus = getPaymentStatus();



    // console.log(finalOrderDetails);


    // cashDrawerPromise = openCashDrawer(finalOrderDetails.orderType)
    // .catch(error => {
    //     bootboxError("Cash drawer error:", error);
    //     return false;
    // });

    const res = await createOrder();
    if (res.success) {
        finalOrderDetails.invoice_num = res.inv_num;

        bootstrap.Modal.getInstance(document.getElementById('confirmOrderModal')).hide();
        currentOrder = [];
        updateOrderUI();
        clearModalData();

        // splitByStation(finalOrderDetails);

        showSuccessModal();


    }

}
function clearFinalOrderDetails() {
    finalOrderDetails = {
        items: [],
        totalPrice: 0,
        orderType: '',
        paymentMethod: '',
        note: '',
        tableNum: 0,
        phoneNum: '',
        address: '',
        discount: 0,
    };
}

function getPaymentStatus() {
    const selected = document.querySelector('input[name="payment_status"]:checked');

    if (!selected) return null;

    return selected.value;
}

async function splitByStation(orderDetails) {

    const result = {
        kitchen: {
            station: 'فاتورة المطبخ',
            invoice_num: orderDetails.invoice_num,
            type: orderDetails.orderType,
            note: orderDetails.note,
            table_num: orderDetails.tableNum,
            phone_num: orderDetails.phoneNum,
            address: orderDetails.address,
            printer_name: 'kitchen',
            items: []
        },
        bar: {
            station: 'فاتورة البار',
            invoice_num: orderDetails.invoice_num,
            type: orderDetails.orderType,
            note: orderDetails.note,
            table_num: orderDetails.tableNum,
            phone_num: orderDetails.phoneNum,
            address: orderDetails.address,
            printer_name: 'bar',
            items: []
        },
        shisha: {
            station: 'فاتورة الأراجيل',
            invoice_num: orderDetails.invoice_num,
            type: orderDetails.orderType,
            note: orderDetails.note,
            table_num: orderDetails.tableNum,
            phone_num: orderDetails.phoneNum,
            address: orderDetails.address,
            printer_name: 'shisha',
            items: []
        },
        oven: {
            station: 'فاتورة الفرن',
            invoice_num: orderDetails.invoice_num,
            type: orderDetails.orderType,
            note: orderDetails.note,
            table_num: orderDetails.tableNum,
            phone_num: orderDetails.phoneNum,
            address: orderDetails.address,
            printer_name: 'oven',
            items: []
        }
    };

    orderDetails.items.forEach(item => {
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

function clearModalData() {
    orderType.value = 'سفري';
    paymentMethod.value = 'كاش';
    tableNumber.value = '';
    toggleDeliveryFields();
    orderCurrency.value = 'ILS';
    updateCurrencyFields();

    discountInput.value = '';
    discountPercentageInput.value = '';
}
function showSuccessModal() {
    const modal = new bootstrap.Modal(successModelOrder);
    modal.show();
}

function closeSuccessModal() {
    bootstrap.Modal.getInstance(successModelOrder).hide();
}

async function fetchMenuDetails() {
    hiddeError(errorBox);
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
            if (data.length === 0) {
                showError(errorBox, 'لا يوجد أصناف مضافة');
                return;
            }

            categoriesData = data.mainCategories;
            products = data.items;

        }
        else {
            showError(errorBox, data.message);
        }

    } catch (err) {
        showError(errorBox, err.message);
    }
}
async function createOrder() {
    displaySpinnerLoader(confirmOrderModal);
    try {
        
        const res = await fetch(urlServer + `/creat/order?session_id=${sessionId}`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            body: JSON.stringify(finalOrderDetails),
        });

        const data = await res.json();
        if (res.status === 401) {
            showAuthExpired(data.message);
            return false;
        }
        else if (res.status === 200) {
            return {
                inv_num: data.invoiceNum,
                success: data.success
            };
        }
        else {
            bootboxError(data.message);
            return false;
        }

    } catch (err) {
        bootboxError(err.message);
        return false;
    }
    finally {
        hiddeSpinnerLoader(confirmOrderModal);
    }
}
async function checkSession() {
    try {
        const res = await fetch(urlServer + '/check/cash-session', {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            }
        });
        const data = await res.json();
        if (res.status === 401) {
            showAuthExpired(data.message);
            return false;
        }
        else if (res.status === 200) {
            if (data.hasOpeningSession) {
                sessionId = data.session_id;
                usdRate = 0;
                jodRate = 0;
                eurRate = 0;
            }
            return data.hasOpeningSession
        }
        else {
            showError(errorBox, data.message);
            return false;
        }
    } catch (e) {
        showError(errorBox, e);
    }

}
async function loadAndRenderItems() {
    await fetchMenuDetails();
    renderMainCategories(categoriesData);
}



function displaySpinner() {
    spinnerLoad.classList.add('d-flex');
    spinnerLoad.classList.remove('hidden');
}
function hiddeSpinner() {
    spinnerLoad.classList.remove('d-flex');
    spinnerLoad.classList.add('hidden');
}

function displaySpinnerLoader(modal) {
    const spinnerLoader = modal.querySelector(".modal-loading-overlay");
    spinnerLoader.classList.remove('hidden');
    spinnerLoader.classList.add('d-flex');
}
function hiddeSpinnerLoader(modal) {
    const spinnerLoader = modal.querySelector(".modal-loading-overlay");
    spinnerLoader.classList.add('hidden');
    spinnerLoader.classList.remove('d-flex');
}
function handleSessionStatus() {
    const sessionStatusDiv = document.getElementById('sessionStatus');
    sessionStatusDiv.classList.remove('d-none');
}


function setCategoryIdForSearchResults(categoryId) {
    lastCategoryIdBySearchResults = categoryId;
}
function fillterProducts(product) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';

    let prices;
    let minPrice;
    let maxPrice;


    if (product.sizes.length > 1) {
        prices = product.sizes.map(s => s.price);
        minPrice = Math.min(...prices);
        maxPrice = Math.max(...prices);
    }


    const card = document.createElement('div');

    card.innerHTML = `
        <div class="card product-card shadow-sm h-100" data-id="${product.id}">
            <div class="card-body text-center p-2">
                <h6 class="card-title fw-bold mb-1" style="font-size: 0.9rem;">${product.name}</h6>
                <p class="text-muted mb-1" style="font-size: 0.85rem;">
                    ${product.sizes.length > 1
            ? `${minPrice}-${maxPrice} ₪`
            : `${product.price} ₪`}
                </p>
                ${product.sizes.length > 1
            ? '<small class="text-primary d-block mb-1" style="font-size: 0.7rem;"> <i class="fas fa-layer-group"></i> اختر الحجم</small>'
            : ''}
            </div>
            <div class='p-2'>
                <button class="btn btn-sm btn-primary w-100 py-1" style="font-size: 0.8rem;">
                    <i class="fas fa-plus"></i> إضافة
                </button>
            </div>
            
            
            
        </div>
    `;

    grid.appendChild(card);

}
function fillterCategoriesByProduct(categoryId) {
    let result = null;
    for (const main of categoriesData) {
        const foundSub = main.categories.find(cat => cat.id === categoryId);

        if (foundSub) {
            result = {
                mainCategoryName: main.name,
                subCategoryName: foundSub.name
            };
            break;
        }
    }
    activateCategoryButtons(result);
}

function activateCategoryButtons(mainAndSubCategoryForProduct) {
    const mainBtn = getMainCategoryBtn(mainAndSubCategoryForProduct.mainCategoryName);

    mainBtn?.click();

    requestAnimationFrame(() => {
        const subBtn = getSubCategoryBtn(mainAndSubCategoryForProduct.subCategoryName);
        subBtn?.click();
    });
}

function getMainCategoryBtn(mainCategoryName) {
    return [...document.querySelectorAll(".main-category-btn")]
        .find(btn => btn.innerText.trim() === mainCategoryName);
}
function getSubCategoryBtn(subCategoryName) {
    return [...document.querySelectorAll(".category-btn")]
        .find(btn => btn.innerText.trim() === subCategoryName);
}



async function openCashDrawer(orderType) {
    if (orderType === 'سفري') {
        const success = await window.electronAPI.openCashDrawer();
        if (!success) {
            bootboxError('تعذّر فتح صندوق الكاش. يرجى التأكد من تشغيل طابعة الكاشير وتوصيل صندوق الكاش بها، ثم المحاولة مرة أخرى.');
        }
    }
}



function initHorizontalScroll({ container, leftArrow, rightArrow, step }) {
    function updateArrows() {


        if (window.innerWidth < 992) {
            leftArrow.classList.add("hidden");
            rightArrow.classList.add("hidden");
            return;
        }


        const maxScroll = container.scrollWidth - container.clientWidth;

        if (maxScroll <= 0) {
            leftArrow.classList.add("hidden");
            rightArrow.classList.add("hidden");
            return;
        }


        const current = Math.abs(container.scrollLeft);

        rightArrow.classList.toggle("hidden", current <= 5);
        leftArrow.classList.toggle("hidden", current >= maxScroll - 5);
    }

    leftArrow.onclick = () => {
        container.scrollBy({ left: -step, behavior: "smooth" });
    };

    rightArrow.onclick = () => {
        container.scrollBy({ left: step, behavior: "smooth" });
    };



    container.addEventListener("scroll", updateArrows);
    window.addEventListener("load", updateArrows);
    window.addEventListener("resize", updateArrows);

    requestAnimationFrame(updateArrows);
}




const orderCurrency = document.getElementById("orderCurrency");
const foreignCurrencyDiv = document.getElementById("foreignCurrencyDiv");
const foreignCurrencyAmount = document.getElementById("foreignCurrencyAmount");
const foreignCurrencySymbol = document.getElementById("foreignCurrencySymbol");
const selectedCurrencyRate = document.getElementById("selectedCurrencyRate");
const convertedCurrencyAmount = document.getElementById("convertedCurrencyAmount");

const receivedAmountSummary = document.getElementById('receivedAmountSummary');
function updateCurrencyFields() {
    const currency = orderCurrency.value;

    if (currency === "ILS") {
        foreignCurrencyDiv.style.display = "none";

        foreignCurrencyAmount.value = "";
        convertedCurrencyAmount.textContent = "0 ₪";
        foreignCurrencySymbol.textContent = "₪";
        receivedAmountSummary.textContent = '0 ₪';
        setChangeAmountSummary();

        return;
    }

    foreignCurrencyDiv.style.display = "block";

    let rate = 0;
    let symbol = "";

    switch (currency) {
        case "USD":
            rate = Number(usdRate);
            symbol = "$";
            break;

        case "JOD":
            rate = Number(jodRate);
            symbol = "د.أ";
            break;

        case "EUR":
            rate = Number(eurRate);
            symbol = "€";
            break;

    }

    foreignCurrencySymbol.textContent = symbol;
    selectedCurrencyRate.textContent = `${rate} ₪`;

    calculateConvertedAmount();
}

function calculateConvertedAmount() {
    const currency = orderCurrency.value;
    const amount = Number(foreignCurrencyAmount.value) || 0;

    let rate = 0;

    switch (currency) {
        case "USD":
            rate = Number(usdRate);
            break;

        case "JOD":
            rate = Number(jodRate);
            break;

        case "EUR":
            rate = Number(eurRate);
            break;
        case "ILS":
            rate = 1;
            break;
    }

    const convertedAmount = amount * rate;

    convertedCurrencyAmount.textContent =
        `${convertedAmount.toFixed(2)} ₪`;

    receivedAmountSummary.textContent = `${convertedAmount.toFixed(2)} ₪`;
    setChangeAmountSummary();
}

orderCurrency.addEventListener("change", updateCurrencyFields);

foreignCurrencyAmount.addEventListener("input", calculateConvertedAmount);


document.getElementById('discountType').addEventListener('change', function () {
    const totalSection = document.getElementById('totalDiscountSection');
    const partialSection = document.getElementById('partialDiscountSection');
    if (this.value === 'partial') {
        totalSection.classList.add('d-none');
        partialSection.classList.remove('d-none');

        renderPartialDiscountItems();

    } else {
        totalSection.classList.remove('d-none');
        partialSection.classList.add('d-none');
        currentOrder.forEach(item => {
            item.discount_item = 0;
        });
    }

    discountInput.value = '';
    discountInput.dispatchEvent(new Event('input', {
        bubbles: true
    }));
});


function renderPartialDiscountItems() {

    const tbody = document.getElementById('partialDiscountItems');

    tbody.innerHTML = '';
    let totalPriceAfterDiscount = 0
    currentOrder.forEach(item => {

        const total = Number(item.price) * Number(item.qty);
        const discount = Number(item.discount_item) || 0;

        const finalTotal = total - (total * discount / 100);
        totalPriceAfterDiscount += finalTotal;

        const row = document.createElement('tr');

        row.innerHTML = `
            <td>
                ${item.name}
                ${item.sizeName ? `<span class="item-size"> - ${item.sizeName}</span>` : ''}
            </td>

            <td>
                ${item.qty}
            </td>

            <td>
                ${Number(item.price).toFixed(2)} ₪
            </td>

            <td>
                ${total.toFixed(2)} ₪
            </td>

            <td style="max-width: 140px;">
                <div class="input-group">
                    <input
                        type="number"
                        class="form-control partial-discount"
                        data-item-id="${item.id}"
                        data-size-name="${item.sizeName || ''}"
                        
                        value="${discount}"
                        min="0"
                        max="100"
                        step="0.01"
                    >

                    <span class="input-group-text">
                        %
                    </span>
                </div>
            </td>

            <td class="text-success fw-bold partial-final-price">
                ${finalTotal.toFixed(2)} ₪
            </td>

            
        `;



        tbody.appendChild(row);
    });


    const totalRow = document.createElement('tr');

    totalRow.classList.add('table-light', 'fw-bold');

    totalRow.innerHTML = `
        <td colspan="5" class="text-end">
            المجموع الكلي بعد الخصم
        </td>

        <td class="text-success" id="partialTotalAfterDiscount">
            ${Number(totalPriceAfterDiscount.toFixed(2))} ₪
        </td>
    `;

    tbody.appendChild(totalRow);
}

document.addEventListener('input', function (e) {

    if (!e.target.classList.contains('partial-discount')) {
        return;
    }

    const input = e.target;

    const itemId = Number(input.dataset.itemId);
    const sizeName = input.dataset.sizeName || '';
    let discount = Number(input.value) || 0;

    // للتأكد أن الخصم لا يتجاوز 100%
    if (discount > 100) {
        discount = 100;
        input.value = 100;
    }

    if (discount < 0) {
        discount = 0;
        input.value = 0;
    }

    // إيجاد الصنف
    const item = currentOrder.find(item =>
        Number(item.id) === itemId &&
        (item.sizeName || '') === sizeName
    );

    if (!item) {
        return;
    }



    // حساب المجموع
    const total = Number(item.price) * Number(item.qty);

    const valueOfDiscount = (total * discount / 100);


    item.discount_item = valueOfDiscount;
    // حساب السعر بعد الخصم
    const finalTotal = total - valueOfDiscount;

    // تحديث السعر بعد الخصم في نفس الصف
    const row = input.closest('tr');

    const finalPriceElement = row.querySelector('.partial-final-price');

    finalPriceElement.textContent = `${finalTotal.toFixed(2)} ₪`;


    // ==========================
    // حساب المجموع الكلي بعد الخصم
    // ==========================

    const totalPriceAfterDiscount = currentOrder.reduce((sum, item) => {

        const price = Number(item.price) || 0;
        const qty = Number(item.qty) || 0;
        const discountItem = roundDiscount(Number(item.discount_item)) || 0;

        const total = price * qty;

        // discount_item هنا قيمة الخصم بالشيكل
        const finalTotal = total - discountItem;

        return sum + finalTotal;

    }, 0);


    // تحديث المجموع الكلي
    const totalElement =
        document.getElementById('partialTotalAfterDiscount');

    if (totalElement) {
        totalElement.textContent =
            `${totalPriceAfterDiscount.toFixed(2)} ₪`;

        paymentTotalSummary.textContent = `${totalPriceAfterDiscount} ₪`;
        setChangeAmountSummary();
    }
});


function resSetDiscountInput() {
    const discountType = document.getElementById('discountType');
    discountType.value = 'total';
    discountType.dispatchEvent(new Event('change'));
}


function getNumberFromElement(element) {
    return Number(element.textContent.replace(/[^\d.-]/g, '')) || 0;
}

function setChangeAmountSummary() {
    const received = getNumberFromElement(receivedAmountSummary);
    const total = getNumberFromElement(paymentTotalSummary);

    const change = received - total;

    changeAmountSummary.textContent = `${Math.floor(change)} ₪`;
}



function roundDiscount(discount) {
    if (discount === 0) return 0;

    const firstDecimal = Math.floor(discount * 10) % 10;

    return Math.floor(discount) + (firstDecimal >= 4 ? 1 : 0);
}