import { setActiveNavLink, showAuthExpired, bootboxError, bootboxSuccess } from "../../../component/bootbox.js";
import { urlServer } from "../../../api/urlEndPoint.js";

import { getAuthToken, removeAuthToken } from "../../../component/auth.js";




const SEARCH_ITEM_URL = "/item/search-item-for-supplier";

const SUPPLIERS_URL = "/suppliers";

// إذا كان عندك token في localStorage عدّل المفتاح حسب مشروعك
const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: getAuthToken('auth')
});



const header = document.querySelector("site-header");

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



/* =====================================
   ELEMENTS
===================================== */

const barcodeInput = document.getElementById("barcodeInput");
const itemNameInput = document.getElementById("itemNameInput");

const barcodeSearchBtn = document.getElementById("barcodeSearchBtn");
const nameSearchBtn = document.getElementById("nameSearchBtn");

const itemSearchDropdown = document.getElementById("itemSearchDropdown");

const cartBody = document.getElementById("cartBody");
const cartCount = document.getElementById("cartCount");

const clearCartBtn = document.getElementById("clearCartBtn");
const submitOperationBtn = document.getElementById("submitOperationBtn");

const supplierReturnFields = document.getElementById("supplierReturnFields");
const returnAmount = document.getElementById("returnAmount");
const supplierSelect = document.getElementById("supplierSelect");


/* =====================================
   DATA
===================================== */

let cart = [];

let searchTimeout = null;

let searchRequestId = 0;


/* =====================================
   HELPERS
===================================== */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}


// تحويل نتيجة SQL إلى أصناف مجمعة مع وحداتها
function groupItemsData(result) {

    const itemsMap = new Map();

    result.forEach(row => {

        if (!itemsMap.has(row.id)) {

            itemsMap.set(row.id, {
                id: row.id,
                name: row.name,
                units: []
            });

        }

        itemsMap.get(row.id).units.push({
            id: row.unit_id,
            unit_name: row.unit_name,
            barcode: row.barcode,
            conversion_factor: row.conversion_factor
        });

    });

    return Array.from(itemsMap.values());
}


// تنفيذ طلب API
async function apiRequest(url, isFroBarcode = false) {
    const loader = document.getElementById('overlay_loader');

    if (isFroBarcode) {
        loader.classList.remove('d-none');
    }

    let response;
    let data;
    try {
        response = await fetch(urlServer + url, {
            method: "GET",
            headers: getHeaders()
        });

        data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "حدث خطأ أثناء الاتصال بالسيرفر");
        }

        if (response.status === 401) {
            showAuthExpired(data.message);
        }

        return data;

    } catch (e) {
        return [];
    } finally {
        loader.classList.add('d-none');
    }

}


/* =====================================
   SEARCH BY BARCODE
===================================== */

async function searchByBarcode() {

    const barcode = barcodeInput.value.trim();

    if (!barcode) {
        return;
    }

    try {

        barcodeSearchBtn.disabled = true;

        const url = `${SEARCH_ITEM_URL}?barcode=${encodeURIComponent(barcode)}`;

        const result = await apiRequest(url, true);

        const items = groupItemsData(result);

        if (items.length === 0) {
            throw new Error("لم يتم العثور على الصنف");
        }

        addItemToCart(items[0]);

        barcodeInput.value = "";

        barcodeInput.focus();

    } catch (error) {

        bootboxError(error.message);

        barcodeInput.focus();

    } finally {

        barcodeSearchBtn.disabled = false;

    }
}


/* =====================================
   SEARCH BY NAME
===================================== */

async function searchByName() {

    const name = itemNameInput.value.trim();

    if (name.length < 2) {

        itemSearchDropdown.classList.add("hidden");

        return;
    }

    const currentRequestId = ++searchRequestId;

    try {

        const url = `${SEARCH_ITEM_URL}?name=${encodeURIComponent(name)}`;

        const result = await apiRequest(url);

        // منع ظهور نتائج بحث قديم
        if (currentRequestId !== searchRequestId) {
            return;
        }

        const items = groupItemsData(result);

        renderSearchDropdown(items);

    } catch (error) {

        if (currentRequestId !== searchRequestId) {
            return;
        }

        if (error.message.includes("لم يتم العثور")) {

            itemSearchDropdown.innerHTML = `
                <div class="search-result text-center text-muted">
                    لا توجد أصناف مطابقة
                </div>
            `;

            itemSearchDropdown.classList.remove("hidden");

        } else {

            itemSearchDropdown.classList.add("hidden");

            console.error(error);

        }

    }
}


/* =====================================
   RENDER SEARCH DROPDOWN
===================================== */

