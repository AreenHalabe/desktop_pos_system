import { setActiveNavLink, showAuthExpired, bootboxError, showPrintLoader, hidePrintLoader } from "../../../component/bootbox.js";
import { url, urlServer, localUrlServer } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import { printInvoiceFromCashier } from "../../../component/invoices.js";
import { closeSideBar } from "../Switch-user-functionality.js";
import { loadItemsAndCategoriesTree, setSessionId, getSessionId, hasInternetConnection } from "../../../api/items.js";

const header = document.querySelector("site-header");

const overlayLoader = document.getElementById('overlay_loader');
const successModelOrder = document.getElementById('successModal');

let sessionId;


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


let categoriesData = [];
let itemsData = [];

document.addEventListener("DOMContentLoaded", async function () {

    const hasInternet = await hasInternetConnection();

    if (hasInternet) {

        const hasOpeningSession = await checkSession();
        if (hasOpeningSession) {
            ({ categoriesData, itemsData } = await loadItemsAndCategoriesTree());
            clearLoader();
            initializeCashier(categoriesData, itemsData);

        }
        else {
            handleSessionStatus();
        }


    }
    else {
        ({ categoriesData, itemsData } = await loadItemsAndCategoriesTree());
        clearLoader();
        initializeCashier(categoriesData, itemsData);
        sessionId = getSessionId();
    }


});

function handleSessionStatus() {
    const loader = document.getElementById("productLoader");

    loader.innerHTML = `
        <div class="text-center bg-light mx-auto py-5 w-100 rounded">
            <i class="fa-solid fa-cash-register text-muted fs-1 mb-3"></i>
            <p class="text-dark fs-4 mb-0">لا يوجد صندوق مفتوح</p>
        </div>
    `;
}

function clearLoader() {
    document.getElementById("productLoader").remove();
}


let cart = [];
let nextCartId = 1;

let barcodeMap = new Map();
let discountType = "partial";

let currentInvoiceData = null;

const currency = "₪";

const elements = {
    invoiceTable: document.querySelector(".invoice-table-wrap"),

    productsPanel: document.querySelector(".products-panel"),
    mainCategory: document.querySelector("#mainCategory"),
    subCategory: document.querySelector("#subCategory"),

    productSearch: document.querySelector(
        ".products-panel input[type='search']"
    ),

    productList: document.querySelector(".product-list"),

    barcodeInput: document.querySelector(
        ".barcode-input input"
    ),

    invoiceBody: document.querySelector(
        ".invoice-table tbody"
    ),

    totalDiscount: document.querySelector("#totalDiscount"),

    totalValue: document.querySelector(".total-value"),

    remainingValue: document.querySelector(
        ".remaining-box .payment-value"
    ),

    payButton: document.querySelector(".pay-btn"),

    newInvoiceButton: document.querySelector(
        ".invoice-panel .panel-heading button"
    )
};


// ==================================================
// 2. التقريب والتنسيق
// ==================================================

function roundDiscount(discount) {
    if (discount === 0) return 0;

    const firstDecimal = Math.floor(discount * 10) % 10;

    return Math.floor(discount) + (firstDecimal >= 4 ? 1 : 0);
}

function formatMoney(value) {
    return Number(value || 0).toFixed(2);
}

function getValidPercentage(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return 0;

    return Math.min(100, Math.max(0, number));
}


// ==================================================
// 3. تهيئة الكاشير
// ==================================================

function initializeCashier(categories, items) {
    categoriesData = Array.isArray(categories) ? categories : [];
    itemsData = Array.isArray(items) ? items : [];

    cart = [];
    nextCartId = 1;

    buildBarcodeMap();

    renderMainCategories();
    renderSubCategories();
    renderProducts();

    setDiscountMode("partial");

    renderCart();
    updateTotals();

    elements.barcodeInput?.focus();
}


// ==================================================
// 4. بناء خريطة الباركود
// ==================================================

function buildBarcodeMap() {
    barcodeMap.clear();

    for (const item of itemsData) {
        for (const unit of item.units ?? []) {
            if (
                unit.barcode === null ||
                unit.barcode === undefined
            ) {
                continue;
            }

            const barcode = String(unit.barcode).trim();

            if (!barcode) continue;

            if (!barcodeMap.has(barcode)) {
                barcodeMap.set(barcode, {
                    item,
                    selectedUnit: unit
                });
            }
        }
    }
}


