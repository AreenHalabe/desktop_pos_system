
import { loadItemsAndCategoriesTree } from "../../../api/items.js";


import { setActiveNavLink, showAuthExpired, bootboxError, bootboxSuccess } from "../../../component/bootbox.js";

import { urlServer } from "../../../api/urlEndPoint.js";

import { getAuthToken, removeAuthToken } from "../../../component/auth.js";

import { closeSideBar } from "../Switch-user-functionality.js";



let categoriesData = [];
let itemsData = [];

// كل صنف في السلة يحتوي فقط على الحقول السبعة المطلوبة.
let cart = [];

const barcodeMap = new Map();
const currency = "₪";

const elements = {
    mainCategory: document.getElementById("mainCategory"),
    subCategory: document.getElementById("subCategory"),
    productSearch: document.getElementById("productSearch"),
    productList: document.getElementById("productList"),
    productLoader: document.getElementById("productLoader"),
    barcodeInput: document.getElementById("barcodeInput"),
    invoiceBody: document.getElementById("invoiceBody"),
    totalValue: document.getElementById("totalValue"),
    clearCartBtn: document.getElementById("clearCartBtn"),
    submitReturnBtn: document.getElementById("submitReturnBtn")
};


const header = document.querySelector("site-header");
const overlayLoader = document.getElementById('overlay_loader');

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




const formatMoney = value => Number(value || 0).toFixed(2);




// تحميل الأصناف والتصنيفات
document.addEventListener("DOMContentLoaded", async () => {
    try {
        ({ categoriesData, itemsData } =
            await loadItemsAndCategoriesTree());

        categoriesData = Array.isArray(categoriesData)
            ? categoriesData
            : [];

        itemsData = Array.isArray(itemsData)
            ? itemsData
            : [];

        buildBarcodeMap();

        renderMainCategories();
        renderSubCategories();
        renderProducts();
        renderCart();

    } catch (error) {
        console.error("فشل تحميل الأصناف والتصنيفات:", error);

        elements.productList.innerHTML =
            '<div class="text-danger text-center py-4">تعذر تحميل الأصناف</div>';

    } finally {
        elements.productLoader?.remove();
    }

    elements.barcodeInput?.focus();
});


// بناء خريطة الباركود
function buildBarcodeMap() {
    barcodeMap.clear();

    for (const item of itemsData) {
        for (const unit of item.units ?? []) {

            const barcode = String(unit.barcode ?? "").trim();

            if (!barcode || barcodeMap.has(barcode)) {
                continue;
            }

            barcodeMap.set(barcode, {
                item,
                selectedUnit: unit
            });
        }
    }
}


// التصنيفات الرئيسية
function renderMainCategories() {
    elements.mainCategory.replaceChildren(
        new Option("كل التصنيفات", "")
    );

    for (const category of categoriesData) {
        elements.mainCategory.add(
            new Option(category.name, String(category.id))
        );
    }
}


// التصنيفات الفرعية
function renderSubCategories() {
    const selectedMainId = elements.mainCategory.value;
    const previousSubId = elements.subCategory.value;

    const availableSubCategories = categoriesData
        .filter(category =>
            !selectedMainId ||
            String(category.id) === selectedMainId
        )
        .flatMap(category => category.categories ?? []);

    elements.subCategory.replaceChildren(
        new Option("كل التصنيفات", "")
    );

    for (const category of availableSubCategories) {
        elements.subCategory.add(
            new Option(category.name, String(category.id))
        );
    }

    if (
        availableSubCategories.some(category =>
            String(category.id) === previousSubId
        )
    ) {
        elements.subCategory.value = previousSubId;
    }
}


