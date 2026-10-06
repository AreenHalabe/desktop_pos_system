import { fetchCategories } from "../../../api/category.js";
import { url } from "../../../api/urlEndPoint.js";
import { showAuthExpired, bootboxSuccess, bootboxError } from "../../../component/bootbox.js";
import { setActiveNavLink } from "../../../component/bootbox.js";

import { getAuthToken, removeAuthToken } from "../../../component/auth.js";


const header = document.querySelector("site-header");


class SiteHeader extends HTMLElement {
    async connectedCallback() {

        const res = await fetch('../component/header.html');
        this.innerHTML = await res.text();

        // 🔔 إعلان رسمي: الهيدر جاهز
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




document.addEventListener('DOMContentLoaded', async function () {
    await Promise.all([
        loadCategoriesTree(),
        loadItemsTree()
    ]);

    loadMainCategories();

    filterProducts();
});



let categoriesData = [

    {
        id: 1,
        name: "الوجبات",

        categories: [
            { id: 1, name: "برجر" },
            { id: 2, name: "بيتزا" },
            { id: 3, name: "شاورما" }
        ]
    },

    {
        id: 2,
        name: "المشروبات",

        categories: [
            { id: 4, name: "عصائر" },
            { id: 5, name: "مشروبات غازية" },
            { id: 6, name: "قهوة" }
        ]
    },

    {
        id: 3,
        name: "الحلويات",

        categories: [
            { id: 7, name: "كيك" },
            { id: 8, name: "آيس كريم" }
        ]
    }

];


let products = [

    {
        id: 1,
        category_id: 1,
        name: "برجر لحم",
        price: 30,
        barcode: "44566782210",
        cost_price: 1.5
    },

    {
        id: 2,
        category_id: 1,
        name: "برجر دجاج",
        price: 28,
        barcode: "99534464742",
        cost_price: 4
    },

    {
        id: 3,
        category_id: 2,
        name: "بيتزا مارجريتا",
        price: 40,
        barcode: "9953401742",
        cost_price: 10
    },

    {
        id: 4,
        category_id: 2,
        name: "بيتزا خضار",
        price: 42,
        barcode: "995364742",
        cost_price: 2.5
    },

    {
        id: 5,
        category_id: 3,
        name: "شاورما دجاج",
        price: 25,
        barcode: "111222333",
        cost_price: 8
    },

    {
        id: 6,
        category_id: 4,
        name: "عصير برتقال",
        price: 8,
        barcode: "444555666",
        cost_price: 3
    },

    {
        id: 7,
        category_id: 5,
        name: "بيبسي",
        price: 5,
        barcode: "777888999",
        cost_price: 2
    },

    {
        id: 8,
        category_id: 6,
        name: "قهوة",
        price: 10,
        barcode: "123456789",
        cost_price: 4
    },

    {
        id: 9,
        category_id: 7,
        name: "كيك شوكولاتة",
        price: 20,
        barcode: "987654321",
        cost_price: 9
    },

    {
        id: 10,
        category_id: 8,
        name: "آيس كريم فانيلا",
        price: 12,
        barcode: "555444333",
        cost_price: 5
    },
    {
        id: 6,
        category_id: 4,
        name: "عصير برتقال",
        price: 8,
        barcode: "444555666",
        cost_price: 3
    },

    {
        id: 7,
        category_id: 5,
        name: "بيبسي",
        price: 5,
        barcode: "777888999",
        cost_price: 2
    },

    {
        id: 8,
        category_id: 6,
        name: "قهوة",
        price: 10,
        barcode: "123456789",
        cost_price: 4
    },

    {
        id: 9,
        category_id: 7,
        name: "كيك شوكولاتة",
        price: 20,
        barcode: "987654321",
        cost_price: 9
    },

    {
        id: 10,
        category_id: 8,
        name: "آيس كريم فانيلا",
        price: 12,
        barcode: "555444333",
        cost_price: 5
    },
    {
        id: 6,
        category_id: 4,
        name: "عصير برتقال",
        price: 8,
        barcode: "444555666",
        cost_price: 3
    },

    {
        id: 7,
        category_id: 5,
        name: "بيبسي",
        price: 5,
        barcode: "777888999",
        cost_price: 2
    },

    {
        id: 8,
        category_id: 6,
        name: "قهوة",
        price: 10,
        barcode: "123456789",
        cost_price: 4
    },

    {
        id: 9,
        category_id: 7,
        name: "كيك شوكولاتة",
        price: 20,
        barcode: "987654321",
        cost_price: 9
    },

    {
        id: 10,
        category_id: 8,
        name: "آيس كريم فانيلا",
        price: 12,
        barcode: "555444333",
        cost_price: 5
    },
    {
        id: 6,
        category_id: 4,
        name: "عصير برتقال",
        price: 8,
        barcode: "444555666",
        cost_price: 3
    },

    {
        id: 7,
        category_id: 5,
        name: "بيبسي",
        price: 5,
        barcode: "777888999",
        cost_price: 2
    },

    {
        id: 8,
        category_id: 6,
        name: "قهوة",
        price: 10,
        barcode: "123456789",
        cost_price: 4
    },

    {
        id: 9,
        category_id: 7,
        name: "كيك شوكولاتة",
        price: 20,
        barcode: "987654321",
        cost_price: 9
    },

    {
        id: 10,
        category_id: 8,
        name: "آيس كريم فانيلا",
        price: 12,
        barcode: "555444333",
        cost_price: 5
    },
    {
        id: 6,
        category_id: 4,
        name: "عصير برتقال",
        price: 8,
        barcode: "444555666",
        cost_price: 3
    },

    {
        id: 7,
        category_id: 5,
        name: "بيبسي",
        price: 5,
        barcode: "777888999",
        cost_price: 2
    },

    {
        id: 8,
        category_id: 6,
        name: "قهوة",
        price: 10,
        barcode: "123456789",
        cost_price: 4
    },

    {
        id: 9,
        category_id: 7,
        name: "كيك شوكولاتة",
        price: 20,
        barcode: "987654321",
        cost_price: 9
    },

    {
        id: 10,
        category_id: 8,
        name: "آيس كريم فانيلا",
        price: 12,
        barcode: "555444333",
        cost_price: 5
    },
    {
        id: 6,
        category_id: 4,
        name: "عصير برتقال",
        price: 8,
        barcode: "444555666",
        cost_price: 3
    },

    {
        id: 7,
        category_id: 5,
        name: "بيبسي",
        price: 5,
        barcode: "777888999",
        cost_price: 2
    },

    {
        id: 8,
        category_id: 6,
        name: "قهوة",
        price: 10,
        barcode: "123456789",
        cost_price: 4
    },

    {
        id: 9,
        category_id: 7,
        name: "كيك شوكولاتة",
        price: 20,
        barcode: "987654321",
        cost_price: 9
    },

    {
        id: 10,
        category_id: 8,
        name: "آيس كريم فانيلا",
        price: 12,
        barcode: "555444333",
        cost_price: 5
    },
    {
        id: 6,
        category_id: 4,
        name: "عصير برتقال",
        price: 8,
        barcode: "444555666",
        cost_price: 3
    },

    {
        id: 7,
        category_id: 5,
        name: "بيبسي",
        price: 5,
        barcode: "777888999",
        cost_price: 2
    },

    {
        id: 8,
        category_id: 6,
        name: "قهوة",
        price: 10,
        barcode: "123456789",
        cost_price: 4
    },

    {
        id: 9,
        category_id: 7,
        name: "كيك شوكولاتة",
        price: 20,
        barcode: "987654321",
        cost_price: 9
    },

    {
        id: 10,
        category_id: 8,
        name: "آيس كريم فانيلا",
        price: 12,
        barcode: "555444333",
        cost_price: 5
    },
    {
        id: 6,
        category_id: 4,
        name: "عصير برتقال",
        price: 8,
        barcode: "444555666",
        cost_price: 3
    },

    {
        id: 7,
        category_id: 5,
        name: "بيبسي",
        price: 5,
        barcode: "777888999",
        cost_price: 2
    },

    {
        id: 8,
        category_id: 6,
        name: "قهوة",
        price: 10,
        barcode: "123456789",
        cost_price: 4
    },

    {
        id: 9,
        category_id: 7,
        name: "كيك شوكولاتة",
        price: 20,
        barcode: "987654321",
        cost_price: 9
    },

    {
        id: 10,
        category_id: 8,
        name: "آيس كريم فانيلا",
        price: 12,
        barcode: "555444333",
        cost_price: 5
    },
    {
        id: 6,
        category_id: 4,
        name: "عصير برتقال",
        price: 8,
        barcode: "444555666",
        cost_price: 3
    },

    {
        id: 7,
        category_id: 5,
        name: "بيبسي",
        price: 5,
        barcode: "777888999",
        cost_price: 2
    },

    {
        id: 8,
        category_id: 6,
        name: "قهوة",
        price: 10,
        barcode: "123456789",
        cost_price: 4
    },

    {
        id: 9,
        category_id: 7,
        name: "كيك شوكولاتة",
        price: 20,
        barcode: "987654321",
        cost_price: 9
    },

    {
        id: 10,
        category_id: 8,
        name: "آيس كريم فانيلا",
        price: 12,
        barcode: "555444333",
        cost_price: 5
    },

];



let invoiceItems = [];



const searchInput =
    document.getElementById("searchInput");

const mainCategorySelect =
    document.getElementById("mainCategorySelect");

const subCategorySelect =
    document.getElementById("subCategorySelect");

const productsContainer =
    document.getElementById("productsContainer");

const invoiceItemsContainer =
    document.getElementById("invoiceItems");

const discountInput =
    document.getElementById("discount");

const subtotalElement =
    document.getElementById("subtotal");

const totalPriceElement =
    document.getElementById("totalPrice");

const itemsCountElement =
    document.getElementById("itemsCount");




document.addEventListener("click", function (e) {

    const addButton = e.target.closest(".add-product-btn");

    if (addButton) {

        const productId =
            Number(addButton.dataset.productId);

        addProduct(productId);

        return;
    }


    const removeButton =
        e.target.closest(".remove-product-btn");

    if (removeButton) {

        const productId =
            Number(removeButton.dataset.productId);

        removeProduct(productId);

        return;
    }

});


document.addEventListener("change", function (e) {



    if (e.target.closest(".cost-price-input")) {
        const costPriceInput = e.target.closest(".cost-price-input");

        const productId =
            Number(costPriceInput.dataset.productId);

        updateCostPrice(
            productId,
            costPriceInput.value
        );

        return;
    }




    if (e.target.closest(".qty-input")) {
        const qtyInput = e.target.closest(".qty-input");
        const productId =
            Number(qtyInput.dataset.productId);

        updateQty(
            productId,
            qtyInput.value
        );

        return;
    }

    if (e.target.classList.contains("unit-select")) {
        const productId = Number(e.target.dataset.productId);

        const item =
            invoiceItems.find(
                item => item.id === productId
            );

        if (!item) {
            return;
        }


        const product =
            products.find(
                product => product.id === productId
            );

        if (!product) {
            return;
        }


        const unitId = Number(e.target.value);

        const unit =
            product.units.find(
                unit => unit.id === unitId
            );

        if (!unit) {
            return;
        }


        item.unit = unit.id;

        item.cost_price = Number(Number(product.cost_price) * Number(unit.conversion_factor)).toFixed(2);
            // product.cost_price *
            // unit.conversion_factor;


        renderInvoice();


    }




});
// ==========================================
// CATEGORIES
// ==========================================

function loadMainCategories() {


    categoriesData.forEach(category => {

        const option =
            document.createElement("option");

        option.value = category.id;

        option.textContent = category.name;

        mainCategorySelect.appendChild(option);

    });

}


function loadSubCategories(mainCategoryId = "") {

    subCategorySelect.innerHTML = `
                <option value="">كل التصنيفات</option>
            `;

    if (!mainCategoryId) {
        return;
    }

    const mainCategory =
        categoriesData.find(
            category =>
                category.id == mainCategoryId
        );

    if (!mainCategory) {
        return;
    }

    mainCategory.categories.forEach(category => {

        const option =
            document.createElement("option");

        option.value = category.id;

        option.textContent = category.name;

        subCategorySelect.appendChild(option);

    });

}


// ==========================================
// GET CATEGORY NAME
// ==========================================

function getCategoryName(categoryId) {

    for (const mainCategory of categoriesData) {

        const category =
            mainCategory.categories.find(
                category =>
                    category.id === categoryId
            );

        if (category) {
            return category.name;
        }

    }

    return "";

}


// ==========================================
// FILTER PRODUCTS
// ==========================================

function filterProducts() {

    const search = searchInput.value.trim().toLowerCase();

    const mainCategory = mainCategorySelect.value;

    const subCategory = subCategorySelect.value;


    const filtered =
        products.filter(product => {

            const matchesSearch = !search ||
                product.name.toLowerCase().includes(search) ||
                product.barcode.some(
                    barcode =>
                        barcode.toLowerCase().includes(search)
                );


            const matchesMainCategory =
                !mainCategory ||
                categoriesData.some(
                    category =>
                        category.id == mainCategory &&
                        category.categories.some(
                            sub =>
                                sub.id === product.category_id
                        )
                );


            const matchesSubCategory =
                !subCategory ||
                product.category_id == subCategory;


            return (
                matchesSearch &&
                matchesMainCategory &&
                matchesSubCategory
            );

        });


    renderProducts(filtered);

}


// ==========================================
// RENDER PRODUCTS
// ==========================================


function renderProducts(productList) {

    productsContainer.innerHTML = "";


    if (productList.length === 0) {
        document.getElementById("noProducts").classList.remove("d-none");
        return;

    }


    document.getElementById("noProducts").classList.add("d-none");


    productList.forEach(product => {

        const col =
            document.createElement("div");


        col.innerHTML = `

            <div
                class="product-card add-product-btn"
                data-product-id="${product.id}"
            >

                <div class="product-name">
                    ${product.name}
                </div>


                <div class="product-price">
                    ${product.cost_price.toFixed(2)} ₪
                </div>


                <div class="product-category">
                    ${getCategoryName(product.category_id)}
                </div>

            </div>

        `;


        productsContainer.appendChild(col);

    });

}

// ==========================================
// ADD PRODUCT
// ==========================================

function addProduct(productId) {

    const product =
        products.find(
            product =>
                product.id === productId
        );

    if (!product) return;


    const existing =
        invoiceItems.find(
            item =>
                item.id === productId
        );


    if (existing) {

        existing.qty++;

    } else {

        invoiceItems.push({

            id: product.id,

            name: product.name,

            // barcode: product.barcode,

            cost_price: product.units.length === 1
                ? Number(Number(product.cost_price) * Number(product.units[0].conversion_factor)).toFixed(2)
                : null,

            unit: product.units.length === 1
                ? product.units[0].id
                : null,

            

            qty: 1

        });

    }


    renderInvoice();

}


// ==========================================
// REMOVE PRODUCT
// ==========================================

function removeProduct(productId) {

    invoiceItems =
        invoiceItems.filter(
            item =>
                item.id !== productId
        );


    renderInvoice();

}


// ==========================================
// UPDATE QTY
// ==========================================

function updateQty(productId, value) {

    const item =
        invoiceItems.find(
            item =>
                item.id === productId
        );

    if (!item) return;


    const qty =
        Number(value);


    if (qty <= 0 || isNaN(qty)) {

        removeProduct(productId);

        return;

    }


    item.qty = qty;

    renderInvoice();

}


// ==========================================
// UPDATE COST PRICE
// ==========================================

function updateCostPrice(productId, value) {

    const item =
        invoiceItems.find(
            item =>
                item.id === productId
        );

    if (!item) return;


    const price =
        Number(value);


    if (price < 0 || isNaN(price)) {
        return;
    }


    item.cost_price = price;

    renderInvoice();

}


// ==========================================
// RENDER INVOICE
// ==========================================

function renderInvoice() {

    invoiceItemsContainer.innerHTML = "";


    if (invoiceItems.length === 0) {

        invoiceItemsContainer.innerHTML = `

                    <tr>

                        <td
                            colspan="7"
                            class="text-center text-muted py-5">

                            <i class="fa-solid fa-cart-plus fa-2x mb-2"></i>

                            <div>
                                لم تتم إضافة أي أصناف للطلبية
                            </div>

                        </td>

                    </tr>

                `;

        updateTotals();

        return;

    }


    invoiceItems.forEach((item, index) => {

        const total =
            item.cost_price * item.qty;


        const row =
            document.createElement("tr");


        row.innerHTML = `

                    <td>
                        ${index + 1}
                    </td>


                    <td>

                        <strong>
                            ${item.name}
                        </strong>

                    </td>

                    <td>
                        <select
                            class="form-select unit-select"
                            data-product-id="${item.id}"
                        >
                            ${item.unit === null
                                ? `
                                        <option value="" selected disabled>
                                            اختر الوحدة
                                        </option>
                                    `
                                : ""
                            }

                            ${products.find(product => product.id === item.id).units.map(unit => `
                                    <option
                                        value="${unit.id}"
                                        ${unit.id === item.unit ? "selected" : ""}
                                    >
                                        ${unit.name}
                                    </option>
                                `)
                            .join("")}
                        </select>
                    </td>

                    <td>
                        <div class="input-group">
                            <input
                                type="number"
                                class="form-control cost-price-input"
                                min="0"
                                step="0.1"
                                value="${item.cost_price}"
                                data-product-id="${item.id}">

                            <span class="input-group-text">
                                ₪
                            </span>
                        </div>

                    </td>


                    <td>

                        <input
                            type="number"
                            class="form-control qty-input"
                            min="1"
                            step="0.1"
                            value="${item.qty}"
                            data-product-id="${item.id}">

                    </td>


                    <td>

                        <strong>
                            ${total.toFixed(2)} ₪
                        </strong>

                    </td>


                    <td>

                        <button
                            class="btn btn-outline-danger btn-sm remove-product-btn"
                             data-product-id="${item.id}">

                            <i class="fa-solid fa-trash"></i>

                        </button>

                    </td>

                `;


        invoiceItemsContainer.appendChild(row);

    });


    updateTotals();

}


// ==========================================
// TOTALS
// ==========================================

function updateTotals() {

    const subtotal =
        invoiceItems.reduce(
            (sum, item) =>
                sum +
                (item.cost_price * item.qty),
            0
        );


    let discount =
        Number(discountInput.value) || 0;


    if (discount < 0) {
        discount = 0;
    }


    if (discount > subtotal) {
        discount = subtotal;
    }


    const total =
        subtotal - discount;


    subtotalElement.textContent =
        subtotal.toFixed(2);


    totalPriceElement.textContent =
        total.toFixed(2);


    itemsCountElement.textContent =
        `${invoiceItems.length} صنف`;

}


// ==========================================
// CONFIRM ORDER
// ==========================================

function confirmOrder() {

    const supplierId =
        document.getElementById(
            "supplierSelect"
        ).value;


    if (!supplierId) {

        bootboxError("يرجى اختيار المورد");

        return;

    }


    if (invoiceItems.length === 0) {

        bootboxError("يرجى إضافة صنف واحد على الأقل");

        return;

    }


    const subtotal =
        invoiceItems.reduce(
            (sum, item) =>
                sum +
                (item.cost_price * item.qty),
            0
        );


    let discount =
        Number(discountInput.value) || 0;


    if (discount < 0) {
        discount = 0;
    }


    if (discount > subtotal) {
        discount = subtotal;
    }


    const totalPrice =
        subtotal - discount;


    const orderData = {

        supplier_id: Number(supplierId),

        total_price: Number(
            totalPrice.toFixed(2)
        ),

        discount: Number(
            discount.toFixed(2)
        ),

        items: invoiceItems

    };


    console.log("ORDER DATA:");

    console.log(orderData);




}


// ==========================================
// EVENTS
// ==========================================

searchInput.addEventListener(
    "input",
    filterProducts
);


mainCategorySelect.addEventListener(
    "change",
    () => {

        loadSubCategories(
            mainCategorySelect.value
        );

        filterProducts();

    }
);


subCategorySelect.addEventListener(
    "change",
    filterProducts
);


discountInput.addEventListener(
    "input",
    updateTotals
);


document.getElementById("clearFilters").addEventListener("click", () => {
    searchInput.value = "";

    mainCategorySelect.value = "";

    subCategorySelect.innerHTML = `
                <option value="">
                    كل التصنيفات
                </option>
            `;

    filterProducts();

});


document.getElementById("confirmOrder").addEventListener("click", confirmOrder);


// ==========================================
// INIT
// ==========================================




async function loadCategoriesTree() {
    try {
        const res = await fetch(url + `/category/tree-for-supplier`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });
        const data = await res.json();

        if (res.status === 200) {
            categoriesData = data;
            document.getElementById("loadingMainCategory")?.remove();
            document.getElementById("loadingSubCategory")?.remove();
            console.log("Categories Tree:", data);
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
        const res = await fetch(url + `/items/tree-for-supplier`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });
        const data = await res.json();

        if (res.status === 200) {
            products = data;
            console.log("Items Tree:", data);
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
