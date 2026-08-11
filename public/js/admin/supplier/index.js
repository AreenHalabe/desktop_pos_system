import { setActiveNavLink, showAuthExpired, bootboxSuccess, bootboxError, bootboxConfirm } from "../../../component/bootbox.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";






const header = document.querySelector("site-header");


const tableContainer = document.getElementById('tableContainer');
const createAccountModal = document.getElementById('createAccountModal');
const editAccountModal = document.getElementById('editAccountModal');


const createAccountForm = document.getElementById('createSupplierForm');
const editAccountForm = document.getElementById('editSupplierForm');


const editCustomerName = document.getElementById('editCustomerName');
const editAccountBtn = document.getElementById('editAccountBtn');

const overlayLoader = document.getElementById('overlay_loader');
const tableBody = document.getElementById('customersTableBody');
let suppliers = [];

let supplierId ;


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
        if (!confirm("هل أنت متأكد من تسجيل الخروج؟")) return;
        try {
            const res = await fetch(url + '/logout', {
                method: 'POST',
                credentials: 'include'
            });
            if (res.status === 200) {
                removeAuthToken();
                window.location.href = '/admin/login';
                return;
            }
        } catch (err) {
            console.log(err.message);
        }
    });
});



document.addEventListener("DOMContentLoaded", async function () {
    await loadSuppliers();
});

createAccountModal.addEventListener('hidden.bs.modal', () => {
    document.getElementById('supplierName').value = '';
    document.getElementById('supplierPhone').value = '';
    hiddeError(createAccountModal);
});



createAccountForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    let formData = new FormData(createAccountForm);

    const data = {
        name: formData.get("name"),
        phone: formData.get('phone') || null,
    }
    // console.log(data);
    await createSupplierAccount(data);
});

editAccountForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    let formData = new FormData(editAccountForm);

    const data = {
        name: formData.get("name"),
        phone: formData.get('phone') || null,
    }
    // console.log(data);

    await editSupplierAccount(supplierId, data);


  
});




document.addEventListener("click", async function (e) {
    if (e.target.closest('.view-btn')) {
        const btn = e.target.closest('.view-btn');

        const id = btn.dataset.id;
        const name = btn.dataset.name;

        // window.location.href = `/admin/customer/depts.html?customer_id=${id}&customer_name=${name}`;

    }
});

document.addEventListener('submit', function (e) {
    const form = e.target;

    if (form.classList.contains('delete-account-form')) {
        const message = form.dataset.confirmMessage || 'هل أنت متأكد؟';
        bootboxConfirm(e, {
            message,
            onConfirm: deleteAccount
        });
    }
});





editAccountModal.addEventListener('hidden.bs.modal', () => {
    hiddeError(editAccountModal);
});


editAccountModal.addEventListener('show.bs.modal', async function (event) {
    const button = event.relatedTarget; // العنصر اللي كبست عليه
    supplierId = Number(button.getAttribute('data-id'));
    const supplierName = button.getAttribute('data-name');
    const supplierPhone = button.getAttribute('data-phone');

    document.getElementById('editSupplierName').value = supplierName;
    document.getElementById('editSupplierPhone').value = supplierPhone || '';

    

});





