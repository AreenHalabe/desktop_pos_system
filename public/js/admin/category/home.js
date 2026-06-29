import { setActiveNavLink, showAuthExpired, bootboxConfirm, bootboxSuccess } from "../../../component/bootbox.js";
import { url } from "../../../api/urlEndPoint.js";
import { fetchMainCategories } from "../../../api/category.js";
import { removeAuthToken, getAuthToken } from "../../../component/auth.js";

const header = document.querySelector("site-header");

const addMainCategoryBtn = document.getElementById("addMainCategoryBtn");
const mainCategoryModal = document.getElementById("mainCategoryModal");
const mainCategoryForm = document.getElementById("mainCategoryForm");


const categoryTree = document.getElementById("categories-tree");

const addCategoryBtn = document.getElementById("addCategoryBtn");
const categoryModal = document.getElementById("categoryModal");
const categoryForm = document.getElementById("categoryForm");

const spanWrapper = document.querySelector(".span-button");


let tooltip = new bootstrap.Tooltip(spanWrapper, {
  trigger: "manual"
});

let categoryLoader = document.getElementById("loader-category");
let loader = document.getElementById("overlay_loader");

let mainCategoriesData = [];
let isUpdateCategoryData = false;



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







document.addEventListener("DOMContentLoaded", async function () {
  await buildListMainCategories();
  await updateMainCategoryCache();
});

document.addEventListener('click', async (e) => {

  if (e.target.closest('.edit-main-category-btn')) {
    const btn = e.target.closest('.edit-main-category-btn');
    const mainCategory = JSON.parse(btn.dataset.maincategory);
    openMainCategoryModalForEdit(mainCategory);

    return;
  }
  if (e.target.closest('.edit-category-btn')) {
    const btn = e.target.closest('.edit-category-btn');
    const category = JSON.parse(btn.dataset.category);
    buildSelectMainCategories(mainCategoriesData);
    openCategoryModalForEdit(category);
    return;
  }
});


document.addEventListener('submit', function (e) {
  const form = e.target;
  if (form.classList.contains('delete-main-category-form')) {
    const message = form.dataset.confirmMessage || 'هل أنت متأكد؟';
    bootboxConfirm(e, {
      message,
      onConfirm: deleteMainCategory
    });
  }

  else if (form.classList.contains('delete-category-form')) {
    const message = form.dataset.confirmMessage || 'هل أنت متأكد؟';
    bootboxConfirm(e, {
      message,
      onConfirm: deleteCategory
    });
  }
});



addMainCategoryBtn.addEventListener("click", () => {
  mainCategoryForm.reset();
  document.getElementById('mainCategory_id').value = '';
  document.querySelector('.modal-title-one').innerText = 'إنشاء قسم جديد';
  document.getElementById('mainCategorySubmitBtn').innerText = 'إضافة';
  clearErrors(mainCategoryModal);
  new bootstrap.Modal(mainCategoryModal).show();
});

mainCategoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('mainCategory_id').value;

  if (id) {
    await updateMainCategory(id);
  } else {
    await addMainCategory();
  }

});





addCategoryBtn.addEventListener("click", async () => {
  document.getElementById('categoryForm').reset();
  document.getElementById('category_id').value = '';
  document.querySelector('.modal-title-two').innerText = 'إنشاء فئة جديدة';
  document.getElementById('categorySubmitBtn').innerText = 'إضافة';
  clearErrors(categoryModal);
  buildSelectMainCategories(mainCategoriesData);
  new bootstrap.Modal(categoryModal).show();
});

categoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('category_id').value;

  if (id) {
    await updateCategory(id);
  } else {
    await addCategory();
  }

});







mainCategoryModal.addEventListener("hidden.bs.modal", async function () {

  if (isUpdateCategoryData) {
    await buildListMainCategories();
    await updateMainCategoryCache();
    isUpdateCategoryData = false;
    return;
  }
});

categoryModal.addEventListener("hidden.bs.modal", async function () {
  if (isUpdateCategoryData) {
    await buildListMainCategories();
    isUpdateCategoryData = false;
    return;
  }
});



function openMainCategoryModalForEdit(mainCategory) {
  document.getElementById('mainCategory_id').value = mainCategory.id;
  document.getElementById('mainCategory_name').value = mainCategory.name;
  document.querySelector('.modal-title-one').innerText = 'تعديل القسم الرئيسي';
  document.getElementById('mainCategorySubmitBtn').innerText = 'حفظ';
  clearErrors(mainCategoryModal);
  new bootstrap.Modal(mainCategoryModal).show();
}

function openCategoryModalForEdit(category) {
  document.getElementById('category_id').value = category.id;
  document.getElementById('category_name').value = category.name;
  document.getElementById('main_category').value = category.main_category_id;
  document.querySelector('.modal-title-two').innerText = 'تعديل الفئة';
  document.getElementById('categorySubmitBtn').innerText = 'حفظ';
  clearErrors(categoryModal);
  new bootstrap.Modal(categoryModal).show();
}



