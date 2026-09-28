import { setActiveNavLink, showAuthExpired, bootboxSuccess, bootboxError, hidePrintLoader, showPrintLoader } from "../../../component/bootbox.js";
import { url } from "../../../api/urlEndPoint.js";

import { getAuthToken, removeAuthToken } from "../../../component/auth.js";


let suppliers = [];
let currentInvoice;
let supplierId = 0;
let supplierName = 'supplierName';

const header = document.querySelector("site-header");

const addRowBtn =
    document.getElementById("addRowBtn");

const itemsTableBody =
    document.getElementById("itemsTableBody");

const subtotalElement =
    document.getElementById("subtotal");

const discountInput =
    document.getElementById("discount");

const finalTotalElement =
    document.getElementById("finalTotal");

const confirmBtn =
    document.getElementById("confirmBtn");

const supplierItemsContainer =
    document.getElementById("supplierItemsContainer");

const successModelOrder =
    document.getElementById('successModal');



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
        loadSupplierInfo(),
        loadItemsForSupplier()
    ]);
});






document.addEventListener("click", async function (e) {
    if (e.target.closest('.close-success-modal')) {
        closeSuccessModal();
    }
    else if (e.target.closest('.back-btn')) {
        window.location.href = `./account.html?supplier_id=${supplierId}`;
    }
});




addRowBtn.addEventListener("click", () => {

    const row = createItemRow();

    // التركيز مباشرة على اسم الصنف
    row.querySelector(".item-name").focus();

});


discountInput.addEventListener("input", () => {

    calculateInvoiceTotal();

});


confirmBtn.addEventListener("click", () => {



    const rows =
        itemsTableBody.querySelectorAll("tr");


    if (rows.length === 0) {

        bootboxError("يرجى إضافة صنف واحد على الأقل.");

        return;

    }


    const items = [];


    for (const row of rows) {

        const name =
            row.querySelector(".item-name").value.trim();

        const qty =
            Number(
                row.querySelector(".item-qty").value
            ) || 0;

        const costPrice =
            Number(
                row.querySelector(".item-price").value
            ) || 0;

        const unit = row.querySelector(".item-unit").value;

        // التحقق من البيانات
        if (!name) {

            bootboxError("يرجى إدخال اسم الصنف.");

            row.querySelector(".item-name").focus();

            return;

        }
        if (!unit) {

            bootboxError("يرجى إدخال الوحدة للصنف.");

            row.querySelector(".item-unit").focus();

            return;

        }


        if (qty <= 0) {

            bootboxError(
                `الكمية للصنف "${name}" يجب أن تكون أكبر من صفر.`
            );

            row.querySelector(".item-qty").focus();

            return;

        }


        if (costPrice <= 0) {

            bootboxError(
                `سعر الشراء للصنف "${name}" غير صحيح.`
            );

            row.querySelector(".item-price").focus();

            return;

        }


        items.push({

            name: name,

            cost_price: costPrice,

            qty: qty,

            unit: unit

        });

    }


    // حساب المجموع قبل الخصم
    let totalPrice = 0;

    items.forEach(item => {

        totalPrice +=
            item.cost_price * item.qty;

    });


    const discount =
        Number(discountInput.value) || 0;

    if (discount < 0) {
        bootboxError('خطأ : قيمة الخصم لا يمكن أن تكون بالسالب');
        return;
    }

    if (discount > totalPrice) {
        bootboxError('خطأ : قيمة الخصم أكبر من السعر الإجمالي');
        return;
    }


    // الداتا النهائية التي سترسل للسيرفر
    const invoiceData = {
        supplier_name: supplierName,

        supplier_id: supplierId,

        total_price: totalPrice,

        discount: Number(discount),

        items: items

    };

    showConfirmSupplierOrderDialog(invoiceData);

});



async function createInvoice(invoiceData) {
    console.log(invoiceData);

    const invoiceDateTime = document.getElementById('invoiceDateTime').value;
    const useCurrentDateTime = document.getElementById('useCurrentDateTime').checked;

    invoiceData.invoice_date_time = invoiceDateTime;
    invoiceData.use_current_date_time = useCurrentDateTime;

    try {
        displayLoader();

        let res = await fetch(url + `/invoice/add?supplier_id=${invoiceData.supplier_id}`, {
            method: "POST",
            body: JSON.stringify(invoiceData),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });

        let data = await res.json();
        if (res.status === 200) {
            reSetTheValues();
            loadItemsForSupplier();
            currentInvoice = invoiceData
            showSuccessModal();
            return;
        }

        else if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }

        else {
            bootboxError(data.message);
            return;
        }
    } catch (err) {
        bootboxError(err.message);
        return;
    } finally {
        hiddeLoader();
    }
}

