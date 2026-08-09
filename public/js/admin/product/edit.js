    import { fetchCategories } from "../../../api/category.js";
    import { url } from "../../../api/urlEndPoint.js";
    import { showAuthExpired, bootboxSuccess } from "../../../component/bootbox.js";
    import {compressWithLibrary} from "../../../component/handlimage.js";
    import { getAuthToken } from "../../../component/auth.js";


    let errorMessage          = document.getElementById("errors");
    let form                  = document.getElementById("product_form");
    let errorList             = document.getElementById("error_list");

    
    const autoBarcodeCheckbox = document.getElementById('auto_barcode');

    const categoryFilter      = document.getElementById('category_id');

    const backBtn             = document.getElementById('backBtn');
    let price                 = document.getElementById('price');
    const barcode             = document.getElementById('barcode');
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

        hasVariantsCheckbox.checked = false;
        
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
        auto_generated_barcode : formData.get('auto_barcode'),
        barcode : formData.get('barcode'),
        stock : formData.get('stock') || 0,
        has_variants : formData.get('has_variants'),
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


function addDataIntoFormData(item) {
    document.getElementById('name').value = item.name || '';
    document.getElementById('category_id').value = item.category_id ;
    document.getElementById('price').value = item.price || '';
    document.getElementById('barcode').value = item.barcode || '';
    document.getElementById('stock').value = item.stock || 0;
    categoryId = item.category_id;
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
