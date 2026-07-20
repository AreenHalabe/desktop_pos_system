import { fetchCategories } from "../../../api/category.js";
import { url } from "../../../api/urlEndPoint.js";
import { showAuthExpired, bootboxConfirm, bootboxSuccess, bootboxError } from "../../../component/bootbox.js";
import { setActiveNavLink } from "../../../component/bootbox.js";
import { removeAuthToken, getAuthToken } from "../../../component/auth.js";

const categoryFilter = document.getElementById('categoryFilter');
const tbody = document.querySelector('#dataTable tbody');
const table = document.getElementById('dataTable');
const emptyNotice = document.getElementById('emptyNotice');
const header = document.querySelector("site-header");
const loader = document.getElementById('loader-product-table');

const searchInput = document.getElementById("searchInput");




const params = new URLSearchParams(window.location.search);
const categoryIdParams = params.get('cid');

let currentDisplayedCategoryId;
let categories = [];
let items = [];
let filteredItems;

let currentPage;
let itemsPerPage = 15;
let totalPages;



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




document.addEventListener("DOMContentLoaded", async function () {
  await buildSelectCategory();
  await loadItems();


  if (categoryIdParams) {
    setValueForSelect(categoryIdParams);

    filteredItems = items.filter(item => item.category_id === Number(categoryIdParams));
    handelTotalPage(filteredItems.length);

    fetchProducts(Number(categoryIdParams));
  }
  else {
    handelTotalPage(items.length);

    fetchProducts(0);

  }

});


categoryFilter.addEventListener('change', function () {
  if (this.value === 'goToPage') {
    window.location.href = '../category/home.html';
    return;
  }
  if(Number(this.value) === 0){
    handelTotalPage(items.length);
    fetchProducts(Number(this.value));
  }
  else{
    filteredItems = items.filter(item => item.category_id === Number(this.value));
    handelTotalPage(filteredItems.length);
    fetchProducts(Number(this.value));
  }

  
  searchInput.value = '';
});

document.addEventListener('submit', function (e) {
  const form = e.target;
  if (form.classList.contains('delete-item-form')) {
    const message = form.dataset.confirmMessage || 'هل أنت متأكد؟';
    bootboxConfirm(e, {
      message,
      onConfirm: deleteItem
    });
  }
});

document.addEventListener("click", async function (e) {

  if (e.target.closest('.prevBtn')) {
    prevPage();
  }
  else if (e.target.closest('.nextBtn')) {
    nextPage();
  }

});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const value = searchInput.value.trim();


    const item = items.find(item => item.barcode === value);

    if (!item) {
      bootboxError("لم يتم العثور على صنف مرتبط بالباركود المدخل.");
    }
    else {
      renderItemIntable(item);
    }
  }
});


function renderItemIntable(product) {
  setCategoryTitle(-1);
  let priceOrVariants = '';
  if (product.variants && product.variants.length > 0) {
    priceOrVariants = `
        <ul class="list-unstyled m-0 ul_box">
          ${product.variants.map(variant => `
            <li class="list" >
              <span class="badge bg-primary" dir="ltr"> 
                ${escapeHtml(variant.name)} :  ₪ ${escapeHtml(variant.price)} 
              </span>
                
            </li>
          `).join('')}
        </ul>
      `
      ;

  } else {
    priceOrVariants = `
        <span class="badge bg-primary fs-6"> ${escapeHtml(product.price ?? '-')} ₪ </span>
      `
      ;
  }


  tbody.innerHTML = `
      <tr>
          <td class="align-middle" data-label="الرقم">
              ${1}
          </td>

          <td class="align-middle" data-label="إسم الصنف">
              ${escapeHtml(product.name)}
          </td>

          <td class="align-middle" data-label="الباركود">
              ${product?.barcode || '<span class="text-muted">بدون باركود</span>'}
          </td>
           <td class="align-middle" data-label="الفئة">
              ${categories.find(category => category.id === product.category_id).name}
          </td>

          <td class="align-middle" data-label="السعر"  style="vertical-align: middle;">
              ${priceOrVariants}
          </td>

          <td class="align-middle" data-label="تعديل / حذف">
            <div class="d-flex justify-content-center gap-2 flex-wrap btn-group-sm">
              <a href="./edit.html?item_id=${product.id}" class="btn btn-sm btn-secondary">
                <i class="fas fa-pen-to-square"></i>
              </a>
              <form class = 'delete-item-form'
                data-confirm-message = 'هل أنت متأكد من حذف هذا الصنف <strong>${product.name}</strong>؟'
              >
                <button type="submit" 
                  class="btn btn-sm delete-btn"
                  data-item-id="${product.id}"
                  data-category-id="${product.category_id}"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </form>
            </div>
          </td>
      </tr>
    `
    ;
}


function setValueForSelect(categoryId) {
  categoryFilter.value = categoryId;
}

async function buildSelectCategory() {
  categories = await fetchCategories();
  const select = document.getElementById("categoryFilter");

  if (categories.length > 0) {
    categories.forEach(category => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      select.appendChild(option);
    });
  }
  const option2 = document.createElement("option");
  option2.value = "goToPage";
  option2.textContent = "➕ إنشاء فئة جديدة";
  select.appendChild(option2);
}


function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    fetchProducts(currentDisplayedCategoryId);
  }
}
function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    fetchProducts(currentDisplayedCategoryId);
  }
}


function handelTotalPage(numOfItems) {
  if (numOfItems == 0) return;
  currentPage = 1;

  handleTotalItems(numOfItems)
}

function handleTotalItems(numOfItems) {
  if (numOfItems == 0) return;
  const totalItems = numOfItems;
  totalPages = Math.ceil(totalItems / itemsPerPage);

  if(totalPages === 1){
    currentPage = 1;
  }
}