// البحث والفلترة وعرض الأصناف
function renderProducts() {
    const mainId = elements.mainCategory.value;
    const subId = elements.subCategory.value;

    const searchText = elements.productSearch.value
        .trim()
        .toLocaleLowerCase();

    const visibleItems = itemsData.filter(item => {

        const belongsToMain = !mainId ||
            categoriesData.some(category =>
                String(category.id) === mainId &&
                (category.categories ?? []).some(subCategory =>
                    String(subCategory.id) ===
                    String(item.category_id)
                )
            );

        const belongsToSub = !subId ||
            String(item.category_id) === subId;

        const matchesSearch =
            !searchText ||
            String(item.name ?? "")
                .toLocaleLowerCase()
                .includes(searchText) ||
            String(item.id ?? "").includes(searchText) ||
            (item.units ?? []).some(unit =>
                String(unit.barcode ?? "").includes(searchText)
            );

        return belongsToMain && belongsToSub && matchesSearch;
    });

    elements.productList.replaceChildren();

    if (!visibleItems.length) {
        const empty = document.createElement("div");

        empty.className = "text-center text-muted py-4";
        empty.textContent = "لا توجد أصناف مطابقة للبحث";

        elements.productList.append(empty);
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const item of visibleItems) {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "product-item";
        button.dataset.itemId = String(item.id);

        const name = document.createElement("div");

        name.className = "product-name";
        name.textContent = item.name;

        const price = document.createElement("div");

        price.className = "product-price";

        const firstUnit = item.units?.[0];

        price.textContent = firstUnit
            ? `${formatMoney(firstUnit.price)} ${currency} / ${firstUnit.name}`
            : "لا توجد وحدات";

        button.append(name, price);

        if (!firstUnit) {
            button.disabled = true;
        }

        fragment.append(button);
    }

    elements.productList.append(fragment);
}


// إضافة صنف للسلة
function addItemToCart(item, selectedUnit = null) {

    if (
        !item ||
        !Array.isArray(item.units) ||
        item.units.length === 0
    ) {
        return;
    }

    const unit = selectedUnit ?? item.units[0];

    const validUnit = item.units.find(current =>
        String(current.id) === String(unit.id)
    );

    if (!validUnit) return;


    const unitPrice = Number(validUnit.price);

    const initialQuantity = needsAmountButton(unitPrice) ? 0 : 1;

    const existingRow = cart.find(row =>
        String(row.item_id) === String(item.id) &&
        String(row.unit_id) === String(validUnit.id)
    );

    if (existingRow) {

         if (initialQuantity === 1) {

            existingRow.quantity += 1;

        }

    } else {

        cart.push({
            conversion_factor: Number(validUnit.conversion_factor),
            item_id: item.id,
            item_name: item.name,
            quantity: initialQuantity,
            unit_id: validUnit.id,
            unit_name: validUnit.name,
            unit_price: Number(validUnit.price)
        });

    }

    renderCart(true);
}


// الوحدات المتاحة للصنف
function getAvailableUnits(row, units, rowIndex) {

    return units.filter(unit =>

        String(unit.id) === String(row.unit_id) ||

        !cart.some((cartRow, index) =>
            index !== rowIndex &&
            String(cartRow.item_id) === String(row.item_id) &&
            String(cartRow.unit_id) === String(unit.id)
        )

    );
}


