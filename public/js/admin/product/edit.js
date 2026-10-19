
import { fetchCategories } from "../../../api/category.js";
import { url } from "../../../api/urlEndPoint.js";
import { showAuthExpired, bootboxSuccess, bootboxError, setActiveNavLink } from "../../../component/bootbox.js";

import { getAuthToken, removeAuthToken } from "../../../component/auth.js";

const header = document.querySelector("site-header");


const unitBarcodeInput = document.getElementById("newUnitBarcode");
const autoUnitBarcodeCheckbox = document.getElementById("auto_barcode_unit");

const loader = document.getElementById("overlay_loader");

let units = [];

const params = new URLSearchParams(window.location.search);
const itemId = params.get("item_id");
/* =========================
   Header
========================= */

class SiteHeader extends HTMLElement {
    async connectedCallback() {
        const res = await fetch("../component/header.html");
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

    const logoutForm = document.getElementById("logoutForm");

    logoutForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        bootbox.confirm({
            title: "تسجيل الخروج",
            message: "هل أنت متأكد من تسجيل الخروج؟",
            buttons: {
                confirm: {
                    label: "نعم"
                },
                cancel: {
                    label: "إلغاء"
                }
            },
            callback: function (result) {
                if (!result) return;

                removeAuthToken();
                window.location.href = "../../mainWindow.html";
            }
        });
    });
});


/* =========================
   تحميل التصنيفات
========================= */

document.addEventListener("DOMContentLoaded", async function () {
    try {
        await buildSelectCategory();
        await loadItem();
    } catch (e) {
        console.log(e);
    } finally {
        loader.style.display = "none";
    }

});

async function buildSelectCategory() {
    const select = document.getElementById("productCategory");

    try {
        const categories = await fetchCategories();

        document.getElementById("loadingCategory")?.remove();

        if (categories.length > 0) {
            categories.forEach(category => {
                const option = document.createElement("option");

                option.value = category.id;
                option.textContent = category.name;

                select.appendChild(option);
            });
        }
    } catch (err) {
        console.error("Error fetching categories:", err);
    }
}


/* =========================
   الباركود
========================= */


autoUnitBarcodeCheckbox.addEventListener("change", updateUnitBarcodeState);

function updateUnitBarcodeState() {
    if (autoUnitBarcodeCheckbox.checked) {
        unitBarcodeInput.value = "";
        unitBarcodeInput.disabled = true;
        unitBarcodeInput.placeholder = "سيتم توليد باركود تلقائياً";
        unitBarcodeInput.style.cursor = "not-allowed";
    } else {
        unitBarcodeInput.disabled = false;
        unitBarcodeInput.placeholder = "الباركود";
        unitBarcodeInput.style.cursor = "text";
    }
}


/* =========================
   الوحدات
========================= */



function normalizeNumber(value) {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
}





/* =========================
   إضافة وحدة
========================= */