async function addMainCategory() {
  loader.style.display = 'flex';

  const formData = new FormData(mainCategoryForm);

  const finalData = {
    name: formData.get("name")
  };

  clearErrors(mainCategoryModal);

  try {
    const res = await fetch(url + "/maincategory/add", {
      method: "POST",
      body: JSON.stringify(finalData),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${getAuthToken('auth')}`
      },
    });

    const data = await res.json();

    if (res.status === 200) {
      mainCategoryForm.reset();
      isUpdateCategoryData = true;

      bootboxSuccess(data.message);
      return;
    }

    else if (res.status === 401) {
      showAuthExpired(data.message);
      return;
    }

    else {
      showErrors(mainCategoryModal, data.message);
      return;
    }

  } catch (err) {
    showErrors(mainCategoryModal, err.message);
  } finally {
    loader.style.display = 'none';
  }
}

async function updateMainCategory(id) {

  loader.style.display = 'flex';
  clearErrors(mainCategoryModal);

  const formData = new FormData(mainCategoryForm);

  const finalData = {
    name: formData.get("name")
  };
  try {
    const res = await fetch(url + `/maincategory/update?category_id=${id}`, {
      method: "PUT",
      body: JSON.stringify(finalData),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${getAuthToken('auth')}`
      },
    });

    const data = await res.json();

    if (res.status === 200) {
      bootboxSuccess(data.message);
      clearErrors(mainCategoryModal);
      bootstrap.Modal.getInstance(mainCategoryModal).hide();
      await buildListMainCategories();
      await updateMainCategoryCache();
      return;
    }

    else if (res.status === 401) {
      showAuthExpired(data.message);
      return;
    }

    else {
      showErrors(mainCategoryModal, data.message);
    }

  } catch (err) {
    showErrors(mainCategoryModal, err);
  } finally {
    loader.style.display = 'none';
  }
}

async function deleteMainCategory({ id }) {

  try {
    const res = await fetch(url + `/maincategory/delete?main_category_id=${id}`, {
      method: 'DELETE',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${getAuthToken('auth')}`
      },
    });

    const data = await res.json();

    if (res.status === 401) {
      showAuthExpired(data.message);
      return;
    }
    if (res.status === 200) {
      await buildListMainCategories();
      await updateMainCategoryCache();
      return;
    }
    console.log(data.message);
  } catch (err) {
    console.log(err.message);
  }
}

async function getMainCategoryDetiles() {

  try {
    const res = await fetch(url + '/maincategory/details', {
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

    if (res.status === 200) {
      return data;
    }

    throw new Error(`${data.message}`);

  } catch (err) {
    alert("حدث خطأ في الاتصال : " + err.message);
  }

}





async function addCategory() {

  loader.style.display = 'flex';

  const formData = new FormData(categoryForm);


  const finalData = {
    name: formData.get("name"),
    main_category_id: formData.get('main_category_id')
  };



  clearErrors(categoryModal);

  try {
    const res = await fetch(url + '/category/add', {
      method: "POST",
      body: JSON.stringify(finalData),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${getAuthToken('auth')}`
      },
    });

    const data = await res.json();

    if (res.status === 200) {
      categoryForm.reset();
      isUpdateCategoryData = true;
      bootboxSuccess(data.message);
      return;
    }

    else if (res.status === 401) {
      showAuthExpired(data.message);
      return;
    }

    else {
      showErrors(categoryModal, data.message);
      return;
    }

  } catch (err) {
    showErrors(categoryModal, data.message);
  } finally {
    loader.style.display = 'none';
  }
}