// ==================================================
// 5. التصنيفات الرئيسية والفرعية
// ==================================================

function renderMainCategories() {
    if (!elements.mainCategory) return;

    elements.mainCategory.replaceChildren();

    elements.mainCategory.add(
        new Option("كل التصنيفات", "")
    );

    for (const category of categoriesData) {
        elements.mainCategory.add(
            new Option(category.name, String(category.id))
        );
    }
}


function renderSubCategories() {
    if (!elements.subCategory) return;

    const selectedMainId = elements.mainCategory?.value ?? "";

    const availableSubCategories = categoriesData
        .filter(category =>
            !selectedMainId ||
            String(category.id) === selectedMainId
        )
        .flatMap(category => category.categories ?? []);

    const previousSubId = elements.subCategory.value;

    elements.subCategory.replaceChildren();

    elements.subCategory.add(
        new Option("كل التصنيفات", "")
    );

    for (const category of availableSubCategories) {
        elements.subCategory.add(
            new Option(category.name, String(category.id))
        );
    }

    if (
        previousSubId &&
        availableSubCategories.some(
            category => String(category.id) === previousSubId
        )
    ) {
        elements.subCategory.value = previousSubId;
    }
}


// ==================================================
// 6. البحث والفلترة وعرض الأصناف
// ==================================================

function renderProducts() {
    if (!elements.productList) return;

    const mainId = elements.mainCategory?.value ?? "";
    const subId = elements.subCategory?.value ?? "";

    const searchText = (
        elements.productSearch?.value ?? ""
    ).trim().toLocaleLowerCase();

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
            String(item.name)
                .toLocaleLowerCase()
                .includes(searchText) ||
            String(item.id).includes(searchText) ||
            (item.units ?? []).some(unit =>
                unit.barcode &&
                String(unit.barcode).includes(searchText)
            );

        return (
            belongsToMain &&
            belongsToSub &&
            matchesSearch
        );
    });

    elements.productList.replaceChildren();

    if (visibleItems.length === 0) {
        const emptyMessage = document.createElement("div");

        emptyMessage.className =
            "text-center text-muted py-4";

        emptyMessage.textContent =
            "لا توجد أصناف مطابقة للبحث";

        elements.productList.append(emptyMessage);
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const item of visibleItems) {
        const productButton = document.createElement("button");

        productButton.type = "button";
        productButton.className = "product-item";
        productButton.dataset.itemId = String(item.id);

        const details = document.createElement("div");
        details.className = "product-details";

        const name = document.createElement("div");
        name.className = "product-name";
        name.textContent = item.name;

        const price = document.createElement("div");
        price.className = "product-price";

        const firstUnit = item.units?.[0];

        price.textContent = firstUnit
            ? `${formatMoney(firstUnit.price)} ${currency}`
            : "لا توجد وحدات";

        details.append(name, price);
        productButton.append(details);

        if (!firstUnit) {
            productButton.disabled = true;
            productButton.title =
                "لا توجد وحدات معرفة لهذا الصنف";
        }

        fragment.append(productButton);
    }

    elements.productList.append(fragment);
}


// ==================================================
// 7. إضافة صنف للسلة
// ==================================================

function addItemToCart(item, selectedUnit = null) {
    if (
        !item ||
        !Array.isArray(item.units) ||
        item.units.length === 0
    ) {
        return;
    }

    const unit = selectedUnit ?? item.units[0];

    const validUnit = item.units.find(
        currentUnit =>
            String(currentUnit.id) === String(unit.id)
    );

    if (!validUnit) return;

    const unitPrice = Number(validUnit.price);

    const initialQuantity = needsAmountButton(unitPrice) ? 0 : 1;

    // إذا كان الصنف نفسه وبنفس الوحدة موجودًا، زد الكمية.
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
            // معرّف داخلي لتمييز سطر السلة في الواجهة.
            cartId: nextCartId++,

            item_id: item.id,
            item_name: item.name,

            unit_id: validUnit.id,
            unit_name: validUnit.name,
            unit_price: Number(validUnit.price),
            conversion_factor: Number(
                validUnit.conversion_factor
            ),

            quantity: initialQuantity,
            discount_item: 0
        });
    }

    renderCart(true);
    updateTotals();
}