function addUnit() {
    const unitName = document.getElementById("newUnitName").value.trim();

    const conversionFactor = normalizeNumber(document.getElementById("newUnitQuantity").value);


    const barcode = unitBarcodeInput.value.trim();

    const sellingPrice = normalizeNumber(document.getElementById("newUnitPrice").value);

    const forSale = document.getElementById("newUnitForSale").checked;
    const forPurchase = document.getElementById("newUnitForPurchase").checked;


    // التحقق من البيانات

    if (!unitName) {
        bootboxError("يرجى إدخال اسم الوحدة.");

        document.getElementById("newUnitName").focus();

        return;
    }

    if (conversionFactor <= 0) {
        bootboxError("يرجى إدخال كمية صحيحة.");

        document.getElementById("newUnitQuantity").focus();

        return;
    }



    if (!forSale && !forPurchase) {
        bootboxError(
            'يجب تفعيل خيار "يُمكن البيع بهذه الوحدة" أو "يُمكن الشراء بهذه الوحدة" على الأقل'
        );

        return;
    }

    if (forSale && sellingPrice <= 0) {
        bootboxError(
            'يرجى إدخال سعر بيع صحيح أو تعطيل خيار "يُمكن البيع بهذه الوحدة"'
        );

        return;
    }

    if (forPurchase && !forSale && sellingPrice != 0) {
        bootboxError(
            'لا يمكن إدخال سعر بيع لوحدة مخصصة للشراء فقط'
        );

        return;
    }


    const duplicated = units.some(
        unit => unit.unit_name.toLowerCase() === unitName.toLowerCase()
    );

    if (duplicated) {
        bootboxError("هذه الوحدة مضافة مسبقًا.");

        return;
    }






    const newUnit = {
        id: crypto.randomUUID(),

        unit_name: unitName,

        conversion_factor: conversionFactor,

        barcode: barcode || null,

        auto_generated_barcode: autoUnitBarcodeCheckbox.checked,

        selling_price: sellingPrice,

        for_sale: forSale,

        for_purchase: forPurchase
    };

    units.push(newUnit);

    renderUnits();

    // تفريغ الحقول

    document.getElementById("newUnitName").value = "";
    document.getElementById("newUnitQuantity").value = "";

    unitBarcodeInput.value = "";
    autoUnitBarcodeCheckbox.checked = false;

    updateUnitBarcodeState();

    document.getElementById("newUnitPrice").value = "";

    document.getElementById("newUnitForSale").checked = true;
    document.getElementById("newUnitForPurchase").checked = false;

    document.getElementById("newUnitName").focus();
}


/* =========================
   عرض الوحدات
========================= */