// عرض السلة
function renderCart(scrollToBottom = false) {

    elements.invoiceBody.replaceChildren();

    if (!cart.length) {

        const emptyRow = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 7;
        cell.className = "text-muted py-4";
        cell.textContent = "لم تتم إضافة أصناف بعد";

        emptyRow.append(cell);
        elements.invoiceBody.append(emptyRow);

        updateTotal();
        return;
    }

    const fragment = document.createDocumentFragment();

    cart.forEach((row, index) => {

        const tr = document.createElement("tr");

        tr.dataset.index = String(index);

        // رقم السطر
        appendCell(tr, index + 1);

        // اسم الصنف
        appendCell(tr, row.item_name);

        // الوحدة
        const unitCell = document.createElement("td");

        const item = itemsData.find(current =>
            String(current.id) === String(row.item_id)
        );

        const units = item?.units ?? [];

        if (units.length > 1) {

            const select = document.createElement("select");

            select.className =
                "form-select form-select-sm unit-select";

            select.dataset.index = String(index);

            for (const unit of getAvailableUnits(
                row,
                units,
                index
            )) {

                const option = new Option(
                    unit.name,
                    String(unit.id)
                );

                option.selected =
                    String(unit.id) === String(row.unit_id);

                select.add(option);
            }

            unitCell.append(select);

        } else {

            unitCell.textContent = row.unit_name;

        }

        tr.append(unitCell);

        // الكمية
        const quantityCell = document.createElement("td");

        const quantityControl = document.createElement("div");

        quantityControl.className = "qty-control";

        // const decrease = document.createElement("button");

        // decrease.type = "button";
        // decrease.className = "qty-btn decrease-qty";
        // decrease.textContent = "−";
        // decrease.setAttribute("aria-label", "تقليل الكمية");

        // const quantity = document.createElement("span");

        // quantity.className = "qty-value";
        // quantity.textContent = String(row.quantity);

        // const increase = document.createElement("button");

        // increase.type = "button";
        // increase.className = "qty-btn increase-qty";
        // increase.textContent = "+";
        // increase.setAttribute("aria-label", "زيادة الكمية");

        // quantityControl.append(
        //     decrease,
        //     quantity,
        //     increase
        // );

         if (needsAmountButton(row.unit_price)) {



            const amountButton = document.createElement("button");



            amountButton.type = "button";

            amountButton.className = "amount-quantity-btn";


            amountButton.dataset.id = String(row.item_id);



            amountButton.innerHTML = `
                <i class="fa-solid fa-coins"></i>
                <span>تحديد المبلغ</span>
            `;



            amountButton.title = "تحديد الكمية حسب المبلغ";



            quantityControl.append(amountButton);



        } else {



            const decreaseButton = document.createElement("button");



            decreaseButton.type = "button";

            decreaseButton.className = "qty-btn decrease-qty";

            decreaseButton.setAttribute("aria-label", "تقليل الكمية");

            decreaseButton.textContent = "−";



            const quantityValue = document.createElement("span");



            quantityValue.className = "qty-value";

            quantityValue.textContent = String(row.quantity);



            const increaseButton = document.createElement("button");



            increaseButton.type = "button";

            increaseButton.className = "qty-btn increase-qty";

            increaseButton.setAttribute("aria-label", "زيادة الكمية");

            increaseButton.textContent = "+";



            quantityControl.append(

                decreaseButton,

                quantityValue,

                increaseButton

            );

        }






        quantityCell.append(quantityControl);
        tr.append(quantityCell);

        // سعر الوحدة
        appendCell(tr, formatMoney(row.unit_price));

        // الإجمالي
        appendCell(
            tr,
            formatMoney(row.quantity * row.unit_price)
        );

        // الحذف
        const actionCell = document.createElement("td");

        const remove = document.createElement("button");

        remove.type = "button";
        remove.className = "btn btn-sm btn-outline-danger remove-item";
        remove.title = "حذف الصنف";
        remove.innerHTML =
            '<i class="fa-regular fa-trash-can"></i>';

        actionCell.append(remove);
        tr.append(actionCell);

        fragment.append(tr);
    });

    elements.invoiceBody.append(fragment);

    updateTotal();

    if (scrollToBottom) {

        const wrap = document.querySelector(".invoice-table-wrap");

        wrap.scrollTop = wrap.scrollHeight;
    }
}


// إضافة خلية للجدول
function appendCell(row, value) {

    const cell = document.createElement("td");

    cell.textContent = String(value);

    row.append(cell);
}


// حساب الإجمالي
function updateTotal() {

    const total = cart.reduce((sum, row) =>
        sum +
        Number(row.quantity) * Number(row.unit_price),
        0
    );

    elements.totalValue.textContent =
        `${formatMoney(total)} ${currency}`;
}


