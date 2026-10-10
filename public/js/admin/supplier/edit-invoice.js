import { url } from "../../../api/urlEndPoint.js";
import { showAuthExpired, bootboxSuccess, bootboxError } from "../../../component/bootbox.js";
import { setActiveNavLink } from "../../../component/bootbox.js";

import { getAuthToken, removeAuthToken } from "../../../component/auth.js";


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




document.addEventListener('DOMContentLoaded', async function () {
    await Promise.all([
        loadCategoriesTree(),
        loadItemsTree(),
        loadSuppliers()
    ]);

    await loadInvoice();

    loadMainCategories();

    filterProducts();
});


let categoriesData;


let products ;



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


        item.unit_id = unit.id;
        item.unit_name = unit.name;

        item.cost_price = roundAmount(Number(Number(product.cost_price) * Number(unit.conversion_factor)).toFixed(2));
        
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

            cost_price: product.units.length === 1
                ? roundAmount(Number(Number(product.cost_price) * Number(product.units[0].conversion_factor)).toFixed(2))
                : 0,

            unit_id: product.units.length === 1
                ? product.units[0].id
                : null,

            unit_name :product.units.length === 1
                ? product.units[0].name
                : '',


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
           Number(item.cost_price * item.qty).toFixed(2);

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
                            ${item.unit_id === null
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
                                        ${unit.id === item.unit_id ? "selected" : ""}
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
                            ${total} ₪
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

    const supplierId =document.getElementById("supplierSelect").value;


    if (!supplierId) {
        bootboxError("يرجى اختيار المورد");
        return;
    }


    if (invoiceItems.length === 0) {
        bootboxError("يرجى إضافة صنف واحد على الأقل");
        return;
    }

    let totalPrice = 0;
    let hasErrorInInput = false;
    invoiceItems.forEach(item => {
        if (item.unit_id === null) {
            bootboxError(`يرجى اختيار الوحدة للصنف: ${item.name}`);
            hasErrorInInput = true;

            return;
        }
        if (item.cost_price === null || item.cost_price <= 0) {
            bootboxError(`يرجى إدخال سعر التكلفة للصنف: ${item.name}`);
            hasErrorInInput = true;

            return;
        }

        if (item.qty <= 0) {
            bootboxError(`يرجى إدخال كمية صحيحة للصنف: ${item.name}`);
            hasErrorInInput = true;

            return;
        }

        totalPrice += Number(item.cost_price * item.qty);
    });

    if(hasErrorInInput){
        return;
    }


    let discount = Number(discountInput.value) || 0;


    if (discount < 0) {
        bootboxError('الخصم لا يمكن أن يكون بالسالب');
        return;
    }


    if (discount > totalPrice) {
        bootboxError("الخصم لا يمكن أن يكون أكبر من المجموع الفرعي");
        return;
    }




    const orderData = {

        supplier_id: Number(supplierId),

        total_price: totalPrice,

        discount: Number(discount.toFixed(2)),

        items: invoiceItems

    };

    // await createInvoice(orderData);

    showConfirmSupplierOrderDialog(orderData);
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

            console.log(products);
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

async function loadInvoice() {
    const id = getInvoiceId();

    if(!id) return;
   
    try {
        const res = await fetch(url + `/invoice?invoice_id=${id}`, {
            method: "GET",
            headers: {
                "Authorization": `${getAuthToken('auth')}`
            }
        });
        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }
        else if (res.status === 200) {
            console.log(data.invoice);
            addItemInvoiceInTable(data.invoice.items);
            // currentInvoice = data.invoice;
        
            // fillInvoiceData(data.invoice);
        }
        else {
            bootboxError(data.message);
        }

    } catch (e) {
        bootboxError(e.message);
    }
    


}


function getInvoiceId() {
    const params = new URLSearchParams(window.location.search);
    const invoiceId = params.get("invoice_id");

    return invoiceId;
}
function getSupplierId() {
    const params = new URLSearchParams(window.location.search);
    const supplierId = params.get("supplier_id");

    return supplierId;
}

async function loadSuppliers() {
    try {
        const res = await fetch(url + '/suppliers', {
            method: "GET",
            headers: {
                "Authorization": `${getAuthToken('auth')}`
            }
        });
        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }
        else if (res.status === 200) {
            setSupplierData(data.suppliers);
        }
        else {
            bootboxError(data.message);
        }

    } catch (e) {
        bootboxError(e.message);
    }
}

