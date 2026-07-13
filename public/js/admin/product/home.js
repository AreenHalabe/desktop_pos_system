import { fetchCategories } from "../../../api/category.js";
import { url } from "../../../api/urlEndPoint.js";
import { showAuthExpired, bootboxConfirm, bootboxSuccess } from "../../../component/bootbox.js";
import { setActiveNavLink } from "../../../component/bootbox.js";
import { removeAuthToken, getAuthToken } from "../../../component/auth.js";

const categoryFilter = document.getElementById('categoryFilter');
const tbody = document.querySelector('#dataTable tbody');
const table = document.getElementById('dataTable');
const emptyNotice = document.getElementById('emptyNotice');
const header = document.querySelector("site-header");
const loader = document.getElementById('loader-product-table');


const modal = new bootstrap.Modal(document.getElementById('imageModal'));
const modalImg = document.getElementById('modalImage');



const params = new URLSearchParams(window.location.search);
const categoryIdParams = params.get('cid');


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
  clearTable();
  setupImageModal();
  showEmptyNotice(true, 'الرجاء اختيار فئة لعرض الأصناف');
  categoryFilter.addEventListener('change', function () {
    if (this.value === 'goToPage') {
      window.location.href = '../category/home.html';
      return;
    }
    fetchProducts(this.value);
  });

  if (categoryIdParams) {
    setValueForSelect(categoryIdParams);
    await fetchProducts(categoryIdParams);
  }

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



function setValueForSelect(categoryId) {
  categoryFilter.value = categoryId;
}

async function buildSelectCategory() {
  const categories = await fetchCategories();
  const select = document.getElementById("categoryFilter");

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

}


async function fetchProducts(categoryId) {
  try {
    showLoader();
    clearTable();
    showEmptyNotice(false);
    setCategoryTitle(categoryId);

    if (!categoryId || categoryId === 'all') {
      showEmptyNotice(true, 'الرجاء اختيار فئة لعرض الأصناف');
      return;
    }

    const res = await fetch(url + `/item/by-category?category_id=${categoryId}`, {
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
    if (data.length === 0) {
      hideTable();
      showEmptyNotice(true, 'لا توجد أصناف في هذه الفئة');
      return;
    }

    displayTable();
    // بناء الصفوف
    let html = '';
    data.forEach((p, i) => {
      html += buildRow(p, i);
    });
    tbody.innerHTML = html;

  } catch (err) {
    showEmptyNotice(true, err.message);
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
      await fetchProducts(categoryId);
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

function buildRow(product, index) {
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
              ${index + 1}
          </td>

          <td class="align-middle" data-label="إسم الصنف">
              ${escapeHtml(product.name || '')}
          </td>

          <td class="align-middle" data-label="الباركود">
              ${product?.barcode || 'غير مُدخل'}
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
  const select = document.getElementById("categoryFilter");
  const option = Array.from(select.options).find(opt => opt.value === `${categoryId}`);

  categoryTitle.innerHTML = option.text;
}


function clearTable() {
  tbody.innerHTML = '';
}


function setupImageModal() {
  table.addEventListener("click", (e) => {
    const img = e.target.closest(".modal-trigger");
    if (!img) return;

    modalImg.src = img.src;
    modal.show();
  });
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