// معالجة الباركود
function handleBarcodeEnter() {

    const barcode = elements.barcodeInput.value.trim();

    if (!barcode) return;

    const match = barcodeMap.get(barcode);

    if (!match) {

        showMessage(
            `لم يتم العثور على صنف بهذا الباركود: ${barcode}`,
            "تنبيه"
        );

    } else {

        addItemToCart(
            match.item,
            match.selectedUnit
        );

    }

    elements.barcodeInput.value = "";
    elements.barcodeInput.focus();
}


// تغيير وحدة الصنف داخل السلة
function changeCartUnit(index, unitId) {

    const row = cart[index];

    if (!row) return;

    const item = itemsData.find(current =>
        String(current.id) === String(row.item_id)
    );

    const selectedUnit = item?.units?.find(unit =>
        String(unit.id) === String(unitId)
    );

    if (!selectedUnit) return;

    const unitAlreadyInCart = cart.some(
        (cartRow, currentIndex) =>
            currentIndex !== index &&
            String(cartRow.item_id) === String(row.item_id) &&
            String(cartRow.unit_id) === String(selectedUnit.id)
    );

    if (unitAlreadyInCart) return;

    row.conversion_factor =
        Number(selectedUnit.conversion_factor);

    row.unit_id = selectedUnit.id;
    row.unit_name = selectedUnit.name;
    row.unit_price = Number(selectedUnit.price);

    row.quantity = 1;

    renderCart();
}


// زيادة أو تقليل الكمية
function changeQuantity(index, amount) {

    const row = cart[index];

    if (!row) return;

    row.quantity = Math.max(
        1,
        Number(row.quantity) + amount
    );

    renderCart();
}


// حذف صنف من السلة
function removeCartItem(index) {

    if (index < 0 || index >= cart.length) return;

    cart.splice(index, 1);

    renderCart();
}


// رسالة تنبيه
function showMessage(message, title = "") {

    if (window.bootbox?.alert) {

        window.bootbox.alert({
            title,
            message
        });

    } else {

        window.alert(
            `${title ? title + "\n" : ""}${message}`
        );

    }
}


// ==================================================
// أحداث الصفحة - بدون onclick
// ==================================================

// تغيير التصنيف الرئيسي
elements.mainCategory.addEventListener("change", () => {

    renderSubCategories();
    renderProducts();

});


// تغيير التصنيف الفرعي
elements.subCategory.addEventListener(
    "change",
    renderProducts
);


// البحث
elements.productSearch.addEventListener(
    "input",
    renderProducts
);


// الباركود
elements.barcodeInput.addEventListener("keydown", event => {

    if (event.key !== "Enter") return;

    event.preventDefault();

    handleBarcodeEnter();

});


// الضغط على صنف من قائمة المنتجات
elements.productList.addEventListener("click", event => {

    const button = event.target.closest(".product-item");

    if (!button) return;

    const item = itemsData.find(current =>
        String(current.id) === button.dataset.itemId
    );

    if (item) {
        addItemToCart(item);
    }

});


// تغيير الوحدة
elements.invoiceBody.addEventListener("change", event => {

    if (!event.target.matches(".unit-select")) return;

    changeCartUnit(
        Number(event.target.dataset.index),
        event.target.value
    );

});


// أحداث الكمية والحذف
elements.invoiceBody.addEventListener("click", event => {

    const row = event.target.closest("tr[data-index]");

    if (!row) return;

    const index = Number(row.dataset.index);

    if (event.target.closest(".increase-qty")) {

        changeQuantity(index, 1);

    } else if (event.target.closest(".decrease-qty")) {

        changeQuantity(index, -1);

    } else if (event.target.closest(".remove-item")) {

        removeCartItem(index);

    }

});


// تفريغ السلة
elements.clearCartBtn.addEventListener("click", () => {

    if (!cart.length) return;

    const clear = () => {

        cart = [];

        renderCart();

    };

    if (window.bootbox?.confirm) {

        window.bootbox.confirm(
            "هل تريد تفريغ الفاتورة المرتجعة؟",
            result => {
                if (result) clear();
            }
        );

    } else if (
        window.confirm("هل تريد تفريغ الفاتورة المرتجعة؟")
    ) {

        clear();

    }

});


