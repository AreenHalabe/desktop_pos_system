import { setActiveNavLink, showAuthExpired, bootboxError, bootboxSuccess, bootboxConfirm } from "../../../component/bootbox.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";

import { displayLoader, hiddeLoader} from "../report/shared-functionality.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";

const header = document.querySelector("site-header");

const tableNumberInput = document.getElementById('tableNumber');
const startTableInput  = document.getElementById('startTable');
const stepInput        = document.getElementById('step');
const countInput       = document.getElementById('count');
const bulkCheck = document.getElementById('bulkCheck');

const addModal = document.getElementById('addModal');
const overlayLoader = document.getElementById("overlay_loader");


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
    logoutFrom.addEventListener("submit" , async function(e) {
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


document.addEventListener('DOMContentLoaded' , async function() {
    await loadTable();
});


addModal.addEventListener('hidden.bs.modal', () => {
    document.getElementById("singleInput").classList.remove("d-none");
    document.getElementById("bulkInputs").classList.add("d-none");
    bulkCheck.checked = false;
    reSetInputValue();
});






bulkCheck.addEventListener("change", function () {
    document.getElementById("singleInput").classList.toggle("d-none");
    document.getElementById("bulkInputs").classList.toggle("d-none");
    reSetInputValue();
});

document.addEventListener("click", async function (e) {

    if(e.target.closest('.add-btn')) {
       await handleData();
    }

    else if(e.target.closest('.delete-btn')) {
        const btn = e.target.closest('.delete-btn');
        if (!btn) return;
        const id = btn.dataset.id;
        await deleteTable(id);
    }
    else if(e.target.closest('.destroy-btn')){
        await destroyTables();
    }
});


function renderTables(tables) {
    const container = document.getElementById("tablesContainer");
    container.innerHTML = "";

    tables.forEach(t => {
        container.innerHTML += `
      <div class="col-6 col-md-3 col-lg-2">
        <div class="card table-card shadow-sm text-center">
          <div class="card-body">
            <h5 class="mb-2">طاولة ${t.table_number}</h5>

            <button class="btn btn-sm btn-outline-danger delete-btn" data-id='${t.table_number}'>
              <i class="fa fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    });
}



async function loadTable() {
    try {
        const res = await fetch(url + '/table', {
            method: 'GET',
            headers: {
                "Authorization": `${getAuthToken('auth')}`
            },
        });
        const data = await res.json();
        if (res.status === 401) {
            showAuthExpired(data.message);
        }
        else if (res.status === 200) {
            renderTables(data.tables);
        }
        else {
            bootboxError(data.message);
        }
    } catch (e) {
        bootboxError(e.message);
    } finally {
        hiddeLoader();
    }
}

async function addTable(tableNumber, startTable, step, count, isMoreThanOneTable) {
    overlayLoader.style.display = 'flex';
    try{
        const res = await fetch(url + '/table/add' , {
            method : "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
            body: JSON.stringify({
                tableNumber,
                startTable,
                step,
                count,
                isMoreThanOneTable
            }),
        });
        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
        }
        else if (res.status === 200) {
            bootboxSuccess(data.message);
            await loadTable();
            bootstrap.Modal.getInstance(addModal).hide();
        }
        else {
            bootboxError(data.message);
        }
    }catch(e){
        bootboxError(e.message);
    }finally{
        overlayLoader.style.display = 'none';
    }
}


async function deleteTable(id) {
    const confirmed = await bootboxConfirmDelete(`هل تريد حذف هذه الطاولة ${id} ؟`);
    if (!confirmed) return;

    overlayLoader.style.display = 'flex';

    try{
        const res = await fetch(url + `/table/delete?table_id=${id}` , {
            method : "DELETE",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });
        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
        }
        else if (res.status === 200) {
            bootboxSuccess(data.message);
            await loadTable();
        }
        else {
            bootboxError(data.message);
        }
    }catch(e){
        bootboxError(e.message);
    }finally{
        overlayLoader.style.display = 'none';
    }
}
async function handleData(){
    const tableNumber = Number(tableNumberInput.value);
    const startTable  = Number(startTableInput.value);
    const step        = Number(stepInput.value);
    const count       = Number(countInput.value);
    const isMoreThanOneTable  = bulkCheck.checked;

    console.log(tableNumber, startTable, step, count, isMoreThanOneTable);

    await addTable(tableNumber, startTable, step, count, isMoreThanOneTable);
}

async function destroyTables() {
    const confirmed = await bootboxConfirmDelete(`هل أنت متأكد من حذف جميع الطاولات ؟`);

    if (!confirmed) return;

    overlayLoader.style.display = 'flex';

    try{
        const res = await fetch(url + `/table/destroy` , {
            method : "DELETE",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });
        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
        }
        else if (res.status === 200) {
            bootboxSuccess(data.message);
            await loadTable();
        }
        else {
            bootboxError(data.message);
        }
    }catch(e){
        bootboxError(e.message);
    }finally{
        overlayLoader.style.display = 'none';
    }
}



function reSetInputValue(){
    tableNumberInput.value = '';
    startTableInput.value  = '';
    stepInput.value        = '';
    countInput.value       = '';
}

function bootboxConfirmDelete(message = "هل أنت متأكد من الحذف؟") {
  return new Promise((resolve) => {
    bootbox.confirm({
      title: "تأكيد الحذف",
      message: `
        <div class="text-center">
          <i class="bi bi-exclamation-triangle-fill text-danger fs-1"></i>
          <p class="mt-3 mb-0">${message}</p>
        </div>
      `,
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
      callback: (result) => resolve(result)
    });
  });
}