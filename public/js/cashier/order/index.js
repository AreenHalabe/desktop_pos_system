import { setActiveNavLink, showAuthExpired, showError, hiddeError, bootboxSuccess, bootboxError, showPrintLoader, hidePrintLoader } from "../../../component/bootbox.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import { printInvoiceFromCashier } from "../../../component/invoices.js";
import { bootboxLoginAsAdmin, closeSideBar } from "../Switch-user-functionality.js";


// const header = document.querySelector("site-header");


let sessionId;


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


document.addEventListener("DOMContentLoaded", async function () {
    const hasOpeningSession = await checkSession();
    if (hasOpeningSession) {
        await Promise.all([
            loadCategoriesTree(),
            loadItemsTree()
        ]);
        clearLoader();
        initializeCashier(categoriesData, itemsData);
    }
    else {
        handleSessionStatus();
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

function clearLoader(){
    document.getElementById("productLoader").remove();
}


// async function createOrder() {
//     displaySpinnerLoader(confirmOrderModal);
//     try {
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




// let categoriesData = [];
// let itemsData = [];


let categoriesData = [
    {
        id: 1,
        name: "مواد غذائية",
        categories: [
            { id: 101, name: "ألبان وأجبان" },
            { id: 102, name: "معلبات" },
            { id: 103, name: "زيوت ومواد تموينية" }
        ]
    },
    {
        id: 2,
        name: "مشروبات",
        categories: [
            { id: 201, name: "مياه معدنية" },
            { id: 202, name: "عصائر" },
            { id: 203, name: "مشروبات غازية" }
        ]
    },
    {
        id: 3,
        name: "تسالي",
        categories: [
            { id: 301, name: "شيبس" },
            { id: 302, name: "شوكولاتة" },
            { id: 303, name: "بسكويت" }
        ]
    },
    {
        id: 4,
        name: "منظفات",
        categories: [
            { id: 401, name: "مساحيق غسيل" },
            { id: 402, name: "منظفات منزلية" }
        ]
    }
];


let itemsData = [
    // =========================
    // ألبان وأجبان
    // =========================
    {
        id: 1,
        name: "حليب كامل الدسم",
        category_id: 101,
        units: [
            {
                id: 1,
                name: "حبة",
                barcode: null,
                price: 6,
                conversion_factor: 1
            },
            {
                id: 2,
                name: "باكيت",
                barcode: "100001",
                price: 18,
                conversion_factor: 3
            },
            {
                id: 3,
                name: "كرتونة",
                barcode: "100002",
                price: 72,
                conversion_factor: 12
            }
        ]
    },
    {
        id: 2,
        name: "لبن زبادي",
        category_id: 101,
        units: [
            {
                id: 4,
                name: "علبة",
                barcode: "100003",
                price: 3,
                conversion_factor: 1
            },
            {
                id: 5,
                name: "كرتونة",
                barcode: "100004",
                price: 36,
                conversion_factor: 12
            }
        ]
    },
    {
        id: 3,
        name: "جبنة بيضاء",
        category_id: 101,
        units: [
            {
                id: 6,
                name: "قطعة",
                barcode: null,
                price: 12,
                conversion_factor: 1
            }
        ]
    },

    // =========================
    // معلبات
    // =========================
    {
        id: 4,
        name: "فول معلب",
        category_id: 102,
        units: [
            {
                id: 7,
                name: "علبة",
                barcode: "200001",
                price: 4,
                conversion_factor: 1
            },
            {
                id: 8,
                name: "كرتونة",
                barcode: "200002",
                price: 48,
                conversion_factor: 12
            }
        ]
    },
    {
        id: 5,
        name: "ذرة معلبة",
        category_id: 102,
        units: [
            {
                id: 9,
                name: "علبة",
                barcode: "200003",
                price: 5,
                conversion_factor: 1
            }
        ]
    },

    // =========================
    // زيوت ومواد تموينية
    // =========================
    {
        id: 6,
        name: "زيت دوار الشمس",
        category_id: 103,
        units: [
            {
                id: 10,
                name: "عبوة",
                barcode: "300001",
                price: 15,
                conversion_factor: 1
            },
            {
                id: 11,
                name: "كرتونة",
                barcode: "300002",
                price: 90,
                conversion_factor: 6
            }
        ]
    },
    {
        id: 7,
        name: "أرز",
        category_id: 103,
        units: [
            {
                id: 12,
                name: "كيلو",
                barcode: null,
                price: 7,
                conversion_factor: 1
            },
            {
                id: 13,
                name: "كيس 5 كيلو",
                barcode: "300003",
                price: 32,
                conversion_factor: 5
            }
        ]
    },

    // =========================
    // مياه وعصائر ومشروبات
    // =========================
    {
        id: 8,
        name: "مياه معدنية",
        category_id: 201,
        units: [
            {
                id: 14,
                name: "حبة",
                barcode: "400001",
                price: 2,
                conversion_factor: 1
            },
            {
                id: 15,
                name: "ربطة",
                barcode: "400002",
                price: 12,
                conversion_factor: 6
            },
            {
                id: 16,
                name: "كرتونة",
                barcode: "400003",
                price: 24,
                conversion_factor: 12
            }
        ]
    },
    {
        id: 9,
        name: "عصير برتقال",
        category_id: 202,
        units: [
            {
                id: 17,
                name: "علبة",
                barcode: "400004",
                price: 4,
                conversion_factor: 1
            },
            {
                id: 18,
                name: "كرتونة",
                barcode: "400005",
                price: 48,
                conversion_factor: 12
            }
        ]
    },
    {
        id: 10,
        name: "مشروب غازي",
        category_id: 203,
        units: [
            {
                id: 19,
                name: "حبة",
                barcode: "400006",
                price: 5,
                conversion_factor: 1
            },
            {
                id: 20,
                name: "باكيت",
                barcode: "400007",
                price: 30,
                conversion_factor: 6
            }
        ]
    },

    // =========================
    // شيبس وشوكولاتة وبسكويت
    // =========================
    {
        id: 11,
        name: "شيبس بطعم الجبنة",
        category_id: 301,
        units: [
            {
                id: 21,
                name: "كيس",
                barcode: "500001",
                price: 2,
                conversion_factor: 1
            },
            {
                id: 22,
                name: "كرتونة",
                barcode: "500002",
                price: 40,
                conversion_factor: 20
            }
        ]
    },
    {
        id: 12,
        name: "شوكولاتة بالحليب",
        category_id: 302,
        units: [
            {
                id: 23,
                name: "قطعة",
                barcode: "500003",
                price: 3,
                conversion_factor: 1
            },
            {
                id: 24,
                name: "علبة",
                barcode: "500004",
                price: 30,
                conversion_factor: 10
            }
        ]
    },
    {
        id: 13,
        name: "بسكويت سادة",
        category_id: 303,
        units: [
            {
                id: 25,
                name: "باكيت",
                barcode: null,
                price: 4,
                conversion_factor: 1
            }
        ]
    },

    // =========================
    // منظفات
    // =========================
    {
        id: 14,
        name: "مسحوق غسيل",
        category_id: 401,
        units: [
            {
                id: 26,
                name: "كيس",
                barcode: "600001",
                price: 20,
                conversion_factor: 1
            },
            {
                id: 27,
                name: "كرتونة",
                barcode: "600002",
                price: 100,
                conversion_factor: 5
            }
        ]
    },
    {
        id: 15,
        name: "سائل تنظيف الأرضيات",
        category_id: 402,
        units: [
            {
                id: 28,
                name: "عبوة",
                barcode: "600003",
                price: 12,
                conversion_factor: 1
            }
        ]
    }
];

// ==================================================
// 1. المتغيرات والعناصر
// ==================================================

let cart = [];
let nextCartId = 1;

let barcodeMap = new Map();
let discountType = "partial";

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

    // إذا كان الصنف نفسه وبنفس الوحدة موجودًا، زد الكمية.
    const existingRow = cart.find(row =>
        String(row.item_id) === String(item.id) &&
        String(row.unit_id) === String(validUnit.id)
    );

    if (existingRow) {
        existingRow.quantity += 1;
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

            quantity: 1,
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

            for (const unit of units) {
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

        const decreaseButton = document.createElement("button");

        decreaseButton.type = "button";
        decreaseButton.className = "qty-btn decrease-qty";
        decreaseButton.setAttribute(
            "aria-label",
            "تقليل الكمية"
        );
        decreaseButton.textContent = "−";

        const quantityValue = document.createElement("span");

        quantityValue.className = "qty-value";
        quantityValue.textContent = String(row.quantity);

        const increaseButton = document.createElement("button");

        increaseButton.type = "button";
        increaseButton.className = "qty-btn increase-qty";
        increaseButton.setAttribute(
            "aria-label",
            "زيادة الكمية"
        );
        increaseButton.textContent = "+";

        quantityControl.append(
            decreaseButton,
            quantityValue,
            increaseButton
        );

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

        discountInput.value = String(row.discount_item);
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


    if(addNewItem){
        elements.invoiceTable.scrollTop = elements.invoiceTable.scrollHeight;
    }
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

    const subtotal = calculateSubtotal();
    const totalDiscount = calculateTotalDiscount();
    const grandTotal = calculateGrandTotal();

    const invoice = {
        items: cart.map(row => ({
            item_id: row.item_id,
            item_name: row.item_name,

            unit_id: row.unit_id,
            unit_name: row.unit_name,
            unit_price: row.unit_price,
            conversion_factor: row.conversion_factor,

            quantity: row.quantity,
            discount_item: row.discount_item
        })),

        total_discount_percentage:
            discountType === "full"
                ? getValidPercentage(
                    elements.totalDiscount?.value
                )
                : 0,

        discount_type: discountType,

        total_price: Number(subtotal.toFixed(2)),
        discount_amount: Number(totalDiscount.toFixed(2)),
    };

    console.log("بيانات الفاتورة:", invoice);

    return invoice;
}


// ==================================================
// 15. أحداث الصفحة
// ==================================================

// التركيز على الباركود عند النقر خارج حقول الإدخال.
document.addEventListener("click", function (e) {
    if (!e.target.closest("input, select, textarea")) {
        elements.barcodeInput?.focus();
    }

    // إضافة صنف من كرت المنتجات.
    const productButton = e.target.closest(".product-item");

    if (
        productButton &&
        elements.productList?.contains(productButton)
    ) {
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

elements.invoiceBody?.addEventListener(
    "input",
    function (e) {
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
    if (e.key !== "F4") return;

    e.preventDefault();
    printInvoiceToConsole();
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
                sessionId = data.session_id;
            }
            return data.hasOpeningSession
        }
        else {
            bootboxError(data.message);
            return false;
        }
    } catch (e) {
        bootboxError(e);
    }

}
async function loadCategoriesTree() {
    try {
        const res = await fetch(url + `/category/tree-for-supplier`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
        });
        const data = await res.json();

        if (res.status === 200) {
            categoriesData = data;
            document.getElementById("loadingMainCategory")?.remove();
            document.getElementById("loadingSubCategory")?.remove();
        }
        else if (res.status === 401) {
            showAuthExpired(data.message);
        }
        else {
            bootboxError(data.message);
        }

    } catch (err) {
        bootboxError("حدث خطأ في الاتصال : " + err.message);
    }
}
async function loadItemsTree() {
    try {
        const res = await fetch(url + `/items/tree-for-cashier`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
        });
        const data = await res.json();

        if (res.status === 200) {
            itemsData = data;
        }


        else if (res.status === 401) {
            showAuthExpired(data.message);
        }


        else {
            bootboxError(data.message);
        }

    } catch (err) {
        bootboxError("حدث خطأ في الاتصال : " + err.message);
    }
}