function renderUnits() {
    const tbody = document.getElementById("unitsTableBody");

    let html = "";

    html += `
        <tr>
            <td class="unit-name-cell">
                <span class="unit-badge base-badge">
                    <i class="fa-solid fa-star"></i>
                    ${escapeHtml(units[0].unit_name)}
                </span>
                <span class="text-muted mt-2">—</span>
                <small class='text-muted' style="font-size: 14px;"> الوحدة الأساسية</small>
            </td>

            <td>
                <strong>
                    ${units[0].conversion_factor}
                </strong>

                ${escapeHtml(units[0].unit_name)}
            </td>


            <td style="width: 18%;">
                <input type="text" class="form-control unit-barcode"
                data-unit-id="${units[0].id}"
                value="${units[0].barcode || ''}"
                placeholder="لا يوجد">
            </td>


            <td style="width: 12%;">
                <div class="input-group input-group-sm">
                    <input
                        type="number"
                        class="form-control selling-price"
                        data-unit-id="${units[0].id}"
                        value="${units[0].selling_price}"
                        min="0.5"
                        step="any"
                    >
                    <span class="input-group-text">
                        ₪
                    </span>
                </div>
            </td>

            <td>
                ${renderUsage(units[0].for_purchase, units[0].for_sale, units[0].id, true)}
            </td>

            <td>
                <span class="text-muted">—</span>
            </td>
        </tr>
    `;

    units.forEach((unit, index) => {
        if (index === 0) return;
        html += `
            <tr>
                <td class="unit-name-cell">
                    <input type="text" class="form-control unit-name" 
                      placeholder="مثال: باكيت"
                      data-unit-id="${unit.id}"
                     value="${unit.unit_name}">
                </td>

                
                <td style="width: 20%;">
                    <div class="input-group input-group-sm">
                        <input
                            type="number"
                            class="form-control conversion-factor"
                            data-unit-id="${unit.id}"
                            value="${unit.conversion_factor}"
                            min="0.1"
                            step="any"
                        >
                        <span class="input-group-text">
                            ${escapeHtml(units[0].unit_name)}
                        </span>
                    </div>
                </td>

                <td style="width: 18%;">
                    ${unit.auto_generated_barcode
                ? `
                            <span class="text-muted">سيتم توليده تلقائياً</span>
                        `

                : `
                            <input type="text" class="form-control unit-barcode" 
                            data-unit-id="${unit.id}"
                            value="${unit.barcode || ''}"
                            placeholder="لا يوجد">
                        `
            }
                    
                </td>

                <td style="width: 12%;">
                    ${unit.for_sale
                ? `<div class="input-group input-group-sm">
                                    <input
                                        type="number"
                                        class="form-control selling-price"
                                        data-unit-id="${unit.id}"
                                        value="${unit.selling_price}"
                                        min="0.5"
                                        step="any"
                                    >
                                    <span class="input-group-text">
                                        ₪
                                    </span>
                                </div>
                            `
                : `<span class="text-muted mt-2">—</span>`
            }
                    
                </td>

                <td>
                    ${renderUsage(unit.for_purchase, unit.for_sale, unit.id)}
                </td>

                <td>
                    <button
                        type="button"
                        class="btn btn-sm btn-outline-danger delete-unit-btn"
                        data-index="${index}"
                        title="حذف"
                    >
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}


function renderUsage(forPurchase, forSale, id, isBaseUnit = false) {
    return `
        <div class="d-flex align-items-center gap-3">
            
            ${isBaseUnit
            ? '<span class="badge text-bg-success">بيع</span>'
            : `
                    <div class="form-check mb-0">
                        <input
                            type="checkbox"
                            id="sale-${id}"
                            data-unit-id="${id}"
                            class="form-check-input usage-check-sale pointer"
                            ${forSale ? "checked" : ""}
                        >
                        <label class="form-check-label pointer" for='sale-${id}'>بيع</label>
                    </div>
                `
        }

            <div class="form-check mb-0">
                <input
                    type="checkbox"
                    id="purchase-${id}"
                    data-unit-id="${id}"
                    class="form-check-input usage-check-purchase pointer"
                    ${forPurchase ? "checked" : ""}
                    
                >
                <label class="form-check-label pointer" for='purchase-${id}'>شراء</label>
            </div>
        </div>
    `;
}


/* =========================
   حذف وحدة
========================= */

function deleteUnit(index) {
    const unit = units[index];

    if (!unit) {
        return;
    }

    const isParent = units.some(
        child => String(child.contains_unit_id) === String(unit.id)
    );

    if (isParent) {
        bootboxError(
            `لا يمكن حذف "${unit.unit_name}" لأنها مستخدمة داخل وحدة أخرى.`
        );

        return;
    }

    bootbox.confirm({
        message: `هل تريد حذف وحدة "${unit.unit_name}"؟`,

        buttons: {
            confirm: {
                label: "حذف",
                className: "btn-danger"
            },

            cancel: {
                label: "إلغاء",
                className: "btn-secondary"
            }
        },

        callback: function (confirmed) {
            if (confirmed) {
                units.splice(index, 1);

                renderUnits();
            }
        }
    });
}


/* =========================
   إعادة تعيين النموذج
========================= */



function resetAllInputs() {
    document.getElementById("productForm").reset();

    units = [];

    renderUnits();

    updateUnitBarcodeState();
}


/* =========================
   حفظ المنتج
========================= */

async function submitProduct() {
    const productName = document.getElementById("productName").value.trim();

    const categoryId = document.getElementById("productCategory").value;

    const costPrice  = document.getElementById('stock-cost-price').value;
    // التحقق من البيانات

    if (!productName) {
        bootboxError("يرجى إدخال اسم المنتج.");

        return;
    }

    if (!categoryId) {
        bootboxError("يرجى اختيار التصنيف.");

        return;
    }

    if(Number(costPrice) <= 0){
        bootboxError("خطأ : سعر التكلفة للوحدة الأساسية يجب أن يكون أكبر من صفر");

        return;
    }

    for (const unit of units) {
        if (!unit.unit_name || unit.unit_name.trim() === "") {
            bootboxError("يرجى إدخال اسم الوحدة.");
            return;
        }

        if (unit.conversion_factor <= 0) {
            bootboxError("يرجى إدخال معامل تحويل صحيح أكبر من صفر للوحدة: " + unit.unit_name);
            return;
        }

        if (!unit.for_sale && !unit.for_purchase) {
            bootboxError(
                `يجب تفعيل خيار البيع أو الشراء على الأقل للوحدة: ${unit.unit_name}.`
            );
            return;
        }

        if (unit.for_sale && (!Number.isFinite(Number(unit.selling_price)) || Number(unit.selling_price) <= 0)) {
            bootboxError(
                `يرجى إدخال سعر بيع صحيح أكبر من صفر للوحدة: ${unit.unit_name}، أو تعطيل خيار البيع.`
            );
            return;
        }
    }



    // تجهيز بيانات المنتج والوحدات فقط

    const data = {
        product: {
            name: productName,
            category_id: Number(categoryId)
        },

        cost_price : costPrice,

        units: units
    };

    console.log(data);
    await submitProductData(data);
}


function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================
   أحداث الصفحة
========================= */

document.addEventListener("click", function (e) {
    const addButton = e.target.closest("#addUnitBtn");

    if (addButton) {
        addUnit();

        return;
    }

    const deleteButton = e.target.closest(".delete-unit-btn");

    if (deleteButton) {
        const index = Number(deleteButton.dataset.index);

        deleteUnit(index);

        return;
    }

});


document.getElementById("productForm").addEventListener(
    "submit",
    async function (e) {
        e.preventDefault();

        await submitProduct();
    }
);

/* =========================
   إرسال البيانات للسيرفر
========================= */

async function submitProductData(finalData) {
    console.log("Submitting product data:", finalData);

    loader.style.display = "flex";

    try {
        const res = await fetch(url + `/item/update?item_id=${itemId}`, {
            method: "PUT",

            body: JSON.stringify(finalData),

            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken("auth")}`
            }
        });

        const data = await res.json();

        if (res.status === 200) {
            bootboxSuccess(data.message);

        } else if (res.status === 401) {
            showAuthExpired(data.message);
        } else {
            bootboxError(data.message);
        }
    } catch (err) {
        bootboxError(err.message);
        return;
    } finally {
        loader.style.display = "none";
    }
}


