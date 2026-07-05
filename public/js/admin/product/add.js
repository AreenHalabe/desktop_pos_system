    import { fetchCategories } from "../../../api/category.js";
    import { url } from "../../../api/urlEndPoint.js";
    import { showAuthExpired, bootboxSuccess } from "../../../component/bootbox.js";
    import {compressWithLibrary} from "../../../component/handlimage.js";
    import { getAuthToken } from "../../../component/auth.js";
    
    
    
    const hasVariantsCheckbox = document.getElementById('has_variants');
    const basePriceBox        = document.getElementById('base_price_box');
    const variantsBox         = document.getElementById('variants_box');
    const addVariantBtn       = document.getElementById('add_variant_btn');
    const variantsTable       = document.getElementById('variants_table');
    const categoryFilter      = document.getElementById('category_id');
    let errorMessage          = document.getElementById("errors");
    let form                  = document.getElementById("product_form");
    let errorList             = document.getElementById("error_list");
    let price                 = document.getElementById('price');
    let loader                = document.getElementById("overlay_loader");



function toggleVariants(enabled) {
    document
    .querySelectorAll('[name="variants[size][]"], [name="variants[price][]"]')
    .forEach(input => {
        input.disabled = !enabled;
    });
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    loader.style.display = 'flex';
    errorMessage.innerHTML = "";

    hideError();

    let formData      = new FormData(form);

    const finalData = {
        name: formData.get("name"),
        category_id : formData.get('category_id'),
        price : formData.get('price'),
        has_variants : formData.get('has_variants'),
        station : formData.get('station'),
        variantsSize : formData.getAll('variants[size][]'),
        variantsPrice : formData.getAll('variants[price][]')
    }

    console.log(finalData);


    try{
        let res = await fetch(url + '/item/add', {
            method: "POST",
            body: JSON.stringify(finalData),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });
        let data = await res.json();
        if(res.status === 200){
            bootboxSuccess(data.message);
            resetProductForm();
            return;
        }
        else if(res.status === 400){
            showError();
            errorMessage.innerHTML =
                data.errors.map(err => `<li>${err.message}</li>`).join("");
            return;
        }

        else if(res.status === 401){
            showAuthExpired(data.message);
            return;
        }

        else if(res.status === 409){
            showError();
            errorMessage.innerHTML =  `<li>${data.message}</li>`;
            return;
        }

        else{
            showError();
            errorMessage.innerHTML = `<li>${data.message}</li>`;
            return;
        }
    }catch(err){
        console.error(err.message);
        showError();
        errorMessage.innerHTML = `<li> ${err.message} </li>`;
        return;
    }finally{
        loader.style.display = 'none';
    }
});


document.addEventListener('DOMContentLoaded', async function() {
    await buildSelectCategory();
    hasVariantsCheckbox.addEventListener('change', function() {
        if (this.checked) {
            price.value = '';
            price.disabled = true;
            toggleVariants(this.checked);
            //basePriceBox.style.display = 'none';
            basePriceBox.style.visibility = 'hidden';

            variantsBox.style.display = 'block';
        } else {
            price.disabled = false;
            toggleVariants(this.checked);
            //basePriceBox.style.display = 'block';
            basePriceBox.style.visibility = 'visible';
            variantsBox.style.display = 'none';
        }
    });

    addVariantBtn?.addEventListener('click', function() {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <select name="variants[size][]" class="form-select" required>
                    <option value="" selected disabled>إختر حجم</option>
                    <option value="Kids">Kids</option>
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                </select>
            </td>
            <td><input type="number" name="variants[price][]" class="form-control" required></td>
            <td class="text-center">
                <button type="button" class="btn btn-danger btn-sm delete-row"><i class="bi bi-trash"></i></button>
            </td>
        `;
        variantsTable.appendChild(row);
    });

    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('delete-row') || e.target.closest('.delete-row')) {
            e.target.closest('tr').remove();
        }
    });


    categoryFilter.addEventListener('change', function() {
        if(this.value === 'goToPage'){
           window.location.href = '../category/home.html';
            return;
        }
    });

});


function resetProductForm() {

    form.reset();

    // reset checkbox logic
    hasVariantsCheckbox.checked = false;

    // reset price
    price.disabled = false;
    price.value = '';

    // hide variants, show base price
    variantsBox.style.display = 'none';
    // basePriceBox.style.display = 'block';
    basePriceBox.style.visibility = 'visible';

    // remove all variant rows
    variantsTable.innerHTML = '';
}


async function buildSelectCategory() {
    const select = document.getElementById("category_id");
    try {

        const categories = await fetchCategories();

        if(categories.length > 0) {
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



function showError(){
    errorList.classList.remove('hidden');
}

function hideError(){
    errorList.classList.add('hidden');
}


