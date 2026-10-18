
import { fetchCategories } from "../../../api/category.js";
import { url } from "../../../api/urlEndPoint.js";
import {showAuthExpired, bootboxSuccess, bootboxError, setActiveNavLink} from "../../../component/bootbox.js";

import { getAuthToken, removeAuthToken} from "../../../component/auth.js";

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
    loader.style.display = "flex";
    try{
        await buildSelectCategory();
        await loadItem();
    }catch(e){
        console.log(e);
    }finally{
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

function updateContainsUnitOptions() {
    const select = document.getElementById("newUnitContains");
    const currentValue = select.value;

    select.innerHTML = `
        <option value="">
            اختر الوحدة
        </option>
    `;

    // const baseUnitName = getBaseUnitName();

    // if (baseUnitName) {
    //     select.insertAdjacentHTML(
    //         "beforeend",
    //         `
    //             <option value="base">
    //                 ${escapeHtml(baseUnitName)}
    //             </option>
    //         `
    //     );
    // }

    units.forEach(unit => {
        select.insertAdjacentHTML(
            "beforeend",
            `
                <option value="${unit.id}">
                    ${escapeHtml(unit.unit_name)}
                </option>
            `
        );
    });

    if (
        [...select.options].some(
            option => option.value === currentValue
        )
    ) {
        select.value = currentValue;
    }
}

function getParentConversionFactor(parentId) {
    if (parentId === "base") {
        return 1;
    }

    const parentUnit = units.find(
        unit => String(unit.id) === String(parentId)
    );

    if (!parentUnit) {
        return null;
    }

    return parentUnit.conversion_factor;
}


/* =========================
   إضافة وحدة
========================= */

function addUnit() {
    const unitName = document
        .getElementById("newUnitName")
        .value
        .trim();

    const quantity = normalizeNumber(
        document.getElementById("newUnitQuantity").value
    );

    const containsUnit = document.getElementById("newUnitContains").value;

    const barcode = unitBarcodeInput.value.trim();

    const sellingPrice = normalizeNumber(
        document.getElementById("newUnitPrice").value
    );

    const forSale = document.getElementById("newUnitForSale").checked;
    const forPurchase = document.getElementById("newUnitForPurchase").checked;


    // التحقق من البيانات

    if (!unitName) {
        bootboxError("يرجى إدخال اسم الوحدة.");

        document.getElementById("newUnitName").focus();

        return;
    }

    if (quantity <= 0) {
        bootboxError("يرجى إدخال كمية صحيحة.");

        document.getElementById("newUnitQuantity").focus();

        return;
    }

    if (!containsUnit) {
        bootboxError("يرجى اختيار الوحدة التي تحتوي عليها هذه الوحدة.");

        document.getElementById("newUnitContains").focus();

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

    const parentConversion = getParentConversionFactor(containsUnit);

    if (parentConversion === null) {
        bootboxError("تعذر حساب تحويل الوحدة.");

        return;
    }

    const conversionFactor = quantity * parentConversion;

    let containsUnitName = baseUnitName;

    if (containsUnit !== "base") {
        const parentUnit = units.find(
            unit => String(unit.id) === String(containsUnit)
        );

        if (parentUnit) {
            containsUnitName = parentUnit.unit_name;
        }
    }

    const newUnit = {
        id: crypto.randomUUID(),

        unit_name: unitName,

        contains_quantity: quantity,

        contains_unit_id: containsUnit,

        contains_unit_name: containsUnitName,

        conversion_factor: conversionFactor,

        barcode: barcode || null,

        auto_generated_barcode: autoUnitBarcodeCheckbox.checked,

        selling_price: sellingPrice,

        for_sale: forSale,

        for_purchase: forPurchase
    };

    units.push(newUnit);

    renderUnits();
    updateContainsUnitOptions();

    // تفريغ الحقول

    document.getElementById("newUnitName").value = "";
    document.getElementById("newUnitQuantity").value = "";
    document.getElementById("newUnitContains").value = "";

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

    // const baseUnitName = getBaseUnitName();

    // if (!baseUnitName) {
    //     tbody.innerHTML = `
    //         <tr>
    //             <td colspan="7">
    //                 <div class="empty-state">
    //                     <i class="fa-solid fa-box-open d-block"></i>
    //                     أدخل الوحدة الأساسية أولاً.
    //                 </div>
    //             </td>
    //         </tr>
    //     `;

    //     return;
    // }

    let html = "";

    const baseBarcode = '';


    const baseForSale = 0
    const baseForPurchase = 0

    html += `
        <tr>
            <td class="unit-name-cell">
                <span class="unit-badge base-badge">
                    <i class="fa-solid fa-star"></i>
                    ${escapeHtml('g')}
                </span>
            </td>

            <td>
                <span class="text-muted">
                    الوحدة الأساسية
                </span>
            </td>

            <td>
                <strong>1</strong>
                ${escapeHtml('s')}
            </td>

            <td>
                ${
                    baseBarcode
                }
            </td>

            <td>
            ${baseForSale}
            </td>

            <td>
                ${baseForPurchase}
            </td>

            <td>
                <span class="text-muted">—</span>
            </td>
        </tr>
    `;

    units.forEach((unit, index) => {
        html += `
            <tr>
                <td class="unit-name-cell">
                    <span class="unit-badge">
                        <i class="fa-solid fa-box"></i>
                        ${escapeHtml(unit.unit_name)}
                    </span>
                </td>

                <td>
                    <strong>
                        ${formatNumber(unit.contains_quantity)}
                    </strong>
                    ${escapeHtml(unit.contains_unit_name)}
                </td>

                <td>
                    <strong>
                        ${formatNumber(unit.conversion_factor)}
                    </strong>
                    ${escapeHtml(baseUnitName)}
                </td>

                <td>
                    ${
                        unit.auto_generated_barcode
                            ? '<span class="text-muted">سيتم توليده تلقائياً</span>'
                            : unit.barcode
                                ? escapeHtml(unit.barcode)
                                : '<span class="text-muted">—</span>'
                    }
                </td>

                <td>
                    ${formatPrice(unit.selling_price)}
                </td>

                <td>
                    ${renderUsage(unit.for_purchase, unit.for_sale)}
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

function renderUsage(forPurchase, forSale) {
    const values = [];

    if (forPurchase) {
        values.push(
            '<span class="badge text-bg-primary">شراء</span>'
        );
    }

    if (forSale) {
        values.push(
            '<span class="badge text-bg-success">بيع</span>'
        );
    }

    if (!values.length) {
        return `
            <span class="badge text-bg-secondary">
                بدون استخدام
            </span>
        `;
    }

    return values.join(" ");
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
                updateContainsUnitOptions();
            }
        }
    });
}


/* =========================
   إعادة تعيين النموذج
========================= */

function resetForm() {
    bootbox.confirm({
        message: "هل تريد إعادة تعيين جميع البيانات؟",

        buttons: {
            confirm: {
                label: "إعادة تعيين",
                className: "btn-danger"
            },

            cancel: {
                label: "إلغاء",
                className: "btn-secondary"
            }
        },

        callback: function (confirmed) {
            if (!confirmed) {
                return;
            }

            resetAllInputs();
        }
    });
}

function resetAllInputs() {
    document.getElementById("productForm").reset();

    units = [];

    renderUnits();
    updateContainsUnitOptions();

    updateUnitBarcodeState();
}


/* =========================
   حفظ المنتج
========================= */

async function submitProduct() {
    const productName = document
        .getElementById("productName")
        .value
        .trim();

    const categoryId = document
        .getElementById("productCategory")
        .value;

    const baseUnitName = document
        .getElementById("baseUnitName")
        .value
        .trim();

    const baseBarcode = baseUnitBarcodeInput.value.trim();

    const baseSellingPrice = normalizeNumber(
        document.getElementById("baseSellingPrice").value
    );

    const baseForSale = document.getElementById("baseForSale").checked;
    const baseForPurchase = document.getElementById("baseForPurchase").checked;


    // التحقق من البيانات

    if (!productName) {
        bootboxError("يرجى إدخال اسم المنتج.");

        return;
    }

    if (!categoryId) {
        bootboxError("يرجى اختيار التصنيف.");

        return;
    }

    if (!baseUnitName) {
        bootboxError("يرجى إدخال الوحدة الأساسية.");

        return;
    }


    // تجهيز بيانات المنتج والوحدات فقط

    const data = {
        product: {
            name: productName,
            category_id: Number(categoryId)
        },

        units: [
            {
                id: "base",

                unit_name: baseUnitName,

                contains_quantity: null,

                contains_unit_id: null,

                contains_unit_name: null,

                conversion_factor: 1,

                barcode: baseBarcode || null,

                auto_generated_barcode: autoBarcodeCheckbox.checked,

                selling_price: baseSellingPrice,

                for_sale: baseForSale,

                for_purchase: baseForPurchase,

                is_base_unit: true
            },

            ...units.map(unit => ({
                ...unit,
                is_base_unit: false
            }))
        ]
    };

    await submitProductData(data);
}


/* =========================
   التنسيق
========================= */

function formatNumber(value) {
    return Number(value).toLocaleString("en-US", {
        maximumFractionDigits: 4
    });
}

function formatPrice(value) {
    return `
        <strong>
            ${Number(value).toFixed(2)}
        </strong>

        <span class="text-muted">
            ₪
        </span>
    `;
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

    const resetButton = e.target.closest("#resetBtn");

    if (resetButton) {
        resetForm();

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
   التهيئة الأولية
========================= */

updateContainsUnitOptions();
renderUnits();


/* =========================
   إرسال البيانات للسيرفر
========================= */

async function submitProductData(finalData) {
    console.log("Submitting product data:", finalData);

    loader.style.display = "flex";

    try {
        const res = await fetch(url + "/item/add", {
            method: "POST",

            body: JSON.stringify(finalData),

            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken("auth")}`
            }
        });

        const data = await res.json();

        if (res.status === 200) {
            bootboxSuccess(data.message);

            resetAllInputs();
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

        else if(res.status === 200){
            console.log(data);

            setItemData(data.item);
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

    // const baseUnitName = document
    //     .getElementById("baseUnitName")
    //     .value
    //     .trim();

    // const baseBarcode = baseUnitBarcodeInput.value.trim();

    // const baseSellingPrice = normalizeNumber(
    //     document.getElementById("baseSellingPrice").value
    // );

   


}