function updatePagination() {
  const pageInfo = document.getElementById('pageInfo');
  pageInfo.textContent = `صفحة ${currentPage} من ${totalPages}`;
  document.getElementById('prevBtn').disabled = currentPage === 1;
  document.getElementById('nextBtn').disabled = currentPage === totalPages;
}

function fetchProducts(categoryId) {
  currentDisplayedCategoryId = categoryId;
  showLoader();
  clearTable();
  showEmptyNotice(false);
  setCategoryTitle(categoryId);



  if (categoryId === 0) {
    filteredItems = items;
  }



  if (filteredItems.length === 0) {
    hideTable();
    showEmptyNotice(true, 'لا توجد أصناف في هذه الفئة');
    hideLoader();
    return;
  }

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = filteredItems.slice(start, end);

  let counter = (currentPage * 15) - (15);

  displayTable();
  let html = '';
  pageItems.forEach(p => {
    html += buildRow(p, counter);
    ++counter;
  });
  tbody.innerHTML = html;

  updatePagination();

  hideLoader();

}


async function loadItems() {
  showLoader();
  showEmptyNotice(false);
  // clearTable();
  // setCategoryTitle(0);
  try {
    const res = await fetch(url + '/items', {
      method: 'GET',
      headers: {
        "Authorization": `${getAuthToken('auth')}`
      },
    });

    const data = await res.json();

    if (res.status === 401) {
      hideTable();
      showAuthExpired(data.message);
      return;
    }
    else if (res.status === 200) {
      items = data.items;
    }
    else {
      showEmptyNotice(data.message);
    }
  } catch (e) {
    showEmptyNotice(e.message);
  } finally {
    hideLoader();
  }
}


async function deleteItem({ itemId, categoryId }) {
  showEmptyNotice(false);
  try {
    const res = await fetch(url + `/item/delete?item_id=${itemId}`, {
      method: 'DELETE',
      headers: {
        "Authorization": `${getAuthToken('auth')}`
      },
    });

    const data = await res.json();
    if (res.status === 401) {
      showAuthExpired(data.message);
      return;
    }
    if (res.status === 200) {
      bootboxSuccess(data.message);

      await loadItems();

      if(currentDisplayedCategoryId === 0){
        handleTotalItems(items.length);
      }
      else{
        filteredItems = items.filter(item => item.category_id === Number(currentDisplayedCategoryId));
        handleTotalItems(filteredItems.length);
      }
      
      fetchProducts(Number(currentDisplayedCategoryId));
      return;
    }
    showEmptyNotice(true, data.message);
  } catch (err) {
    showEmptyNotice(true, err.message);
  }
}


function showEmptyNotice(show = true, text = 'الرجاء اختيار فئة لعرض الأصناف') {
  emptyNotice.textContent = text;
  emptyNotice.style.display = show ? 'block' : 'none';
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildRow(product, counter) {
  let priceOrVariants = '';
  if (product.variants && product.variants.length > 0) {
    priceOrVariants = `
        <ul class="list-unstyled m-0 ul_box">
          ${product.variants.map(variant => `
            <li class="list" >
              <span class="badge bg-primary" dir="ltr"> 
                ${escapeHtml(variant.name)} :  ₪ ${escapeHtml(variant.price)} 
              </span>
                
            </li>
          `).join('')}
        </ul>
      `
      ;

  } else {
    priceOrVariants = `
        <span class="badge bg-primary fs-6"> ${escapeHtml(product.price ?? '-')} ₪ </span>
      `
      ;
  }


  return `
      <tr>
          <td class="align-middle" data-label="الرقم">
              ${++counter}
          </td>

          <td class="align-middle" data-label="إسم الصنف">
              ${escapeHtml(product.name || '')}
          </td>

          <td class="align-middle" data-label="الباركود">
              ${product?.barcode || '<span class="text-muted">بدون باركود</span>'}
          </td>

          <td class="align-middle" data-label="الفئة">
              ${categories.find(category => category.id === product.category_id).name}
          </td>


          <td class="align-middle" data-label="السعر"  style="vertical-align: middle;">
              ${priceOrVariants}
          </td>

          <td class="align-middle" data-label="تعديل / حذف">
            <div class="d-flex justify-content-center gap-2 flex-wrap btn-group-sm">
              <a href="./edit.html?item_id=${product.id}" class="btn btn-sm btn-secondary">
                <i class="fas fa-pen-to-square"></i>
              </a>
              <form class = 'delete-item-form'
                data-confirm-message = 'هل أنت متأكد من حذف هذا الصنف <strong>${product.name}</strong>؟'
              >
                <button type="submit" 
                  class="btn btn-sm delete-btn"
                  data-item-id="${product.id}"
                  data-category-id="${product.category_id}"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </form>
            </div>
          </td>
      </tr>
    `
    ;
}

function setCategoryTitle(categoryId) {
  const categoryTitle = document.getElementById('category_title');
  if (categoryId === -1) {
    categoryTitle.innerHTML = 'بحث حسب الباركود';
    return;
  }

  const select = document.getElementById("categoryFilter");
  const option = Array.from(select.options).find(opt => opt.value === `${categoryId}`);

  if (option.text === "عرض الكل") {
    categoryTitle.innerHTML = "كل الأصناف";
  }
  else {
    categoryTitle.innerHTML = option.text;
  }
}


function clearTable() {
  tbody.innerHTML = '';
}





function showLoader() {
  loader.classList.remove("d-none");
  loader.classList.add("d-flex");
}

function hideLoader() {
  loader.classList.remove("d-flex");
  loader.classList.add("d-none");
}

function displayTable() {
  table.classList.remove('hidden');
}

function hideTable() {
  table.classList.add('hidden');
}