async function loadItem() {
    if (!itemId) {
        bootboxError("لم يتم تحديد الصنف المطلوب تعديله.");
        return;
    }

    try {
        const res = await fetch(url + `/item/get?item_id=${itemId}`, {
            method: "GET",
            headers: {
                "Authorization": `${getAuthToken("auth")}`
            }
        });

        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }

        else if (res.status === 200) {
            console.log(data);

            setItemData(data.item);

            setUnits(data.item.units);

            renderStockAndCost(data.item.units, data.item.stockBatches);
        }   

        else {
            bootboxError(data.message);
        }

    } catch (error) {
        bootboxError(error.message);
    }
}



function setItemData(data) {
    document.getElementById("productName").value = data.item.name;
    document.getElementById("productCategory").value = data.item.category_id;
}


function setUnits(data) {

    data.forEach(unit => {
        const newUnit = {
            id: unit.id,

            unit_name: unit.unit_name,

            conversion_factor: unit.conversion_factor,

            barcode: unit.barcode || null,

            auto_generated_barcode: false,

            selling_price: unit.price,

            for_sale: unit.for_sale,

            for_purchase: unit.for_purchase
        };

        units.push(newUnit);
    });
    renderUnits();
}


document.addEventListener("input", (event) => {

    if (event.target.closest(".unit-barcode")) {
        const input = event.target.closest(".unit-barcode");
        const unitId = String(input.dataset.unitId);
        const barcode = input.value.trim();

        const unit = units.find(unit => String(unit.id) === unitId);
        if (!unit) return;

        unit.barcode = barcode || null;
    }

    else if (event.target.closest(".unit-name")) {
        const input = event.target.closest(".unit-name");
        const unitId = String(input.dataset.unitId);
        const name = input.value.trim();

        const unit = units.find(unit => String(unit.id) === unitId);
        if (!unit) return;

        unit.unit_name = name;
    }

    else if (event.target.closest(".conversion-factor")) {
        const input = event.target.closest(".conversion-factor");
        const unitId = String(input.dataset.unitId);
        const conversionFactor = input.value.trim();

        const unit = units.find(unit => String(unit.id) === unitId);
        if (!unit) return;

        unit.conversion_factor = conversionFactor;
    }

    else if (event.target.closest(".selling-price")) {
        const input = event.target.closest(".selling-price");
        const unitId = String(input.dataset.unitId);
        const price = input.value.trim();

        const unit = units.find(unit => String(unit.id) === unitId);
        if (!unit) return;

        unit.selling_price = price;
    }

    else if (event.target.closest(".usage-check-sale")) {
        const input = event.target.closest(".usage-check-sale");
        const unitId = String(input.dataset.unitId);

        const checked = input.checked;

        const unit = units.find(unit => String(unit.id) === unitId);
        if (!unit) return;

        unit.for_sale = checked;


        if (!checked) {
            unit.selling_price = 0;
        }

        renderUnits();
    }

    else if (event.target.closest(".usage-check-purchase")) {
        const input = event.target.closest(".usage-check-purchase");
        const unitId = String(input.dataset.unitId);

        const checked = input.checked;

        const unit = units.find(unit => String(unit.id) === unitId);
        if (!unit) return;

        unit.for_purchase = checked;
    }




});