async function updateCategory(id) {
  loader.style.display = 'flex';
  clearErrors(categoryModal);

  const formData = new FormData(categoryForm);

  const finalData = {
    name: formData.get("name"),
    main_category_id: formData.get('main_category_id')
  };

  try {
    const res = await fetch(url + `/category/edit?category_id=${id}`, {
      method: "PUT",
      body: JSON.stringify(finalData),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${getAuthToken('auth')}`
      },
    });

    const data = await res.json();

    if (res.status === 200) {
      bootboxSuccess(data.message);
      clearErrors(categoryModal);
      bootstrap.Modal.getInstance(categoryModal).hide();
      await buildListMainCategories();
      return;
    }

    else if (res.status === 401) {
      showAuthExpired(data.message);
      return;
    }

    else {
      showErrors(categoryModal, data.message);
    }

  } catch (err) {
    showErrors(categoryModal, err);
  } finally {
    loader.style.display = 'none';
  }
}

async function deleteCategory({ id }) {
  try {
    const res = await fetch(url + `/category/delete?category_id=${id}`, {
      method: 'DELETE',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `${getAuthToken('auth')}`
      },
    });

    const data = await res.json();

    if (res.status === 401) {
      showAuthExpired(data.message);
      return;
    }
    if (res.status === 200) {
      await buildListMainCategories();
      return;
    }
    throw new Error('تعذر الاتصال بالسيرفر');
  } catch (err) {
    alert("حدث خطأ في الاتصال : " + err.message);
  }
}

async function updateMainCategoryCache() {
  mainCategoriesData = await fetchMainCategories();
  if (mainCategoriesData.length == 0) {
    addCategoryBtn.disabled = true;
    activateTooltip();
  }
  else {
    addCategoryBtn.disabled = false;
    disposeTooltip();
  }
}

function activateTooltip() {
  if (!tooltip || !spanWrapper) return;
  spanWrapper.setAttribute("data-bs-toggle", "tooltip");
  spanWrapper.setAttribute("title", "يجب إضافة قسم واحد على الأقل");
  spanWrapper.setAttribute("tabindex", "0");
  // tooltip = new bootstrap.Tooltip(spanWrapper);

  tooltip.enable();
}


function disposeTooltip() {
  if (!tooltip) return;


  // tooltip.dispose();

  tooltip.hide();   // أخفيه
  tooltip.disable(); // عطّله بدون destroy
  spanWrapper.removeAttribute("data-bs-toggle");
  spanWrapper.removeAttribute("title");
  spanWrapper.removeAttribute("tabindex");
}


function buildSelectMainCategories(mainCategories) {

  const select = document.getElementById("main_category");

  if (select.options.length > 0) {
    const defaultOption = select.querySelector('option[value="all"]');
    select.innerHTML = "";
    select.appendChild(defaultOption);
  }

  if (mainCategories.length > 0) {
    mainCategories.forEach(category => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      select.appendChild(option);
    });
  }

}


async function buildListMainCategories() {

  showLoader();
  const data = await getMainCategoryDetiles();
  categoryTree.innerHTML = "";
  data.forEach(main => {


    const subCategoriesHTML = (main.categories || [])
      .filter(Boolean)
      .map(cat => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <span>
            <i class="bi bi-tag-fill text-primary"></i>
            ${cat.name}
          </span>

          <div class="d-flex align-items-center gap-1  btn-group-sm">

            <button
              type="button"
              class="btn btn-sm btn-secondary edit-category-btn"
              data-category='{"id":${cat.id},"name":"${cat.name}","main_category_id":${main.id}}'
            >
              <i class="fas fa-pen-to-square"></i>
            </button>

            <form
              class="delete-category-form m-0"
              data-confirm-message = '
                هل أنت متأكد من حذف هذه الفئة <strong>${cat.name}</strong>؟
              <div class="danger-box">
                 سيتم حذف جميع الأصناف المرتبطة بها 
              </div>'
            >
              <button
                type="submit"
                class="btn btn-sm delete-btn"
                data-id="${cat.id}"
              >
                 <i class="fas fa-trash"></i>
              </button>
            </form>

          </div>
        </li>
      `)
      .join("");



    categoryTree.innerHTML += `
        <div class="col-12">
          <div class="border rounded p-3 box">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="mb-0 fw-bold text-dark">
                <i class="bi bi-folder-fill text-warning"></i>
                ${main.name}
              </h5>

              <div class="d-flex align-items-center gap-1  btn-group-sm">
                <button
                  type="button"
                  class="btn btn-sm btn-primary
                  edit-main-category-btn" data-maincategory='{"id":${main.id},"name":"${main.name}"}'
                >
                  <i class="fas fa-pen-to-square"></i>
                </button>

                <form
                  class="delete-main-category-form m-0"
                  data-confirm-message='
                  هل أنت متأكد من حذف هذا القسم <strong>${main.name}</strong>؟
                  <div class="danger-box">
                    جميع الفئات و الأصناف المرتبطة به سيتم حذفها أيضاً!
                  </div>'
                >
                  <button
                    type="submit"
                    class="btn btn-sm delete-btn"
                    data-id="${main.id}"
                  >
                    <i class="fas fa-trash"></i>
                  </button>
                </form>
              </div>
            </div>

            <!-- Sub Categories -->
            <ul class="list-group list-group-flush ms-3">
              ${subCategoriesHTML || ""}
            </ul>
          </div>
        </div>
      `;
  });
  hideLoader();
}


function showErrors(modalElement, message) {
  const errorList = modalElement.querySelector("#error_list");
  const errorMessage = modalElement.querySelector("#errors");
  // تفريغ الأخطاء القديمة
  errorMessage.innerHTML = "";
  errorMessage.innerHTML = `<li>${message}</li>`
  errorList.style.display = "block";
}

function clearErrors(modalElement) {
  const errorList = modalElement.querySelector("#error_list");
  const errorMessage = modalElement.querySelector("#errors");
  errorMessage.innerHTML = "";
  errorList.style.display = "none";
}

function showLoader() {
  categoryTree.style.display = 'none';
  categoryLoader.classList.remove("d-none");
  categoryLoader.classList.add("d-flex");
}

function hideLoader() {
  categoryLoader.classList.remove("d-flex");
  categoryLoader.classList.add("d-none");
  categoryTree.style.display = 'flex';

}