function renderSearchDropdown(items) {

    if (!items.length) {

        itemSearchDropdown.innerHTML = `
            <div class="search-result text-center text-muted">
                لا توجد أصناف مطابقة
            </div>
        `;

        itemSearchDropdown.classList.remove("hidden");

        return;
    }

    itemSearchDropdown.innerHTML = items.map(item => {

        const unitsText = item.units
            .map(unit => unit.unit_name)
            .join(" - ");

        return `
            <div
                class="search-result"
                data-item-id="${escapeHTML(item.id)}"
            >

                <strong>${escapeHTML(item.name)}</strong>

                <small>
                    الوحدات: ${escapeHTML(unitsText)}
                </small>

            </div>
        `;

    }).join("");

    itemSearchDropdown.classList.remove("hidden");


    // حفظ الأصناف للرجوع إليها عند الاختيار
    itemSearchDropdown.searchItems = items;

}


/* =====================================
   ADD ITEM TO CART
===================================== */

function addItemToCart(item) {

    if (!item.units || item.units.length === 0) {
        bootboxError("هذا الصنف لا يحتوي على وحدات");
        return;
    }

    // إذا كان الصنف موجوداً بالسلة نزيد كميته
    const existingItem = cart.find(
        cartItem => String(cartItem.id) === String(item.id)
    );

    if (existingItem) {
        existingItem.quantity = Number(existingItem.quantity) + 1;
    } else {
        cart.push({
            id: item.id,
            name: item.name,
            units: item.units,
            unit_id: item.units[0].id,
            quantity: 1
        });
    }

    renderCart();
}


/* =====================================
   RENDER CART
===================================== */