// زر إرسال الفاتورة
elements.submitReturnBtn.addEventListener("click", async() =>{
        await sendReturnInvoiceToServer();
     
    }
);


// ==================================================
// آخر دالة: إرسال الفاتورة للسيرفر
// ==================================================

async function sendReturnInvoiceToServer() {

    if (cart.length === 0) {
        showMessage(
            "لا يمكن إرسال فاتورة مرتجعة فارغة",
            "تنبيه"
        );
        return;
    }

    const invalidItem = cart.find(row => Number(row.quantity) <= 0);
    if (invalidItem) {

        showMessage(

            `لا يمكن الإرجاع، الرجاء تحديد المبلغ أو الكمية للصنف: ${invalidItem.item_name}`

        );
        return;

    }
    await restoreInvoice();
    
}



async function restoreInvoice() {
    
    overlayLoader.style.display = 'flex';

    try {

        const res = await fetch(urlServer + '/invoice/restore', {

            method: 'PUT',

            headers: {

                "Content-Type": "application/json",

                "Authorization": `${getAuthToken('user-auth')}`

            },

            body: JSON.stringify(cart),

        });

        const data = await res.json();

        if (res.status === 401) {

            showAuthExpired(data.message);

            return false;

        }

        else if (res.status === 200) {

            bootboxSuccess(data.message);
            cart = [];
            renderCart();
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

        overlayLoader.style.display = 'none';

    }

}




const amountModalElement = document.getElementById("amountQuantityModal");

const amountModal = bootstrap.Modal.getOrCreateInstance(amountModalElement);



const amountInput = document.getElementById("amountInput");

const amountItemName = document.getElementById("amountItemName");

const amountQuantityResult = document.getElementById("amountQuantityResult");

const amountUnitName = document.getElementById("amountUnitName");

const confirmAmountQuantity = document.getElementById("confirmAmountQuantity");



let selectedAmountCartId = null;

let calculatedAmountQuantity = 0;

// فتح المودل

elements.invoiceBody.addEventListener("click", function (e) {



    const button = e.target.closest(".amount-quantity-btn");



    if (!button) return;



    const itemId = button.dataset.id;



    const row = cart.find(

        item => String(itemId) === String(item.item_id)

    );



    if (!row) return;



    selectedAmountCartId = itemId;



    amountItemName.value = row.item_name;



    amountInput.value = "";



    amountUnitName.textContent = row.unit_name;



    amountQuantityResult.textContent = "0";



    calculatedAmountQuantity = 0;



    amountModal.show();



    setTimeout(() => amountInput.focus(), 300);

});

// حساب الكمية عند إدخال المبلغ

amountInput.addEventListener("input", function () {
    const amount = Number(this.value);
    const row = cart.find(

        item => String(item.item_id) === String(selectedAmountCartId)

    );
    if (!row || !Number.isFinite(amount) || amount <= 0 ||

        !Number.isFinite(Number(row.unit_price)) ||

        Number(row.unit_price) <= 0) {



        calculatedAmountQuantity = 0;

        amountQuantityResult.textContent = "0";



        return;

    }
    calculatedAmountQuantity = (amount / Number(row.unit_price)).toFixed(3);
    amountQuantityResult.textContent =  calculatedAmountQuantity.replace(/\.?0+$/, "");

});

// اعتماد الكمية

confirmAmountQuantity.addEventListener("click", function () {
    const amount = Number(amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {

        amountInput.focus();

        return;

    }
    const row = cart.find(

        item => String(item.item_id) === String(selectedAmountCartId)

    );
    if (!row || calculatedAmountQuantity <= 0) return;

    row.quantity = calculatedAmountQuantity;



    amountModal.hide();


    renderCart();

    updateTotal();

});


function needsAmountButton(price) {
    const value = Number(price);
    return Math.abs(value * 2 - Math.round(value * 2)) > 0.000001;
}