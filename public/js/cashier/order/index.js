import { setActiveNavLink, showAuthExpired, showError, hiddeError, bootboxSuccess, bootboxError, showPrintLoader, hidePrintLoader } from "../../../component/bootbox.js";
import { url, urlServer, urlServerCS } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import { printInvoiceFromCashier } from "../../../component/invoices.js";
import { bootboxLoginAsAdmin, closeSideBar, SwitchToAdmin } from "../Switch-user-functionality.js";


const header = document.querySelector("site-header");
const mainCategoriesContainer = document.getElementById('mainCategoriesContainer');
const categoryContainer = document.getElementById('categoryContainer');
const categoryDivider = document.getElementById('categoryDivider');
const orderType = document.getElementById('orderType');
const paymentMethod = document.getElementById('paymentMethod');
const tableNumber = document.getElementById('tableNumber');
const customerPhone = document.getElementById('customerPhone');
const customerAddress = document.getElementById('customerAddress');
const orderNotes = document.getElementById('orderNotes');
const spinnerLoad = document.getElementById('spinnerLoad');
const errorBox = document.getElementById('error-box');
const cashBalance = document.getElementById('cash-balance');
const cardBalance = document.getElementById('card-balance');

const confirmSendBtn = document.getElementById('confirmSendBtn');
const confirmOrderModal = document.getElementById('confirmOrderModal');
const successModelOrder = document.getElementById('successModal');




const discountInput = document.getElementById("discountAmount");
const finalTotalPrice = document.getElementById("finalTotalPrice");

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
let cashSummery = {
    card_sales: 0,
    cash_in: 0,
    cash_out: 0,
    cash_sales: 0,
    expected_cash: 0,
    opening_cash: 0,
};
let currentOrder = [];

let products = [];
let categoriesData = [];

let hasOneMainCategory = false;
let selectedProductForSize = null;

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


    const loginAsAdmin = document.getElementById('openAdminLoginModal');
    loginAsAdmin.addEventListener('click', function (e) {
        closeSideBar();
        bootboxLoginAsAdmin();
    });

});


document.addEventListener("DOMContentLoaded", async function () {
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
    orderType.value = 'طاولة';
    toggleDeliveryFields();
    discountInput.value = '';
    finalTotalPrice.textContent = '0 ₪';
    confirmSendBtn.disabled = false;
    tableNumber.value = '';
    customerPhone.value = '';
    customerAddress.value = '';
    orderNotes.value = '';
});


discountInput.addEventListener("input", updateFinalTotal);


function updateFinalTotal() {
    // استخراج الرقم من النص
    const totalText = document.getElementById('modal-total-price').textContent;

    // مثال: "120 ₪" => 120
    const total = parseFloat(totalText.replace(/[^\d.]/g, "")) || 0;

    // قيمة الخصم
    const discount = parseFloat(discountInput.value) || 0;


    checkDiscount(discount, total);

    // منع الخصم الأكبر من المجموع
    const finalPrice = Math.max(total - discount, 0);

    // تحديث المجموع النهائي
    finalTotalPrice.textContent = `${finalPrice} ₪`;
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
        showPrintLoader();
        try{
           await printInvoiceFromCashier(finalOrderDetails);
        }catch(e){
            bootboxError(e.message);
        }finally{
            hidePrintLoader();
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
});

document.querySelectorAll('input[name="payment_status"]').forEach(input => {
    input.addEventListener("change", handlePaymentStatus);
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
                sizeIndex: sizeIndex,
                qty: 1
            });
        }
    }

    updateOrderUI();

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