// ==================================================
// 8. عرض جدول الفاتورة
// ==================================================

function renderCart(addNewItem = false) {
    if (!elements.invoiceBody) return;

    elements.invoiceBody.replaceChildren();

    const fragment = document.createDocumentFragment();

    cart.forEach((row, index) => {
        const tr = document.createElement("tr");

        tr.dataset.cartId = String(row.cartId);

        // رقم السطر
        appendCell(tr, index + 1);

        // اسم الصنف
        const nameCell = document.createElement("td");
        const nameSpan = document.createElement("span");

        nameSpan.className = "item-name";
        nameSpan.textContent = row.item_name;

        nameCell.append(nameSpan);
        tr.append(nameCell);

        // الوحدات المتاحة تُقرأ من itemsData،
        // وليس من كائن مخزن داخل cart.
        const item = itemsData.find(
            currentItem =>
                String(currentItem.id) ===
                String(row.item_id)
        );

        const units = item?.units ?? [];

        const unitCell = document.createElement("td");

        if (units.length > 1) {
            const select = document.createElement("select");

            select.className =
                "form-select form-select-sm unit-select";

            select.setAttribute(
                "aria-label",
                "وحدة الصنف"
            );

            select.dataset.cartId = String(row.cartId);

            const availableUnits = getAvailableUnits(row, units);

            for (const unit of availableUnits) {
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



        // زر تحديد المبلغ يظهر فقط للأسعار التي تحتوي
        // على كسور غير النصف
        if (needsAmountButton(row.unit_price)) {

            const amountButton = document.createElement("button");

            amountButton.type = "button";
            amountButton.className = "amount-quantity-btn";

            amountButton.dataset.cartId = String(row.cartId);

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

        // الخصم الجزئي
        const discountCell = document.createElement("td");
        const discountGroup = document.createElement("div");

        discountGroup.className =
            "input-group input-group-sm discount-group";

        const discountInput = document.createElement("input");

        discountInput.type = "number";
        discountInput.className =
            "form-control discount-input";

        discountInput.min = "0";
        discountInput.max = "100";
        discountInput.step = "1";
        discountInput.placeholder = "0";

        discountInput.setAttribute(
            "aria-label",
            "نسبة الخصم"
        );

        discountInput.value = row.discount_item ? String(row.discount_item) : '';
        discountInput.disabled = discountType === "full";

        const percentLabel = document.createElement("span");

        percentLabel.className = "input-group-text";
        percentLabel.textContent = "%";

        discountGroup.append(
            discountInput,
            percentLabel
        );

        discountCell.append(discountGroup);
        tr.append(discountCell);

        // الإجمالي بعد الخصم
        const totalCell = document.createElement("td");
        const totalStrong = document.createElement("strong");

        totalStrong.className = "line-total";
        totalStrong.textContent = formatMoney(
            calculateLineTotal(row)
        );

        totalCell.append(totalStrong);
        tr.append(totalCell);

        // الحذف
        const removeCell = document.createElement("td");
        const removeButton = document.createElement("button");

        removeButton.type = "button";
        removeButton.className = "remove-btn";

        removeButton.setAttribute(
            "aria-label",
            "حذف الصنف"
        );

        const trashIcon = document.createElement("i");
        trashIcon.className = "fa-solid fa-trash";

        removeButton.append(trashIcon);
        removeCell.append(removeButton);
        tr.append(removeCell);

        fragment.append(tr);
    });

    elements.invoiceBody.append(fragment);


    if (addNewItem) {
        elements.invoiceTable.scrollTop = elements.invoiceTable.scrollHeight;
    }
}


function getAvailableUnits(row, units) {
    return units.filter(unit => {
        // الوحدة المختارة حاليًا في هذا الصف
        if (String(unit.id) === String(row.unit_id)) {
            return true;
        }

        // هل الوحدة مستخدمة في صف آخر لنفس الصنف؟
        return !cart.some(cartRow =>
            String(cartRow.item_id) === String(row.item_id) &&
            String(cartRow.cartId) !== String(row.cartId) &&
            String(cartRow.unit_id) === String(unit.id)
        );
    });
}

function appendCell(row, value) {
    const cell = document.createElement("td");

    cell.textContent = String(value);
    row.append(cell);
}


// ==================================================
// 9. حساب الإجماليات والخصومات
// ==================================================

function calculateLineTotal(row) {
    const subtotal =
        row.quantity * Number(row.unit_price || 0);

    if (discountType === "full") {
        return subtotal;
    }

    const discountAmount = roundDiscount(
        subtotal *
        getValidPercentage(row.discount_item) /
        100
    );

    return Math.max(0, subtotal - discountAmount);
}


function calculateSubtotal() {
    return cart.reduce((sum, row) => {
        return sum +
            row.quantity * Number(row.unit_price || 0);
    }, 0);
}


function calculateTotalDiscount() {
    const subtotal = calculateSubtotal();

    if (discountType === "full") {
        const percentage = getValidPercentage(
            elements.totalDiscount?.value
        );

        return roundDiscount(
            subtotal * percentage / 100
        );
    }

    return cart.reduce((sum, row) => {
        const lineSubtotal =
            row.quantity * Number(row.unit_price || 0);

        const discountAmount = roundDiscount(
            lineSubtotal *
            getValidPercentage(row.discount_item) /
            100
        );

        return sum + discountAmount;
    }, 0);
}


function calculateGrandTotal() {
    return Math.max(
        0,
        calculateSubtotal() - calculateTotalDiscount()
    );
}


function updateTotals() {
    const total = calculateGrandTotal();

    if (elements.totalValue) {
        elements.totalValue.textContent =
            `${formatMoney(total)} ${currency}`;
    }

    if (elements.remainingValue) {
        elements.remainingValue.replaceChildren();

        const amount = document.createTextNode(
            formatMoney(total) + " "
        );

        const currencyElement =
            document.createElement("small");

        currencyElement.textContent = currency;

        elements.remainingValue.append(
            amount,
            currencyElement
        );
    }
}


// ==================================================
// 10. التبديل بين الخصم الجزئي والكلي
// ==================================================

function setDiscountMode(mode) {
    discountType = mode === "full" ? "full" : "partial";

    if (discountType === "full") {
        // إلغاء خصومات الأصناف عند اختيار الخصم الكلي.
        for (const row of cart) {
            row.discount_item = 0;
        }

        if (elements.totalDiscount) {
            elements.totalDiscount.disabled = false;
        }
    } else {
        if (elements.totalDiscount) {
            elements.totalDiscount.value = "";
            elements.totalDiscount.disabled = true;
        }
    }

    renderCart();
    updateTotals();
}


// ==================================================
// 11. معالجة الباركود عند الضغط على Enter
// ==================================================

function handleBarcodeEnter() {
    const barcode = elements.barcodeInput?.value.trim();

    if (!barcode) return;

    const match = barcodeMap.get(barcode);

    if (!match) {
        bootboxError(
            "لم يتم العثور على صنف بهذا الباركود:",
            barcode
        );

        elements.barcodeInput.value = "";
        elements.barcodeInput.focus();

        return;
    }

    addItemToCart(
        match.item,
        match.selectedUnit
    );

    elements.barcodeInput.value = "";
    elements.barcodeInput.focus();
}


// ==================================================
// 12. تغيير الوحدة داخل السلة
// ==================================================

function changeCartUnit(cartId, unitId) {
    const row = cart.find(
        currentRow =>
            currentRow.cartId === cartId
    );

    if (!row) return;

    const item = itemsData.find(
        currentItem =>
            String(currentItem.id) ===
            String(row.item_id)
    );

    if (!item) return;

    const selectedUnit = (item.units ?? []).find(
        unit =>
            String(unit.id) === String(unitId)
    );

   

    if (!selectedUnit) return;

    // تحديث بيانات الوحدة فقط، دون تخزين كائن الوحدة.
    row.unit_id = selectedUnit.id;
    row.unit_name = selectedUnit.name;
    row.unit_price = Number(selectedUnit.price);
    


    const qty = needsAmountButton(Number(selectedUnit.price)) ? 0 : 1

    row.quantity = qty;
    row.conversion_factor = Number(
        selectedUnit.conversion_factor
    );

    renderCart();
    updateTotals();
}


// ==================================================
// 13. الكمية والخصم والحذف
// ==================================================

function changeQuantity(cartId, amount) {
    const row = cart.find(
        currentRow =>
            currentRow.cartId === cartId
    );

    if (!row) return;

    row.quantity += amount;

    if (row.quantity < 1) {
        row.quantity = 1;
    }

    renderCart();
    updateTotals();
}


function removeCartItem(cartId) {
    cart = cart.filter(
        row => row.cartId !== cartId
    );

    renderCart();
    updateTotals();
}


function updateLineDiscount(cartId, value) {
    const row = cart.find(
        currentRow =>
            currentRow.cartId === cartId
    );

    if (!row || discountType === "full") return;

    row.discount_item = getValidPercentage(value);

    const tr = elements.invoiceBody.querySelector(
        `tr[data-cart-id="${cartId}"]`
    );

    const totalElement = tr?.querySelector(".line-total");

    if (totalElement) {
        totalElement.textContent = formatMoney(
            calculateLineTotal(row)
        );
    }

    updateTotals();
}


// ==================================================
// 14. تجهيز الفاتورة النهائية
// ==================================================

function printInvoiceToConsole() {
    if (cart.length === 0) {
        bootboxError(
            "لا يمكن الدفع، الفاتورة فارغة."
        );

        return;
    }

    const invalidItem = cart.find(row => Number(row.quantity) <= 0);

    if (invalidItem) {
        bootboxError(
            `لا يمكن الدفع، الرجاء تحديد المبلغ أو الكمية للصنف: ${invalidItem.item_name}`
        );

        return;
    }

    const subtotal = calculateSubtotal();
    const totalDiscount = calculateTotalDiscount();

    const invoice = {
        items: cart,
        total_discount_percentage:
            discountType === "full"
                ? getValidPercentage(
                    elements.totalDiscount?.value
                )
                : 0,

        total_price: Number(subtotal.toFixed(2)),
        discount_amount: Number(totalDiscount.toFixed(2)),
    };

    showConfirmPayDialog(invoice);
}


// ==================================================
// 15. أحداث الصفحة
// ==================================================

// التركيز على الباركود عند النقر خارج حقول الإدخال.
document.addEventListener("click", async function (e) {
    if (!e.target.closest("input, select, textarea")) {
        elements.barcodeInput?.focus();
    }

    // إضافة صنف من كرت المنتجات.
    const productButton = e.target.closest(".product-item");

    if (productButton && elements.productList?.contains(productButton)) {
        const itemId = productButton.dataset.itemId;

        const item = itemsData.find(
            currentItem =>
                String(currentItem.id) === itemId
        );

        if (item) {
            addItemToCart(item);
        }

        return;
    }

    // زيادة الكمية.
    const increaseButton = e.target.closest(".increase-qty");

    if (increaseButton) {
        const cartId = Number(
            increaseButton.closest("tr")?.dataset.cartId
        );

        if (cartId) changeQuantity(cartId, 1);

        return;
    }

    // تقليل الكمية.
    const decreaseButton = e.target.closest(".decrease-qty");

    if (decreaseButton) {
        const cartId = Number(
            decreaseButton.closest("tr")?.dataset.cartId
        );

        if (cartId) changeQuantity(cartId, -1);

        return;
    }

    // حذف الصنف.
    const removeButton = e.target.closest(".remove-btn");

    if (removeButton) {
        const cartId = Number(
            removeButton.closest("tr")?.dataset.cartId
        );

        if (cartId) removeCartItem(cartId);

        return;
    }

    // الدفع.
    const payButton = e.target.closest(".pay-btn");

    if (payButton) {
        printInvoiceToConsole();
        return;
    }

    // فاتورة جديدة.
    const newInvoiceButton = e.target.closest(
        ".invoice-panel .panel-heading button"
    );

    if (newInvoiceButton) {
        reSetOrder();
        return;
    }

    if (e.target.closest('.print-invoice-btn')) {
        closeSuccessModal();
        try {
            await printInvoiceFromCashier(currentInvoiceData);
        } catch (e) {
            bootboxError(e.message);
        } finally {
            clearFinalOrderDetails();
            reSetOrder();
        }
    }



    else if (e.target.closest('.close-success-modal')) {
        clearFinalOrderDetails();
        closeSuccessModal();
        reSetOrder();
        return;
    }



});


// ==================================================
// 16. أحداث التصنيفات والبحث
// ==================================================

elements.mainCategory?.addEventListener(
    "change",
    function () {
        renderSubCategories();
        renderProducts();
    }
);

elements.subCategory?.addEventListener(
    "change",
    renderProducts
);

elements.productSearch?.addEventListener(
    "input",
    renderProducts
);


// ==================================================
// 17. الباركود
// ==================================================

elements.barcodeInput?.addEventListener(
    "keydown",
    function (e) {
        if (e.key !== "Enter") return;

        e.preventDefault();
        handleBarcodeEnter();
    }
);


// ==================================================
// 18. تغيير الوحدة داخل الفاتورة
// ==================================================

elements.invoiceBody?.addEventListener(
    "change",
    function (e) {
        if (!e.target.matches(".unit-select")) return;

        changeCartUnit(
            Number(e.target.dataset.cartId),
            e.target.value
        );
    }
);


// ==================================================
// 19. تغيير خصم الصنف
// ==================================================

elements.invoiceBody?.addEventListener("input", function (e) {
    if (!e.target.matches(".discount-input")) return;

    updateLineDiscount(
        Number(
            e.target.closest("tr")?.dataset.cartId
        ),
        e.target.value
    );
}
);


// ==================================================
// 20. تبديل نوع الخصم
// ==================================================

document.addEventListener("change", function (e) {
    if (
        !e.target.matches(
            'input[name="discountType"]'
        )
    ) {
        return;
    }

    setDiscountMode(e.target.value);
});


// ==================================================
// 21. تغيير الخصم الكلي
// ==================================================

elements.totalDiscount?.addEventListener(
    "input",
    function () {
        if (discountType !== "full") return;

        updateTotals();
    }
);


// ==================================================
// 22. اختصار الدفع F4
// ==================================================

document.addEventListener("keydown", function (e) {
    if (e.key == "F4") {
        e.preventDefault();
        printInvoiceToConsole();
    }

    else if (e.key === "=") {
        e.preventDefault();

        if (cart.length > 0) {
            cart[cart.length - 1].quantity += 1;

            renderCart();
            updateTotals();
        }
    }
    else if (e.key === "-") {
        e.preventDefault();

        if (cart.length > 0) {
            const lastItem = cart[cart.length - 1];

            if (lastItem.quantity > 0) {
                lastItem.quantity -= 1;

                renderCart();
                updateTotals();
            }
        }
    }

});


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
                setSessionId(data.session_id);
                sessionId = data.session_id;
            }
            return data.hasOpeningSession
        }
        else {
            bootboxError(data.message);
            return false;
        }
    } catch (e) {
        const hasInternet = await hasInternetConnection();
        if (!hasInternet) {
            sessionId = getSessionId();
            return true;
        } else {
            bootboxError(e.message);
        }

    }

}


