import { fetchCategories } from "../../../api/category.js";
import { url } from "../../../api/urlEndPoint.js";
import { showAuthExpired, bootboxSuccess, bootboxError } from "../../../component/bootbox.js";
import { setActiveNavLink } from "../../../component/bootbox.js";

import { getAuthToken, removeAuthToken } from "../../../component/auth.js";

const header = document.querySelector("site-header");

const autoBarcodeCheckbox = document.getElementById('auto_barcode');

let loader = document.getElementById("overlay_loader");


const baseUnitBarcodeInput = document.getElementById("baseBarcode");



const unitBarcodeInput = document.getElementById("newUnitBarcode");
const autoUnitBarcodeCheckbox = document.getElementById('auto_barcode_unit');



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
    await buildSelectCategory();
});


autoBarcodeCheckbox.addEventListener('change', function () {
    if (this.checked) {
        baseUnitBarcodeInput.value = '';
        baseUnitBarcodeInput.disabled = true;
        baseUnitBarcodeInput.placeholder = 'سيتم توليد باركود تلقائياً';
        baseUnitBarcodeInput.style.cursor = 'not-allowed';
    } else {
        baseUnitBarcodeInput.disabled = false;
        baseUnitBarcodeInput.placeholder = 'الباركود';
        baseUnitBarcodeInput.style.cursor = 'text';

    }
    renderUnits();
});

autoUnitBarcodeCheckbox.addEventListener('change', updateUnitBarcodeState);

function updateUnitBarcodeState() {
    if (autoUnitBarcodeCheckbox.checked) {
        unitBarcodeInput.value = '';
        unitBarcodeInput.disabled = true;
        unitBarcodeInput.placeholder = 'سيتم توليد باركود تلقائياً';
        unitBarcodeInput.style.cursor = 'not-allowed';
    } else {
        unitBarcodeInput.disabled = false;
        unitBarcodeInput.placeholder = 'الباركود';
        unitBarcodeInput.style.cursor = 'text';
    }
}


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



let units = [];


function getBaseUnitName() {

    return document
        .getElementById("baseUnitName")
        .value
        .trim();

}


function normalizeNumber(value) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;

}



function updateContainsUnitOptions() {

    const select =
        document.getElementById("newUnitContains");

    const currentValue =
        select.value;


    select.innerHTML = `
            <option value="">
                اختر الوحدة
            </option>
        `;


    const baseUnitName =
        getBaseUnitName();


    if (baseUnitName) {

        select.insertAdjacentHTML(
            "beforeend",
            `
                <option value="base">
                    ${escapeHtml(baseUnitName)}
                </option>
                `
        );

    }


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
            option =>
                option.value === currentValue
        )
    ) {

        select.value = currentValue;

    }

}




function updatePurchaseUnitOptions() {

    const select =
        document.getElementById("purchaseUnit");

    const currentValue =
        select.value;


    select.innerHTML = `
            <option value="">
                 اختر وِحدة قياس المخزون الحالي
            </option>
        `;


    /*
    | الوحدة الأساسية
    */

    const baseUnitName =
        getBaseUnitName();


    if (baseUnitName) {

        select.insertAdjacentHTML(
            "beforeend",
            `
                <option value="base">
                    ${escapeHtml(baseUnitName)}
                </option>
                `
        );

    }


    /*
    | الوحدات الأخرى
    */

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


    /*
    | الاحتفاظ بالاختيار السابق
    */

    if (
        [...select.options].some(
            option =>
                option.value === currentValue
        )
    ) {

        select.value = currentValue;

    }


    updateStockEquivalent();

}



function getParentConversionFactor(parentId) {

    if (parentId === "base") {

        return 1;

    }


    const parentUnit =
        units.find(
            unit =>
                String(unit.id) ===
                String(parentId)
        );


    if (!parentUnit) {

        return null;

    }


    return parentUnit.conversion_factor;

}



function getSelectedPurchaseUnit() {

    const selectedId = document.getElementById("purchaseUnit").value;


    if (!selectedId) {

        return null;

    }


    if (selectedId === "base") {

        return {

            id: "base",

            unit_name: getBaseUnitName(),

            conversion_factor: 1

        };

    }


    return units.find(
        unit =>
            String(unit.id) ===
            String(selectedId)
    ) || null;

}




function updateStockEquivalent() {

    const result =
        document.getElementById("stockResult");

    const equivalent =
        document.getElementById("stockEquivalent");

    const stock =
        normalizeNumber(
            document.getElementById("currentStock").value
        );


    const purchaseUnit =
        getSelectedPurchaseUnit();


    if (!purchaseUnit || stock < 0) {

        result.style.display = "none";

        return;

    }


    const baseUnitName =
        getBaseUnitName();


    const totalBaseQuantity =
        stock *
        purchaseUnit.conversion_factor;


    equivalent.textContent =
        `${formatNumber(totalBaseQuantity)} ${baseUnitName}`;


    result.style.display =
        "block";

}