async function loadItemsForSupplier() {
    showLoaderItems();
    const id = getSupplierId();
    try {

        let res = await fetch(url + `/supplier/items?supplier_id=${id}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });

        let data = await res.json();

        if (res.status === 200) {
            renderSupplierItems(data.supplier_items);
        }

        else if (res.status === 401) {
            showAuthExpired(data.message);
        }

        else {
            bootboxError(data.message);
        }
    } catch (err) {
        bootboxError(err.message);
    }
}


async function loadSupplierInfo() {
    const id = getSupplierId();
    try {
        const res = await fetch(url + `/supplier/get?supplier_id=${id}`, {
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
            supplierId = data.supplier.id;
            supplierName = data.supplier.name;
            document.getElementById('supplierName').textContent = supplierName;
            setSupplierInfo(data.supplier);
        }
        else {
            bootboxError(data.message);
        }

    } catch (e) {
        bootboxError(e.message);
    }
}






function createItemRow(itemName = '') {

    const tr = document.createElement("tr");

    tr.innerHTML = `

                <td>

                    <input
                        type="text"
                        class="form-control item-name"
                        placeholder="اسم الصنف"
                        value = '${itemName}'
                    >

                </td>

                <td>

                    <select class="form-select item-unit">
                        <option value="" selected disabled>
                            اختر الوحدة
                        </option>

                            <option value="حبة">حبة</option>
                            <option value="كيلو">كيلو</option>
                            <option value="غرام">غرام</option>
                            <option value="مل">مل</option>
                            <option value="لتر">لتر</option>
                            <option value="عبوة">عبوة</option>
                            <option value="كرتونة">كرتونة</option>
                            <option value="صندوق">صندوق</option>
                            <option value="كيس">كيس</option>
                            <option value="باكيت">باكيت</option>
                            <option value="رول">رول</option>
                            <option value="دزينة">دزينة</option>
                            <option value="علبة">علبة</option>
                            <option value="كوب">كوب</option>
                            <option value="زجاجة">زجاجة</option>

                        <option value="new">➕ إضافة وحدة جديدة</option>
                    </select>

                    <input
                        type="text"
                        class="form-control new-unit mt-2 d-none"
                        placeholder="اكتب الوحدة الجديدة"
                    >


                </td>


                <td>

                    <input
                        type="number"
                        class="form-control item-qty text-center"
                        placeholder="0"
                        min="0"
                        step="1"
                    >

                </td>


                <td>

                    <div class="input-group">

                        <input
                            type="number"
                            class="form-control item-price text-center"
                            placeholder="0.00"
                            min="0"
                            step="0.5"
                        >

                        <span class="input-group-text">
                            ₪
                        </span>

                    </div>

                </td>


                <td class="text-center">

                    <span class="item-total">
                        0.00 ₪
                    </span>

                </td>


                <td class="text-center">

                    <button
                        type="button"
                        class="btn btn-outline-danger btn-sm delete-row"
                        title="حذف الصنف"
                    >

                        <i class="fa-solid fa-trash"></i>

                    </button>

                </td>

            `;


    // عناصر الصف
    const qtyInput =
        tr.querySelector(".item-qty");

    const priceInput =
        tr.querySelector(".item-price");

    const deleteBtn =
        tr.querySelector(".delete-row");


    // حساب الإجمالي عند تغيير الكمية
    qtyInput.addEventListener("input", () => {

        calculateRowTotal(tr);
        calculateInvoiceTotal();

    });


    // حساب الإجمالي عند تغيير السعر
    priceInput.addEventListener("input", () => {

        calculateRowTotal(tr);
        calculateInvoiceTotal();

    });


    // حذف الصف
    deleteBtn.addEventListener("click", () => {

        tr.remove();

        calculateInvoiceTotal();

        updateEmptyMessage();

    });


    itemsTableBody.appendChild(tr);


    const unitSelect = tr.querySelector(".item-unit");
    const newUnitInput = tr.querySelector(".new-unit");

    unitSelect.addEventListener("change", function () {

        if (this.value === "new") {

            newUnitInput.classList.remove("d-none");
            newUnitInput.focus();

        } else {

            newUnitInput.classList.add("d-none");
            newUnitInput.value = "";
        }

    });

    newUnitInput.addEventListener("keydown", function (e) {

        if (e.key !== "Enter") return;

        e.preventDefault();

        const newUnit = this.value.trim();

        if (!newUnit) return;

        // إضافة الوحدة للـ select
        const option = document.createElement("option");

        option.value = newUnit;
        option.textContent = newUnit;

        // نضيفها قبل خيار "إضافة وحدة جديدة"
        unitSelect.insertBefore(
            option,
            unitSelect.querySelector('option[value="new"]')
        );

        // اختيار الوحدة الجديدة
        unitSelect.value = newUnit;

        // إخفاء input
        this.value = "";
        this.classList.add("d-none");
    });





    const nameInput = tr.querySelector(".item-name");

    const inputs = [
        nameInput,
        unitSelect,
        qtyInput,
        priceInput
    ];

    inputs.forEach((input, index) => {

        input.addEventListener("keydown", function (e) {

            if (e.key !== "Enter") return;

            e.preventDefault();

            // إذا كان الحقل الحالي هو سعر الشراء
            if (input === priceInput) {

                const newRow = createItemRow();

                newRow.querySelector(".item-name").focus();

                return;
            }

            // الانتقال للحقل التالي
            const nextInput = inputs[index + 1];

            if (nextInput) {
                nextInput.focus();
            }

        });

    });

    updateEmptyMessage();

    return tr;
}

function calculateRowTotal(row) {

    const qty =
        Number(
            row.querySelector(".item-qty").value
        ) || 0;

    const price =
        Number(
            row.querySelector(".item-price").value
        ) || 0;

    const total = qty * price;

    row.querySelector(".item-total").textContent =
        total.toFixed(2) + " ₪";

}

function calculateInvoiceTotal() {

    let subtotal = 0;

    const rows =
        itemsTableBody.querySelectorAll("tr");


    rows.forEach(row => {

        const qty =
            Number(
                row.querySelector(".item-qty").value
            ) || 0;

        const price =
            Number(
                row.querySelector(".item-price").value
            ) || 0;

        subtotal += qty * price;

    });


    const discount =
        Number(discountInput.value) || 0;


    // منع الإجمالي من أن يصبح سالب
    const finalTotal =
        Math.max(subtotal - discount, 0);


    subtotalElement.textContent =
        subtotal.toFixed(2);


    finalTotalElement.textContent =
        finalTotal.toFixed(2);

}

function updateEmptyMessage() {

    const rows =
        itemsTableBody.querySelectorAll("tr");

    const emptyMessage =
        document.getElementById("emptyMessage");


    if (rows.length === 0) {

        emptyMessage.style.display = "block";

    } else {

        emptyMessage.style.display = "none";

    }

}









function showConfirmSupplierOrderDialog(finalOrder) {
    const supplierName = suppliers.find(
        supplier => supplier.id === Number(finalOrder.supplier_id)
    )?.name;
    const itemsHtml = finalOrder.items.map(item => `
        <tr>
            <td class="text-center">${item.name}</td>
            <td class="text-center">${item.unit}</td>
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


function displayLoader() {
    const loader = document.getElementById('overlay_loader');
    loader.style.display = 'flex';
}
function hiddeLoader() {
    const loader = document.getElementById('overlay_loader');
    loader.style.display = 'none';
}

function reSetTheValues() {
    finalTotalElement.textContent = 0.0;
    discountInput.value = 0;
    subtotalElement.textContent = 0.0;
    itemsTableBody.innerHTML = '';
    updateEmptyMessage();
}





function renderSupplierItems(items) {


    if (items.length === 0) {
        supplierItemsContainer.innerHTML = `
            <div class="d-flex justify-content-center align-items-center flex-column mx-auto">
                <span class = 'text-secondary fw-bold'>لم يتم شراء أي صنف بعد</span>
            </div> 
        `;
        return;
    }

    supplierItemsContainer.innerHTML = items.map(item => `
        <button
            type="button"
            class="supplier-item-btn"
            data-name="${item.name}"
            data-supplier-id="${item.supplier_id}"
        >
            ${item.name}
        </button>
    `).join('');
}

function showLoaderItems() {
    supplierItemsContainer.innerHTML = `
        <div class="d-flex justify-content-center align-items-center flex-column mx-auto py-3">
            <div class="spinner-border text-primary" role="status">
            </div>
            <span class='mt-1'>جاري التحميل...</span>
        </div> 
    `;
}




supplierItemsContainer.addEventListener("click", function (e) {

    const button = e.target.closest(".supplier-item-btn");

    if (!button) return;

    const itemName = button.dataset.name;

    const existingRow = [...itemsTableBody.querySelectorAll("tr")]
        .find(row => {
            const nameCell = row.querySelector(".item-name");
            return nameCell?.value.trim() === itemName;
        });

    if (existingRow) {

        const qtyInput = existingRow.querySelector(".item-qty");

        qtyInput.value = Number(qtyInput.value) + 1;

        // تحديث الإجمالي
        calculateRowTotal(existingRow);


    }
    else {
        createItemRow(itemName);

    }

    calculateInvoiceTotal();
});


function showSuccessModal() {
    const modal = new bootstrap.Modal(successModelOrder);
    modal.show();
}

function closeSuccessModal() {
    bootstrap.Modal.getInstance(successModelOrder).hide();
}


function setSupplierInfo(supplier) {
    document.getElementById('customerName').textContent = `${supplier.name}`;
    document.getElementById('supplierPhone').textContent = `${supplier?.phone || '1024#'}`;
    document.getElementById('avatar').textContent = `${supplier.name.split(' ')[0]}`;
}

function getSupplierId() {
    const params = new URLSearchParams(window.location.search);
    const supplierId = params.get("supplier_id");

    return supplierId;
}



const invoiceDateTime = document.getElementById('invoiceDateTime');
const useCurrentDateTime = document.getElementById('useCurrentDateTime');
const currentDateTimeMessage = document.getElementById('currentDateTimeMessage');

useCurrentDateTime.addEventListener('change', function () {

    if (this.checked) {

        invoiceDateTime.disabled = true;
        invoiceDateTime.value = '';

        currentDateTimeMessage.classList.remove('d-none');

    } else {

        invoiceDateTime.disabled = false;

        currentDateTimeMessage.classList.add('d-none');
    }

});