async function loadSuppliers() {
    hiddeError(tableContainer);
    showLoaderTable(tableBody);

    try {
        const res = await fetch(urlServer + '/suppliers', {
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
        else if (res.status === 200) {
            suppliers = data.suppliers;
            renderSuppliersTable();
        }
        else {
            displayError(tableContainer, data.message);
        }

    } catch (e) {
        displayError(tableContainer, e.message);
    }
}
function renderSuppliersTable() {
    if (!suppliers?.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لا يوجد حسابات للعرض</p>                
                </td>
            </tr>
        `;
        return;
    }

    const colors = [
        'primary',
        'success',
        'danger',
        'warning',
        'info',
        'secondary',
        'dark'
    ];



    tableBody.innerHTML = suppliers.map((supplier, index) => {
        const initials = supplier.name
            ?.slice(0, 2) || '';

        const color = colors[index % colors.length];
        return `
            <tr>
                <td class="text-center">${index + 1}</td>

                <td class="text-center">
                    <div class="d-flex  align-items-center">
                        <div class="avatar bg-${color} me-3">
                            ${initials}
                        </div>

                        <span>${supplier.name}</span>
                    </div>
                </td>
                <td class="text-center">${supplier?.phone || 'غير متوفر'}</td>
                <td class="text-center fw-bold">${supplier.balance}</td>
                <td>
                    ${supplier.balance > 0
                        ? `
                            <span class="text-danger fw-semibold">
                                <i class="fas fa-circle me-1"></i>
                               مستحق للمورد
                            </span>
                        `
                        : supplier.balance < 0
                            ? `
                            <span class="text-success fw-semibold">
                                <i class="fas fa-circle me-1"></i>
                                للمورد مستحقات لك
                            </span>
                        `
                            : `
                            <span class="text-secondary fw-semibold">
                                <i class="fas fa-check-circle me-1"></i>
                                الحساب مسدد
                            </span>
                        `
                    }
                </td>

                <td class="text-center">
                    <div class="btn-group">

                        <button 
                            type="button" 
                            class="btn btn-sm view-btn"
                            data-id="${supplier.id}"
                            data-name="${supplier.name}"
                            title="عرض الحساب"
                        >
                            <i class="fas fa-eye"></i>
                        </button>

                        <button 
                            type="button" 
                            class="btn btn-sm edit-btn edit-account-btn"
                            data-bs-toggle="modal"
                            data-bs-target="#editAccountModal"
                            data-id   ="${supplier.id}"
                            data-name = '${supplier.name}'
                            data-phone = '${supplier?.phone || ''}'
                            title="تعديل"
                        >
                            <i class="fas fa-pen-to-square"></i>
                        </button>

                        <form
                                class="delete-account-form"
                                data-confirm-message='
                                هل أنت متأكد من حذف هذا الحساب <strong>${supplier.name}</strong>؟
                                <div class="danger-box">
                                    سيتم حذف جميع البيانات المتعلقة بهذا الحساب !
                                </div>'
                            >
                            <button 
                                type="submit" 
                                class="btn btn-sm delete-btn w-100"
                                data-id="${supplier.id}"
                                title="حذف"
                            >
                                <i class="fas fa-trash"></i>
                            </button>
                        </form>

                    </div>
                </td>
            </tr>
        `;
    }).join('');
}




async function createSupplierAccount(supplierData) {
    showLader(overlayLoader);
    try {
        const res = await fetch(urlServer + '/supplier/add', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
            body: JSON.stringify(supplierData),
        });
        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }
        else if (res.status === 200) {
            await loadSuppliers();
            hiddeMolde(createAccountModal);
        }
        else {
            displayError(createAccountModal, data.message);
        }
    } catch (e) {
        displayError(createAccountModal, e.message);
    } finally {
        hiddeLoader(overlayLoader);
    }

}

async function editSupplierAccount(id, supplierData) {
    showLader(overlayLoader);
    try {
        const res = await fetch(urlServer + `/supplier/update?supplier_id=${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
            body: JSON.stringify(supplierData),
        });

        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }
        else if (res.status === 200) {
            bootboxSuccess(data.message);
            await loadSuppliers();
            hiddeMolde(editAccountModal);
        }
        else {
            displayError(editAccountModal, data.message);
        }
    } catch (e) {
        displayError(editAccountModal, e.message);
    } finally {
        hiddeLoader(overlayLoader);
    }
}


async function deleteAccount({ id }) {
    showLader(overlayLoader);

    const btn = document.querySelector(
        `button.delete-btn[data-id="${id}"]`
    );

    let success = false;

    try {
        const res = await fetch(
            urlServer + `/supplier/delete?supplier_id=${id}`,
            {
                method: 'DELETE',
                headers: {
                    "Authorization": getAuthToken('auth')
                }
            }
        );

        const data = await res.json();

        if (res.status === 401) {
            showAuthExpired(data.message);
            return;
        }

        if (res.status === 200) {
            success = true;
            bootboxSuccess(data.message);
            await loadSuppliers();
            return;
        }

        bootboxError(data.message);


    } catch (err) {
        displayError(tableContainer, err.message);

    } finally {
        hiddeLoader(overlayLoader);

        if (!success) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-trash"></i>`;
        }
    }
}



function hiddeMolde(modalId) {
    const modal = bootstrap.Modal.getInstance(modalId);
    modal.hide();
}
function displayError(container, message) {
    const errorCard = container.querySelector(`.error-card`);
    const errorMessage = container.querySelector(`.error-message`);
    errorCard.classList.remove('d-none');
    errorMessage.textContent = message;
}
function hiddeError(container) {
    const errorCard = container.querySelector(`.error-card`);
    const errorMessage = container.querySelector(`.error-message`);
    errorCard.classList.add('d-none');
    errorMessage.textContent = '';
}

function showLader(loader) {
    loader.classList.remove('d-none');
}
function hiddeLoader(loader) {
    loader.classList.add('d-none');
}
function showLoaderTable(tbody) {
    tbody.innerHTML = `
        <tr id="loading-row">
            <td colspan="100%" class="text-center py-5">
                <div class="d-flex flex-column align-items-center gap-2">
                    <div class="spinner-border text-primary" role="status"></div>
                    <span class="text-muted">جاري التحميل ...</span>
                </div>
            </td>
        </tr>
    `
}