function renderStockAndCost(units, stockBatch) {
    const container = document.getElementById("stock-cost-container");
    document.getElementById('baseUnitName').textContent = units[0].unit_name;
    if (!container) return;

    const totalQty = Number(stockBatch?.total_remaining_qty) || 0;
    const costPrice = Number(stockBatch?.cost_price) || 0;

    // ترتيب الوحدات من الأكبر إلى الأصغر
    const sortedUnits = [...units]
        .filter(unit => Number(unit.conversion_factor) > 0)
        .sort((a, b) =>
            Number(b.conversion_factor) -
            Number(a.conversion_factor)
        );

    // حساب الكمية المتوفرة من كل وحدة
    let remainingQty = totalQty;
    const stockUnits = [];

    for (const unit of sortedUnits) {
        const conversionFactor = Number(unit.conversion_factor);

        const quantity = Math.floor(
            (remainingQty + 1e-9) / conversionFactor
        );

        remainingQty -= quantity * conversionFactor;

        stockUnits.push({
            id: unit.id,
            unit_name: unit.unit_name,
            conversion_factor: conversionFactor,
            quantity
        });
    }

    container.innerHTML = `
        <!-- سعر التكلفة -->
        <div class="mb-4">
            <label for="stock-cost-price"
                   class="form-label fw-bold">
                <i class="fa-solid fa-coins text-primary ms-1"></i>
                سعر تكلفة الوحدة الأساسية
            </label>

            <div class="input-group cost-price-input">
                <input
                    type="number"
                    id="stock-cost-price"
                    class="form-control"
                    value="${costPrice}"
                    min="0"
                    step="any"
                >

                <span class="input-group-text">₪</span>
            </div>

            <div class="form-text">
                سعر التكلفة محسوب للوحدة الأساسية: ${
                    units[0]?.unit_name || "غير محددة"
                }.
            </div>
        </div>

        <hr class="my-4">

        <!-- ملخص المخزون -->
        <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="fw-bold">
                <i class="fa-solid fa-boxes-stacked text-primary ms-1"></i>
                المخزون الحالي
            </div>

            <span class="stock-total">
                ${totalQty.toLocaleString("en-US")} وحدة أساسية
            </span>
        </div>

        <!-- توزيع المخزون حسب الوحدات -->
        <div class="row g-3">
            ${stockUnits.map(unit => `
                <div class="col-6 col-md-4 col-lg-3">
                    <div class="stock-unit-card">
                        <div class="unit-name mb-2">
                            ${unit.unit_name}
                        </div>

                        <div class="unit-quantity">
                            ${unit.quantity.toLocaleString("en-US")}
                        </div>

                        <div class="unit-name mt-1">
                            ${
                                unit.conversion_factor === 1
                                    ? "الوحدة الأساسية"
                                    : `كل وحدة = ${unit.conversion_factor} ${
                                        units[0]?.unit_name || "وحدة أساسية"
                                    }`
                            }
                        </div>
                    </div>
                </div>
            `).join("")}
        </div>

        ${
            remainingQty > 1e-9
                ? `
                    <div class="alert alert-warning mt-3 mb-0">
                        الكمية المتبقية غير الموزعة:
                        ${remainingQty}
                        ${units[0]?.unit_name || "وحدة أساسية"}
                    </div>
                `
                : ""
        }
    `;
}