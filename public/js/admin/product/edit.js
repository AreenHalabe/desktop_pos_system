    import { fetchCategories } from "../../../api/category.js";
    import { url } from "../../../api/urlEndPoint.js";
    import { showAuthExpired, bootboxSuccess } from "../../../component/bootbox.js";
    import {compressWithLibrary} from "../../../component/handlimage.js";
    import { getAuthToken } from "../../../component/auth.js";


    let errorMessage          = document.getElementById("errors");
    let form                  = document.getElementById("product_form");
    let errorList             = document.getElementById("error_list");

    
    const hasVariantsCheckbox = document.getElementById('has_variants');
    const variantsBox         = document.getElementById('variants_box');
    const addVariantBtn       = document.getElementById('add_variant_btn');
    const variantsTable       = document.getElementById('variants_table');
    const categoryFilter      = document.getElementById('category_id');

    const backBtn             = document.getElementById('backBtn');
    let price                 = document.getElementById('price');
    let loader                = document.getElementById("overlay_loader");


    let categoryId;


    const params    = new URLSearchParams(window.location.search);
    const itemId    = params.get("item_id");



document.addEventListener('DOMContentLoaded', async function() {
    const loaderPageContent = document.getElementById('loader');
    const pageContent = document.getElementById('pageContent');
    try {
        let res = await fetch(url + `/item/get?item_id=${itemId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });
        let data = await res.json();

        if(res.status !== 200) {
            if(res.status === 401){
                loaderPageContent.innerHTML = `<p class="text-danger"> ${data.message}</p>`;
                showAuthExpired(data.message);
            }
            else{
                loaderPageContent.innerHTML = `<p class="text-danger"> ${data.message}</p>`;
            }
            return;
        }   

        await buildSelectCategory();
        addDataIntoFormData(data.item);

        loaderPageContent.style.display = 'none';
        pageContent.style.display = 'block';

        if(data.item.variants && data.item.variants.length > 0) {
            handleVariants(data.item.variants);
        } else {
            variantsBox.style.display = 'none';
            hasVariantsCheckbox.checked = false;
        }
    } catch (err) {
        console.error("Error fetching product data:", err);
    }

    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('delete-row') || e.target.closest('.delete-row')) {
            e.target.closest('tr').remove();
        }
    });
});

categoryFilter.addEventListener('change', function() {
    if(this.value === 'goToPage'){
        window.location.href = '../category/home.html';
        return;
    }
});

hasVariantsCheckbox.addEventListener('change', function() {
    if (this.checked) {
        price.value = '';
        price.disabled = true;
        toggleVariants(this.checked);
        price.placeholder = 'السعر يُحدد في جدول الأحجام';
        price.style.cursor = 'not-allowed';
        variantsBox.style.display = 'block';
    } else {
        price.disabled = false;
        price.placeholder = 'السعر';
        price.style.cursor = 'text'; 
        toggleVariants(this.checked);
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

backBtn.addEventListener('click' , function(){
    window.location.href = `./home.html?cid=${categoryId}`;
})

form.addEventListener("submit",  async function(e){
    e.preventDefault();
    loader.style.display = 'flex';
    errorMessage.innerHTML = "";
    hideError();

    let formData      = new FormData(form);

    const finalData = {
        name: formData.get("name"),
        category_id : formData.get('category_id'),
        price : formData.get('price'),
        station : formData.get('station'),
        has_variants : formData.get('has_variants'),
        variantsSize : formData.getAll('variants[size][]'),
        variantsPrice : formData.getAll('variants[price][]')
    }


    try{
        let res = await fetch(url + `/item/update?item_id=${itemId}`, {
            method: "PUT",
            body: JSON.stringify(finalData),
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });

        let data = await res.json();

        if(res.status === 200){
            bootboxSuccess(data.message , null, false, reDirectToHomePage);
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
        showError();
        errorMessage.innerHTML = `<li> ${err.message} </li>`;
        return;
    }finally{
        loader.style.display = 'none';
    }
        
});


function toggleVariants(enabled) {
    document
    .querySelectorAll('[name="variants[size][]"], [name="variants[price][]"]')
    .forEach(input => {
        input.disabled = !enabled;
    });
}

function addDataIntoFormData(item) {
    document.getElementById('name').value = item.name || '';
    document.getElementById('category_id').value = item.category_id ;
    document.getElementById('price').value = item.price || '';
    document.getElementById('old-image').value = item.image || '' ;
    document.getElementById('station').value = item.station || '';
    categoryId = item.category_id;

}

function handleVariants(variants) {
    hasVariantsCheckbox.checked = true;
    price.disabled = true;
    variantsBox.style.display = 'block';
    price.placeholder = 'السعر يُحدد في جدول الأحجام';
    price.style.cursor = 'not-allowed';

    // حذف أي صفوف قديمة
    variantsTable.innerHTML = '';
    variants.forEach(variant => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <select name="variants[size][]" class="form-control" required>
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                    <option value="Kids">Kids</option>
                </select>
            </td>
            <td><input type="number" class="form-control" name="variants[price][]" value="${variant.price}" required></td>
            <td class="text-center">
                <button type="button" class="btn btn-danger btn-sm delete-row"><i class="bi bi-trash"></i></button>
            </td>
        `;
        const select = tr.querySelector('select[name="variants[size][]"]');
        select.value = variant.name; 
        variantsTable.appendChild(tr);
    });
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

function reDirectToHomePage(){
    window.location.href = `./home.html?cid=${categoryId}`;
}