function addUnit() {

    const unitName = document.getElementById("newUnitName").value.trim();


    const quantity = normalizeNumber(document.getElementById("newUnitQuantity").value);


    const containsUnit = document.getElementById("newUnitContains").value;


    const barcode = unitBarcodeInput.value.trim();


    const sellingPrice =
        normalizeNumber(
            document
                .getElementById("newUnitPrice")
                .value
        );


    const forSale = document.getElementById("newUnitForSale").checked;

    const forPurchase = document.getElementById("newUnitForPurchase").checked;

    /*
    | Validation
    */

    if (!unitName) {

        bootboxError(
            "يرجى إدخال اسم الوحدة."
        );

        document
            .getElementById("newUnitName")
            .focus();

        return;

    }


    if (quantity <= 0) {

        bootboxError(
            "يرجى إدخال كمية صحيحة."
        );

        document
            .getElementById("newUnitQuantity")
            .focus();

        return;

    }


    if (!containsUnit) {

        bootboxError(
            "يرجى اختيار الوحدة التي تحتوي عليها هذه الوحدة."
        );

        document
            .getElementById("newUnitContains")
            .focus();

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

    const baseUnitName = getBaseUnitName();


    if (unitName.toLowerCase() === baseUnitName.toLowerCase()) {
        bootboxError(
            "اسم الوحدة مستخدم كالوحدة الأساسية."
        );

        return;

    }




    const duplicated =
        units.some(
            unit =>
                unit.unit_name.toLowerCase() ===
                unitName.toLowerCase()
        );


    if (duplicated) {

        bootboxError(
            "هذه الوحدة مضافة مسبقًا."
        );

        return;

    }



    const parentConversion =
        getParentConversionFactor(
            containsUnit
        );


    if (parentConversion === null) {

        bootboxError(
            "تعذر حساب تحويل الوحدة."
        );

        return;

    }


    const conversionFactor =
        quantity *
        parentConversion;


    let containsUnitName =
        baseUnitName;


    if (containsUnit !== "base") {

        const parentUnit =
            units.find(
                unit =>
                    String(unit.id) ===
                    String(containsUnit)
            );


        if (parentUnit) {

            containsUnitName =
                parentUnit.unit_name;

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

    updatePurchaseUnitOptions();



    document
        .getElementById("newUnitName")
        .value = "";


    document
        .getElementById("newUnitQuantity")
        .value = "";


    document
        .getElementById("newUnitContains")
        .value = "";


    unitBarcodeInput.value = "";
    autoUnitBarcodeCheckbox.checked = false;
    updateUnitBarcodeState();

    document.getElementById("newUnitPrice").value = "";


    document.getElementById("newUnitForSale").checked = true;
    document.getElementById("newUnitForPurchase").checked = false;

    document.getElementById("newUnitName").focus();

}



function renderUnits() {

    const tbody = document.getElementById("unitsTableBody");


    const baseUnitName =
        getBaseUnitName();


    if (!baseUnitName) {

        tbody.innerHTML = `
                <tr>

                    <td colspan="7">

                        <div class="empty-state">

                            <i class="fa-solid fa-box-open d-block"></i>

                            أدخل الوحدة الأساسية أولاً.

                        </div>

                    </td>

                </tr>
            `;

        return;

    }


    let html = "";

    const baseBarcode = baseUnitBarcodeInput.value.trim();


    const basePrice =
        normalizeNumber(
            document
                .getElementById("baseSellingPrice")
                .value
        );


    const baseForSale = document.getElementById("baseForSale").checked;

    const baseForPurchase = document.getElementById("baseForPurchase").checked;

    html += `
            <tr>

                <td class="unit-name-cell">

                    <span class="unit-badge base-badge">

                        <i class="fa-solid fa-star"></i>

                        ${escapeHtml(baseUnitName)}

                    </span>

                </td>


                <td>

                    <span class="text-muted">
                        الوحدة الأساسية
                    </span>

                </td>


                <td>

                    <strong>
                        1
                    </strong>

                    ${escapeHtml(baseUnitName)}

                </td>


                <td>

                    ${baseBarcode
            ? escapeHtml(baseBarcode)
            : autoBarcodeCheckbox.checked ? '<span class="text-muted">سيتم توليده تلقائياً</span>' : '<span class="text-muted">—</span>'
        }

                </td>


                <td>

                    ${formatPrice(basePrice)}

                </td>


                <td>

                    ${renderUsage(baseForPurchase, baseForSale)}

                </td>


                <td>

                    <span class="text-muted">
                        —
                    </span>

                </td>

            </tr>
        `;


    units.forEach(
        (unit, index) => {

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
                            ${unit.auto_generated_barcode
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

        }
    );


    tbody.innerHTML = html;

}



function renderUsage(forPurchase, forSale) {

    const values = [];


    if (forPurchase) {
        values.push(
            `<span class="badge text-bg-primary">شراء</span>`
        );
    }


    if (forSale) {
        values.push(
            `<span class="badge text-bg-success">بيع</span>`
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



function deleteUnit(index) {

    const unit =
        units[index];


    if (!unit) {

        return;

    }


    const isParent =
        units.some(
            child =>
                String(
                    child.contains_unit_id
                ) ===
                String(unit.id)
        );


    if (isParent) {

        bootboxError(
            `لا يمكن حذف "${unit.unit_name}" لأنها مستخدمة داخل وحدة أخرى.`
        );

        return;

    }


    /*
    | إذا كانت الوحدة المحذوفة هي وحدة الشراء
    */

    const purchaseUnit = document.getElementById("purchaseUnit").value;


    if (
        String(purchaseUnit) ===
        String(unit.id)
    ) {

        document
            .getElementById("purchaseUnit")
            .value = "";

        updateStockEquivalent();

    }


    bootbox.confirm({
        message: `هل تريد حذف وحدة "${unit.unit_name}"؟`,
        buttons: {
            confirm: {
                label: 'حذف',
                className: 'btn-danger'
            },
            cancel: {
                label: 'إلغاء',
                className: 'btn-secondary'
            }
        },
        callback: function (confirmed) {
            if (confirmed) {
                units.splice(index, 1);


                renderUnits();

                updateContainsUnitOptions();

                updatePurchaseUnitOptions();
            }
        }
    });


    // units.splice(index, 1);


    // renderUnits();

    // updateContainsUnitOptions();

    // updatePurchaseUnitOptions();

}



function resetForm() {

    bootbox.confirm({
        message: 'هل تريد إعادة تعيين جميع البيانات؟',
        buttons: {
            confirm: {
                label: 'إعادة تعيين',
                className: 'btn-danger'
            },
            cancel: {
                label: 'إلغاء',
                className: 'btn-secondary'
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

    updatePurchaseUnitOptions();

    document.getElementById("stockResult").style.display = "none";
}




async function submitProduct() {

    const productName =
        document
            .getElementById("productName")
            .value
            .trim();


    const categoryId =
        document
            .getElementById("productCategory")
            .value;


    const baseUnitName =
        document
            .getElementById("baseUnitName")
            .value
            .trim();


    const baseBarcode = baseUnitBarcodeInput.value.trim();


    const baseSellingPrice =
        normalizeNumber(
            document
                .getElementById("baseSellingPrice")
                .value
        );


    const baseForSale = document.getElementById("baseForSale").checked;

    const baseForPurchase = document.getElementById("baseForPurchase").checked;


    const purchaseUnitId = document.getElementById("purchaseUnit").value;


    const purchasePrice = normalizeNumber(document.getElementById("purchasePrice").value);


    const currentStock = normalizeNumber(document.getElementById("currentStock").value);


    if (!productName) {

        bootboxError(
            "يرجى إدخال اسم المنتج."
        );

        return;

    }


    if (!categoryId) {

        bootboxError(
            "يرجى اختيار التصنيف."
        );

        return;

    }


    if (!baseUnitName) {

        bootboxError(
            "يرجى إدخال الوحدة الأساسية."
        );

        return;

    }


    if (!purchaseUnitId) {

        bootboxError(
            "يرجى اختيار وحدة الشراء."
        );

        return;

    }


    if (purchasePrice < 0) {

        bootboxError(
            "يرجى إدخال سعر شراء صحيح."
        );

        return;

    }


    if (currentStock < 0) {

        bootboxError(
            "يرجى إدخال مخزون صحيح."
        );

        return;

    }


    const purchaseUnit = getSelectedPurchaseUnit();


    if (!purchaseUnit) {

        bootboxError(
            "تعذر تحديد وحدة الشراء."
        );

        return;

    }


    const stockInBaseUnit = currentStock * purchaseUnit.conversion_factor;


    const data = {

        product: {

            name: productName,

            category_id: Number(
                categoryId
            ),

            stock_quantity:
                stockInBaseUnit

        },


        purchase: {
            unit_id: purchaseUnitId,
            unit_name: purchaseUnit.unit_name,
            price: purchasePrice,
            quantity: currentStock,
            base_quantity: stockInBaseUnit
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

            ...units.map(
                unit => ({

                    ...unit,

                    is_base_unit:
                        false

                })
            )

        ]

    };
    await submitProductData(data);

    /*
    |--------------------------------------------------------------------------
    | طباعة البيانات
    |--------------------------------------------------------------------------
    */

    // console.log(
    //     "================================="
    // );

    // console.log(
    //     "PRODUCT DATA"
    // );

    // console.log(
    //     data
    // );

    // console.log(
    //     JSON.stringify(
    //         data,
    //         null,
    //         4
    //     )
    // );

    // console.log(
    //     "================================="
    // );


    // bootboxError(
    //     "تم تجهيز بيانات المنتج.\n\nافتح Console لمشاهدة البيانات."
    // );

}



function formatNumber(value) {

    return Number(value).toLocaleString(
        "en-US",
        {
            maximumFractionDigits: 4
        }
    );

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
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


document.addEventListener("click", function (e) {

    const addButton =
        e.target.closest(
            "#addUnitBtn"
        );


    if (addButton) {

        addUnit();

        return;

    }


    /*
    | حذف وحدة
    */

    const deleteButton = e.target.closest(".delete-unit-btn");


    if (deleteButton) {

        const index =
            Number(
                deleteButton.dataset.index
            );


        deleteUnit(index);

        return;

    }


    /*
    | إعادة تعيين
    */

    const resetButton =
        e.target.closest(
            "#resetBtn"
        );


    if (resetButton) {

        resetForm();

        return;

    }

}
);



document.getElementById("productForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    await submitProduct();

}
);


document.addEventListener("input", function (e) {
    if (
        e.target.id ===
        "baseUnitName" ||

        e.target.id ===
        "baseBarcode" ||

        e.target.id ===
        "baseSellingPrice"
    ) {

        renderUnits();

        updateContainsUnitOptions();

        updatePurchaseUnitOptions();

    }


    /*
    | المخزون الحالي
    */

    if (
        e.target.id ===
        "currentStock"
    ) {

        updateStockEquivalent();

    }

}
);


document.addEventListener("change", function (e) {

    if (e.target.id === "baseForPurchase" || e.target.id === "baseForSale") {
        renderUnits();
    }

    if (e.target.id === "purchaseUnit") {

        updateStockEquivalent();

    }

}
);



updateContainsUnitOptions();

updatePurchaseUnitOptions();

renderUnits();





async function submitProductData(finalData) {
    //console.log("Submitting product data:", finalData);
    try {
        let res = await fetch(url + '/item/add', {
            method: "POST",
            body: JSON.stringify(finalData),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });
        let data = await res.json();
        if (res.status === 200) {
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
        return;
    } finally {
        loader.style.display = 'none';
    }
}



const purchaseUnit = document.getElementById('purchaseUnit');
const currentStock = document.getElementById('currentStock');
const purchasePrice = document.getElementById('purchasePrice');

const stockUnit = document.getElementById('stockUnit');
const selectedUnitHint = document.getElementById('selectedUnitHint');
const stockUnitHelp = document.getElementById('stockUnitHelp');
const purchasePriceHelp = document.getElementById('purchasePriceHelp');
const purchasePriceUnit = document.getElementById('purchasePriceUnit');

purchaseUnit.addEventListener('change', function () {

    const selectedOption = this.options[this.selectedIndex];

    if (!this.value) {

        currentStock.disabled = true;
        purchasePrice.disabled = true;

        stockUnit.textContent = 'الوحدة';
        stockUnit.classList.remove('active');
        purchasePriceUnit.textContent = 'الوحدة';
        purchasePriceUnit.classList.remove('active');

        selectedUnitHint.innerHTML = `
            <i class="fa-solid fa-circle-info ms-1"></i>
            مثال: حبة، علبة، دزينة، مشتاح...
        `;

        stockUnitHelp.textContent = 'اختر وحدة المخزون أولًا.';

        purchasePriceHelp.textContent =
            'اختر وحدة المخزون أولًا.';

        return;
    }


    const unitName = selectedOption.textContent.trim();


    // تفعيل الحقول
    currentStock.disabled = false;
    purchasePrice.disabled = false;


    // إظهار اسم الوحدة بجانب كمية المخزون
    stockUnit.textContent = unitName;
    stockUnit.classList.add('active');

    purchasePriceUnit.textContent = unitName;
    purchasePriceUnit.classList.add('active');


    // تحديث النصوص حسب الوحدة المختارة
    selectedUnitHint.innerHTML = `
        <i class="fa-solid fa-circle-check ms-1 text-success"></i>
        سيتم تسجيل المخزون بوحدة <strong>${unitName}</strong>.
    `;

    stockUnitHelp.textContent =
        `أدخل كمية المخزون الحالية من ${unitName}.`;

    purchasePriceHelp.innerHTML =
        `أدخل سعر شراء الـ <strong>${unitName}</strong> الواحد/ة.`;
});