function renderCart() {

    cartCount.textContent = `${cart.length} صنف`;

    if (cart.length === 0) {

        cartBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-cart">
                    <i class="fas fa-shopping-basket"></i>
                    <p>السلة فارغة</p>
                </td>
            </tr>
        `;

        return;
    }

    cartBody.innerHTML = cart.map((item, index) => {

        const unitsOptions = item.units.map(unit => `

            <option
                value="${escapeHTML(unit.id)}"
                ${String(unit.id) === String(item.unit_id) ? "selected" : ""}
            >
                ${escapeHTML(unit.unit_name)}
            </option>

        `).join("");

        return `

            <tr data-item-id="${escapeHTML(item.id)}">

                <td>${index + 1}</td>

                <td>
                    <span class="cart-item-name">
                        ${escapeHTML(item.name)}
                    </span>
                </td>

                <td>

                    <select class="form-select unit-select cart-unit">

                        ${unitsOptions}

                    </select>

                </td>

                <td>

                    <input
                        type="number"
                        class="form-control quantity-input cart-quantity"
                        value="${escapeHTML(item.quantity)}"
                        min="0.01"
                        step="any"
                    >

                </td>

                <td>

                    <button
                        type="button"
                        class="delete-item-btn remove-cart-item"
                        title="حذف الصنف"
                    >
                        <i class="fas fa-trash"></i>
                    </button>

                </td>

            </tr>

        `;

    }).join("");

}


/* =====================================
   CHANGE OPERATION TYPE
===================================== */

function updateOperationType() {

    const operationType = document.querySelector(
        'input[name="operationType"]:checked'
    ).value;

    const isSupplierReturn = operationType === "supplier_return";

    supplierReturnFields.classList.toggle(
        "hidden",
        !isSupplierReturn
    );

    document.getElementById("damagedOption").classList.toggle(
        "active",
        !isSupplierReturn
    );

    document.getElementById("supplierOption").classList.toggle(
        "active",
        isSupplierReturn
    );

}


/* =====================================
   LOAD SUPPLIERS
===================================== */

async function loadSuppliers() {

    try {

        const result = await apiRequest(SUPPLIERS_URL);

        // يدعم رجوع Array مباشرة أو داخل suppliers
        const suppliers = Array.isArray(result)
            ? result
            : result.suppliers || [];

        supplierSelect.innerHTML = `
            <option value="">اختر المورد</option>
        `;

        suppliers.forEach(supplier => {

            supplierSelect.innerHTML += `

                <option value="${escapeHTML(supplier.id)}">
                    ${escapeHTML(supplier.name)}
                </option>

            `;

        });

    } catch (error) {

        console.error("خطأ تحميل الموردين:", error);

    }

}


/* =====================================
   SUBMIT OPERATION
===================================== */

async function submitOperation() {

    if (cart.length === 0) {

        bootboxError("السلة فارغة، الرجاء إضافة أصناف أولاً");

        return;
    }

    // التحقق من الكميات
    for (const item of cart) {

        if (
            !Number.isFinite(Number(item.quantity)) ||
            Number(item.quantity) <= 0
        ) {

            bootboxError(`الرجاء إدخال كمية صحيحة للصنف: ${item.name}`);

            return;
        }

    }

    const operationType = document.querySelector(
        'input[name="operationType"]:checked'
    ).value;


    // بيانات العملية
    const operationData = {

        operation_type: operationType,

        // items: cart.map(item => ({

        //     item_id: item.id,

        //     item_name: item.name,

        //     unit_id: item.unit_id,

        //     unit_name: item.units.find(
        //         unit => String(unit.id) === String(item.unit_id)
        //     )?.unit_name,

        //     conversion_factor: item.units.find(
        //         unit => String(unit.id) === String(item.unit_id)
        //     )?.conversion_factor,

        //     quantity: Number(item.quantity)

        // }))

    };

    // إذا كانت العملية ترجيع لمورد
    if (operationType === "supplier_return") {

        const amount = returnAmount.value;

        if (amount === "" || !Number.isFinite(Number(amount)) || Number(amount) < 0) {

            bootboxError("الرجاء إدخال مبلغ ترجيع صحيح");

            return;
        }

        if (!supplierSelect.value) {

            bootboxError("الرجاء اختيار المورد");

            return;
        }

      

        operationData.return_amount = Number(amount);
        operationData.supplier = supplierSelect.value;

    }

    const resultData = {
        operationData,
        
        cart: cart.map(item => {

            const selectedUnit = item.units.find(
                unit => String(unit.id) === String(item.unit_id)
            );

            return {
                id: item.id,
                name: item.name,
                quantity: Number(item.quantity),
                unit_id: item.unit_id,
                conversion_factor: selectedUnit?.conversion_factor,
                unit_name: selectedUnit?.unit_name
            };

        }),

    };

    await demmageInvoice(resultData);

}



async function demmageInvoice(invData){
    const loader = document.getElementById('overlay_loader');

    loader.classList.remove('d-none');
    
    try {
        let res = await fetch(urlServer + '/invoice/Demmage', {
            method: "POST",
            body: JSON.stringify(invData),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });
        let data = await res.json();

        if (res.status === 200) {
            returnAmount.value = '';
            supplierSelect.value = '';
            cart = [];
            renderCart();
            bootboxSuccess(data.message);
        }
        else if (res.status === 401) {
            showAuthExpired(data.message);
        }
        else {
            bootboxError(data.message);
        }

        
    } catch (err) {
        bootboxError(err.message);
    } finally {
        loader.classList.add('d-none');
    }
}


/* =====================================
   EVENT LISTENERS
===================================== */

// البحث بالباركود
barcodeSearchBtn.addEventListener("click", searchByBarcode);


// Enter بالباركود
barcodeInput.addEventListener("keydown", function (e) {

    if (e.key === "Enter") {

        e.preventDefault();

        searchByBarcode();

    }

});


// الكتابة بالاسم وفتح Dropdown
itemNameInput.addEventListener("input", function () {

    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {

        searchByName();

    }, 300);

});


// زر البحث بالاسم
nameSearchBtn.addEventListener("click", searchByName);


// اختيار صنف من Dropdown
document.addEventListener("click", function (e) {

    // اختيار صنف
    const searchResult = e.target.closest(".search-result[data-item-id]");

    if (searchResult) {

        const itemId = searchResult.dataset.itemId;

        const items = itemSearchDropdown.searchItems || [];

        const selectedItem = items.find(
            item => String(item.id) === String(itemId)
        );

        if (selectedItem) {

            addItemToCart(selectedItem);

            itemNameInput.value = "";

            itemSearchDropdown.classList.add("hidden");

        }

    }

    // إغلاق Dropdown عند الضغط خارج البحث
    if (
        !e.target.closest("#itemNameInput") &&
        !e.target.closest("#itemSearchDropdown") &&
        !e.target.closest("#nameSearchBtn")
    ) {

        itemSearchDropdown.classList.add("hidden");

    }

});


// تغيير نوع العملية
document.addEventListener("change", function (e) {

    if (e.target.name === "operationType") {

        updateOperationType();

    }

    // تغيير وحدة الصنف
    else if (e.target.classList.contains("cart-unit")) {

        const row = e.target.closest("tr");

        const itemId = row.dataset.itemId;

        const item = cart.find(
            cartItem => String(cartItem.id) === String(itemId)
        );

        if (item) {

            item.unit_id = e.target.value;

        }

    }

    // تغيير الكمية
    else if (e.target.classList.contains("cart-quantity")) {

        const row = e.target.closest("tr");

        const itemId = row.dataset.itemId;

        const item = cart.find(
            cartItem => String(cartItem.id) === String(itemId)
        );

        if (item) {

            item.quantity = Number(e.target.value);

        }

    }

});


// حذف صنف من السلة
document.addEventListener("click", function (e) {

    const deleteBtn = e.target.closest(".remove-cart-item");

    if (deleteBtn) {

        const row = deleteBtn.closest("tr");

        const itemId = row.dataset.itemId;

        cart = cart.filter(
            item => String(item.id) !== String(itemId)
        );

        renderCart();

    }

});


// تفريغ السلة
clearCartBtn.addEventListener("click", function () {

    if (cart.length === 0) {
        return;
    }

    if (!confirm("هل أنت متأكد من تفريغ السلة؟")) {
        return;
    }

    cart = [];

    renderCart();

});


// تنفيذ العملية
submitOperationBtn.addEventListener("click",  submitOperation);


/* =====================================
   INITIALIZATION
===================================== */

updateOperationType();

renderCart();

loadSuppliers();

barcodeInput.focus();