function updateOrderUI() {
    const list = document.getElementById('order-items-list');
    const totalEl = document.getElementById('total-price');

    if (currentOrder.length === 0) {
        list.innerHTML = '<p class="text-center text-muted mt-5">سلة الطلب فارغة</p>';
        totalEl.innerText = '0 ₪';
        return;
    }

    let html = '';
    let total = 0;

    currentOrder.forEach(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;

        html += `
            <div class="order-item">
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
    let html = '';
    let total = 0;

    currentOrder.forEach(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;

        html += `
            <div class="order-summary-item">
                <div>
                    <div class="item-name">
                        ${item.name}
                        ${item.sizeName ? `<span class="item-size"> - ${item.sizeName}</span>` : ''}
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="item-qty">${item.qty}</span>
                    <span class="item-total" dir="ltr"> = ${item.price} x</span>
                    <span class="item-total">${itemTotal} ₪</span>
                </div>
            </div>
        `;
    });

    list.innerHTML = html;
    document.getElementById('modal-total-price').innerText = total + ' ₪';
    finalTotalPrice.textContent = total + ' ₪';
}
function toggleDeliveryFields() {

    const tableNumberDiv = document.getElementById('tableNumberDiv');
    const customerPhoneDiv = document.getElementById('customerPhoneDiv');
    const customerAddressDiv = document.getElementById('customerAddressDiv');
    const paymentStatusDiv  = document.getElementById('paymentStatusDiv');
    const paymentMethodDiv  = document.getElementById('paymentMethodDiv');

    

    if (orderType.value === 'سفري') {
        customerPhoneDiv.style.display = 'block';
        customerAddressDiv.style.display = 'block';
        paymentMethodDiv.style.display   = 'block';
        tableNumberDiv.style.display = 'none';
        paymentStatusDiv.style.display = 'none';
        tableNumber.value = '';

    }
    else{
        tableNumberDiv.style.display = 'block';
        customerPhoneDiv.style.display = 'none';
        customerAddressDiv.style.display = 'none';
        paymentStatusDiv.style.display = 'block';
        setPayLater();
    }
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
    finalOrderDetails.note = orderNotes.value;
    finalOrderDetails.tableNum = Number(tableNumber.value);
    finalOrderDetails.phoneNum = customerPhone.value;
    finalOrderDetails.address = customerAddress.value;
    finalOrderDetails.discount = Number(discountInput.value);

    finalOrderDetails.paymentStatus = getPaymentStatus();
    // console.log(finalOrderDetails);

    const res = await createOrder();
    if (res.success) {
        finalOrderDetails.inv_num = res.inv_num;
        bootstrap.Modal.getInstance(document.getElementById('confirmOrderModal')).hide();
        currentOrder = [];
        updateOrderUI();
        clearModalData();
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



function clearModalData() {
    orderType.value = 'طاولة';
    paymentMethod.value = 'كاش';
    tableNumber.value = '';
    customerPhone.value = '';
    customerAddress.value = '';
    orderNotes.value = '';
    toggleDeliveryFields();
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
        // urlServer + `/creat/order?session_id=${sessionId}`;
        // /api/order/creat?session_id=${sessionId}

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
            updateCashSammary();
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
                cashSummery = data.cash_summery;
                sessionId = data.session_id;
                cashBalance.textContent = `${data.cash_summery?.expected_cash || 0} ₪`;
                cardBalance.textContent = `${data.cash_summery?.card_sales || 0} ₪`;
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


function updateCashSammary() {
    let totalPrice = finalOrderDetails.totalPrice;
    let discount = finalOrderDetails.discount;
    let finalPrice = totalPrice - discount;

    if (finalOrderDetails.paymentMethod === 'بطاقة') {
        cashSummery.card_sales += finalPrice;
        updatePaymentMethodeBalance(cardBalance, finalPrice);
    } else if (finalOrderDetails.paymentMethod === 'كاش') {
        cashSummery.cash_sales += finalPrice;
        cashSummery.expected_cash += finalPrice;
        updatePaymentMethodeBalance(cashBalance, finalPrice);

    }
}
function updatePaymentMethodeBalance(paymentBalance, OrderPrice) {
    let currentValue = parseFloat(paymentBalance.textContent.replace('₪', '').trim()) || 0;
    let newValue = currentValue + OrderPrice;
    paymentBalance.textContent = newValue + " ₪";
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