function setSupplierData(suppliers) {

    const selectSuppliers =  document.getElementById("supplierSelect");

    document.getElementById('loadingSupplier')?.remove();

    const supplierId = getSupplierId();

    if(suppliers.length === 0){
        const option = document.createElement("option");
        option.value = '';
        option.textContent = 'لا يوجد حسابات مُضافة للموردين';
        return;
    }

    suppliers.forEach(supplier => {

        const option = document.createElement("option");

        option.value = supplier.id;

        option.textContent = supplier.name;

        if (Number(supplier.id) === Number(supplierId)) {
            option.selected = true;
        }

        selectSuppliers.appendChild(option);

    });

    



}
async function createInvoice(invoiceData) {

    console.log(invoiceData);
    // const loader = document.getElementById('overlay_loader');
    // loader.style.display= 'flex';
    // try {
    //     const res = await fetch(url + `/invoice/create`, {
    //         method: 'POST',
    //         headers: {
    //             "Content-Type": "application/json",
    //             "Authorization": `${getAuthToken('auth')}`
    //         },
    //         body: JSON.stringify(invoiceData),
    //     });
    //     const data = await res.json();

    //     if (res.status === 200) {
    //        bootboxSuccess(data.message);
    //     }


    //     else if (res.status === 401) {
    //         showAuthExpired(data.message);
    //     }


    //     else {
    //         bootboxError(data.message);
    //     }

    // } catch (err) {
    //     bootboxError("حدث خطأ في الاتصال : " + err.message);
    // }finally{
    //     loader.style.display= 'none';
    // }
}


function roundAmount(amount) {
    if (amount === 0) return 0;

    const decimal = amount - Math.floor(amount);

    return decimal >= 0.5
        ? amount
        : Math.floor(amount);
}


function addItemInvoiceInTable(invItems) {


    invItems.forEach(item =>{
        const product =
            products.find(
                product =>
                    product.id === item.item_id
            )
        ;

        const unitId = product.units.find(unit => unit.name === item.unit).id;


        invoiceItems.push({

            id: item.item_id,

            name: item.name,

            cost_price: item.cost_price,

            unit_id: unitId,

            unit_name :item.unit,


            qty: item.quantity

        });









    });

    

    console.log(invoiceItems);
     renderInvoice();

}



function showConfirmSupplierOrderDialog(finalOrder) {
    const select = document.getElementById("supplierSelect");
    const supplierName = select.options[select.selectedIndex].textContent;


    const itemsHtml = finalOrder.items.map(item => `
        <tr>
            <td class="text-center">${item.name}</td>
            <td class="text-center">${item.unit_name}</td>
            <td class="text-center">${item.qty}</td>
            <td class="text-center"> ${item.cost_price} ₪</td>
            <td class="text-center fw-bold">
                 ${(item.qty * item.cost_price)} ₪
            </td>
        </tr>
    `).join('');


    bootbox.dialog({

        title: '<i class="fas fa-truck me-2"></i> تأكيد طلبية المورد',

        message: `
            <div class="container-fluid">

                <!-- معلومات المورد -->
                <div class="card mb-3 border-primary">
                    <div class="card-body">

                        <div class="row align-items-center">

                            <div class="col-4 text-muted">
                                <i class="fas fa-store me-1"></i>
                                المورد
                            </div>

                            <div class="col-8 fw-bold text-primary text-end">
                                ${supplierName}
                            </div>

                        </div>

                    </div>
                </div>


                <!-- رسالة التأكيد -->
                <div class="text-center mb-4">

                    <i class="fas fa-circle-question text-warning fs-1 mb-3"></i>

                    <p class="mb-0 fw-bold">
                        هل أنت متأكد من تأكيد هذه الطلبية؟
                    </p>

                </div>


                <hr>


                <!-- جدول الأصناف -->
                <div style="max-height:250px; overflow:auto;">

                    <table class="table table-sm table-bordered text-center align-middle">

                        <thead class="table-light">

                            <tr>
                                <th>الصنف</th>
                                <th>الوحدة</th>
                                <th>الكمية</th>
                                <th>سعر الوحدة</th>
                                <th>الإجمالي</th>
                            </tr>

                        </thead>

                        <tbody>
                            ${itemsHtml}
                        </tbody>

                    </table>

                </div>


                <hr>


                <!-- الحسابات -->
                <div class="row mb-2">

                    <div class="col-6 fw-bold">
                        الإجمالي قبل الخصم
                    </div>

                    <div class="col-6 text-end fw-bold">
                         ${finalOrder.total_price} ₪
                    </div>

                </div>


                <div class="row mb-2">

                    <div class="col-6 fw-bold text-danger">
                        الخصم
                    </div>

                    <div class="col-6 text-end fw-bold text-danger">
                        - ${finalOrder.discount} ₪
                    </div>

                </div>


                <hr>


                <div class="row">

                    <div class="col-6 fw-bold text-success fs-5">
                        الإجمالي النهائي
                    </div>

                    <div class="col-6 text-end text-success fw-bold fs-5">
                         ${finalOrder.total_price - finalOrder.discount} ₪
                    </div>

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
                label: '<i class="fas fa-check me-1"></i> تأكيد الطلبية',
                className: "btn-success fw-bold",

                callback: async function () {

                    await createInvoice(finalOrder);

                    return false;
                }
            }

        }

    });

}