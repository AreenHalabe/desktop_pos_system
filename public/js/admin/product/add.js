import { fetchCategories } from "../../../api/category.js";
import { url } from "../../../api/urlEndPoint.js";
import { showAuthExpired, bootboxSuccess } from "../../../component/bootbox.js";
import { compressWithLibrary } from "../../../component/handlimage.js";
import { getAuthToken } from "../../../component/auth.js";



const autoBarcodeCheckbox = document.getElementById('auto_barcode');

const categoryFilter = document.getElementById('category_id');
let errorMessage = document.getElementById("errors");
let form = document.getElementById("product_form");
let errorList = document.getElementById("error_list");
let price = document.getElementById('price');
let loader = document.getElementById("overlay_loader");
const barcode = document.getElementById('barcode');



form.addEventListener("submit", async (e) => {
    e.preventDefault();
    loader.style.display = 'flex';
    errorMessage.innerHTML = "";

    hideError();

    let formData = new FormData(form);

    const finalData = {
        name: formData.get("name"),
        category_id: formData.get('category_id'),
        price: formData.get('price'),
        auto_generated_barcode : formData.get('auto_barcode'),
        barcode: formData.get('barcode'),
        stock: formData.get('stock') || 0,
    }


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
            resetProductForm();
            return;
        }
        else if (res.status === 400) {
            showError();
            errorMessage.innerHTML =
                data.errors.map(err => `<li>${err.message}</li>`).join("");
            return;
        }

        else if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }

        else if (res.status === 409) {
            showError();
            errorMessage.innerHTML = `<li>${data.message}</li>`;
            return;
        }

        else {
            showError();
            errorMessage.innerHTML = `<li>${data.message}</li>`;
            return;
        }
    } catch (err) {
        console.error(err.message);
        showError();
        errorMessage.innerHTML = `<li> ${err.message} </li>`;
        return;
    } finally {
        loader.style.display = 'none';
    }
});


document.addEventListener('DOMContentLoaded', async function () {
    await buildSelectCategory();
    
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('delete-row') || e.target.closest('.delete-row')) {
            e.target.closest('tr').remove();
        }
    });


    categoryFilter.addEventListener('change', function () {
        if (this.value === 'goToPage') {
            window.location.href = '../category/home.html';
            return;
        }
    });

});


autoBarcodeCheckbox.addEventListener('change', function () {
    if (this.checked) {
        barcode.value = '';
        barcode.disabled = true;
        barcode.placeholder = 'سيتم توليد باركود تلقائياً';
        barcode.style.cursor = 'not-allowed';
    } else {
        barcode.disabled = false;
        barcode.placeholder = 'الباركود';
        barcode.style.cursor = 'text';

    }
});

function resetProductForm() {

    form.reset();


    autoBarcodeCheckbox.checked = false;
    barcode.disabled = false;
    barcode.placeholder = 'الباركود';
    barcode.style.cursor = 'text';



    price.value = '';
    price.placeholder = 'السعر';

}


async function buildSelectCategory() {
    const select = document.getElementById("category_id");
    try {

        const categories = await fetchCategories();

        if (categories.length > 0) {
            categories.forEach(category => {
                const option = document.createElement("option");
                option.value = category.id;
                option.textContent = category.name;
                select.appendChild(option);
            });
        }

        const newOption = document.createElement("option");
        newOption.value = "goToPage";
        newOption.textContent = "➕ إنشاء فئة جديدة";
        select.appendChild(newOption);

    } catch (err) {
        console.error("Error fetching categories:", err);
    }
}



function showError() {
    errorList.classList.remove('hidden');
}

function hideError() {
    errorList.classList.add('hidden');
}