async function createOrder(activeUrl, invData) {
    
    overlayLoader.style.display = 'flex';
    try {
        const res = await fetch(activeUrl + `/creat/order?session_id=${sessionId}`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
            body: JSON.stringify(invData),
        });
        const data = await res.json();
        if (res.status === 401) {
            showAuthExpired(data.message);
            return false;
        }
        else if (res.status === 200) {
            return {
                message: data.message,
                inv_num: data.invoiceNum || '000',
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
        overlayLoader.style.display = 'none';
    }
}


const confirmPayModalElement = document.getElementById("confirmPayModal");

const confirmPayModal = bootstrap.Modal.getOrCreateInstance(
    confirmPayModalElement
);

const confirmPayDialog = $(confirmPayModalElement);

// عرض الفاتورة وفتح النافذة
function showConfirmPayDialog(invoiceData) {
    currentInvoiceData = invoiceData;

    const itemsHtml = invoiceData.items.map(item => {
        const lineTotal = calculateLineTotal(item);

        return `
            <tr>
                <td class="text-center fw-semibold" style ="font-size:13px">
                    ${item.item_name}
                </td>

                <td class="text-center" style ="font-size:15px">
                    ${item.unit_name}
                </td>

                <td class="text-center">
                    ${item.quantity}
                </td>

                <td class="text-center" style ="font-size:15px">
                    ₪ ${formatMoney(item.unit_price)}
                </td>

                <td class="text-center">
                    <span class="badge bg-danger-subtle text-danger border border-danger-subtle" style ="font-size:12px">
                        ${invoiceData.discount_type === "full"
                ? "—"
                : `%${item.discount_item || 0}`}
                    </span>
                </td>

                <td class="text-center fw-bold">
                    ₪ ${formatMoney(lineTotal)}
                </td>
            </tr>
        `;
    }).join("");

    // تحديث أصناف الفاتورة
    confirmPayDialog.find("#confirmOrderItems").html(itemsHtml);

    // تحديث المجاميع
    confirmPayDialog.find("#confirmSubtotal").text(
        `₪ ${formatMoney(invoiceData.total_price)}`
    );

    confirmPayDialog.find("#confirmDiscount").text(
        `− ₪ ${formatMoney(invoiceData.discount_amount)}`
    );

    const grandTotal = Number(
        (
            invoiceData.total_price -
            invoiceData.discount_amount
        ).toFixed(2)
    );

    confirmPayDialog.find("#confirmGrandTotal").text(
        `₪ ${formatMoney(grandTotal)}`
    );

    // إعادة تعيين الحقول عند فتح فاتورة جديدة
   
    confirmPaymentMethod.value = "";
    customerAccountContainer.classList.add("d-none");
    confirmCustomerId.value = "";


    confirmPayDialog.find("#receivedAmount").val("");

    confirmPayDialog.find("#changeAmount")
        .text("0.00 ₪")
        .css("color", "#6c757d");

    // إعادة حالة زر التأكيد
    const confirmButton = confirmPayDialog.find("#confirmOrderButton");

    confirmButton
        .prop("disabled", true)
        .html('<i class="fa-solid fa-check me-1"></i> تأكيد الطلب');

    // فتح نفس النافذة كل مرة
    confirmPayModal.show();
}


// التمرير داخل جدول الفاتورة
confirmPayModalElement.addEventListener("shown.bs.modal", function () {
    const tableWrapper = confirmPayDialog.find(".table-responsive")[0];

    if (tableWrapper) {
        tableWrapper.scrollTo({
            top: tableWrapper.scrollHeight,
            behavior: "smooth"
        });
    }
});


// تعطيل التأكيد حتى يختار طريقة الدفع
confirmPayDialog.find("#confirmPaymentMethod").on("change", function () {

    const paymentMethod = this.value;

    const customerContainer = confirmPayDialog.find("#customerAccountContainer");
    const customerSelect = confirmPayDialog.find("#confirmCustomerId");

    if (paymentMethod === "دفع بالدين") {

        customerContainer.removeClass("d-none");

    } else {

        customerContainer.addClass("d-none");
        customerSelect.val("");
    }

    const customerRequired =
        paymentMethod !== "دفع بالدين" ||
        Boolean(customerSelect.val());

    confirmPayDialog.find("#confirmOrderButton").prop(
        "disabled",
        !paymentMethod || !customerRequired
    );
});


confirmPayDialog.find("#confirmCustomerId").on("change", function () {

    const paymentMethod = confirmPayDialog.find("#confirmPaymentMethod").val();

    confirmPayDialog.find("#confirmOrderButton").prop(
        "disabled",
        !paymentMethod ||
        (paymentMethod === "دفع بالدين" && !this.value)
    );
});


// حساب الباقي للزبون
confirmPayDialog.find("#receivedAmount").on("input", function () {
    if (!currentInvoiceData) {
        return;
    }

    const receivedAmount = Number(this.value);

    const grandTotal = Number(
        (
            currentInvoiceData.total_price -
            currentInvoiceData.discount_amount
        ).toFixed(2)
    );

    const change = receivedAmount - grandTotal;

    const changeElement = confirmPayDialog.find("#changeAmount");

    if (this.value === "" || !Number.isFinite(receivedAmount)) {
        changeElement.text("0.00 ₪");
        changeElement.css("color", "#6c757d");
        return;
    }

    changeElement.text(`${change.toFixed(2)} ₪`);

    changeElement.css(
        "color",
        change < 0 ? "#dc3545" : "#198754"
    );
});


// تأكيد الطلب وحفظه
confirmPayDialog.find("#confirmOrderButton").on("click", async function () {
    const confirmButton = $(this);

    const paymentMethod = confirmPayDialog.find("#confirmPaymentMethod").val();

    if (!paymentMethod || !currentInvoiceData) {
        return;
    }

    confirmButton.prop("disabled", true);

    confirmButton.html(
        '<span class="spinner-border spinner-border-sm me-1"></span> جاري الحفظ...'
    );

    currentInvoiceData.payment_method = paymentMethod;

    currentInvoiceData.customer_id = confirmCustomerId.value;

    const activeUrl = await checkRemoteServer();

    const result = await createOrder(activeUrl, currentInvoiceData);



    currentInvoiceData.inv_num = result?.inv_num ?? 0;

    if (result === false) {
        confirmButton.prop("disabled", false);

        confirmButton.html(
            '<i class="fa-solid fa-check me-1"></i> تأكيد الطلب'
        );

        return;
    }



    confirmPayModal.hide();

    showSuccessModal(result.message);


});


function reSetOrder() {
    cart = [];
    nextCartId = 1;

    if (elements.totalDiscount) {
        elements.totalDiscount.value = "";
    }

    const partialRadio = document.querySelector(
        'input[name="discountType"][value="partial"]'
    );

    if (partialRadio) {
        partialRadio.checked = true;
    }

    setDiscountMode("partial");

    if (elements.barcodeInput) {
        elements.barcodeInput.value = "";
        elements.barcodeInput.focus();
    }
}

function showSuccessModal(message) {
    const modal = new bootstrap.Modal(successModelOrder);
    modal.show();
    document.getElementById('successMessage').textContent = message;
}

function closeSuccessModal() {
    bootstrap.Modal.getInstance(successModelOrder).hide();
}

function clearFinalOrderDetails() {
    currentInvoiceData = {
        items: [],
        total_price: 0,
        payment_method: '',
        discount_amount: 0,
        inv_num: 0,
    };
}


async function checkRemoteServer() {
    try {
        const response = await fetch(`${url}/test/connection`, {
            method: 'GET',
            cache: 'no-store',
            signal: AbortSignal.timeout(5000)
        });

        return response.ok ? url : localUrlServer;

    } catch (error) {
        return localUrlServer;
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

    const cartId = button.dataset.cartId;

    const row = cart.find(
        item => String(item.cartId) === String(cartId)
    );

    if (!row) return;

    selectedAmountCartId = cartId;

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
        item => String(item.cartId) === String(selectedAmountCartId)
    );

    if (!row || !Number.isFinite(amount) || amount <= 0 ||
        !Number.isFinite(Number(row.unit_price)) ||
        Number(row.unit_price) <= 0) {

        calculatedAmountQuantity = 0;
        amountQuantityResult.textContent = "0";

        return;
    }

    calculatedAmountQuantity = (amount / Number(row.unit_price)).toFixed(3);

    amountQuantityResult.textContent =
        calculatedAmountQuantity.replace(/\.?0+$/, "");
});
// اعتماد الكمية
confirmAmountQuantity.addEventListener("click", function () {

    const amount = Number(amountInput.value);

    if (!Number.isFinite(amount) || amount <= 0) {
        amountInput.focus();
        return;
    }

    const row = cart.find(
        item => String(item.cartId) === String(selectedAmountCartId)
    );

    if (!row || calculatedAmountQuantity <= 0) return;

    row.quantity = calculatedAmountQuantity;

    amountModal.hide();

    renderCart();
    updateTotals();
});



function needsAmountButton(price) {

    const value = Number(price);

    return Math.abs(value * 2 - Math.round(value * 2)) > 0.000001;
}






const confirmPaymentMethod = confirmPayDialog.find("#confirmPaymentMethod")[0];
const customerAccountContainer = confirmPayDialog.find("#customerAccountContainer")[0];
const confirmCustomerId = confirmPayDialog.find("#confirmCustomerId")[0];
const confirmOrderButton = confirmPayDialog.find("#confirmOrderButton")[0];

confirmPaymentMethod.addEventListener("change", function () {

    if (this.value === "دفع بالدين") {

        customerAccountContainer.classList.remove("d-none");
        confirmCustomerId.required = true;

    } else {

        customerAccountContainer.classList.add("d-none");
        confirmCustomerId.value = "";
        confirmCustomerId.required = false;
    }

    updateConfirmButtonState();
});

confirmCustomerId.addEventListener("change", function () {
    updateConfirmButtonState();
});

function updateConfirmButtonState() {

    const paymentMethod = confirmPaymentMethod.value;
    const customerId = confirmCustomerId.value;

    const validPayment = paymentMethod !== "";

    const validCustomer =
        paymentMethod !== "دفع بالدين" ||
        customerId !== "";

    confirmOrderButton.disabled =
        !validPayment || !validCustomer;
}