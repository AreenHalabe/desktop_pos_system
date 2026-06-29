import { setAuthToken, getAdminId } from "../../component/auth.js";


export function bootboxLoginAsAdmin() {
  bootbox.dialog({
    title: `
      <div class="d-flex justify-content-between align-items-center">
        <span class="fw-bold text-primary">
          <i class="bi bi-box-arrow-in-right ms-2"></i>
          تسجيل دخول لحساب الإدارة
        </span>
      </div>
    `,
    message: `
      <div class="text-center admin-login-modal">

        <input  id="adminPassword" dir=ltr  
          type="password"     class="form-control mb-3" 
               placeholder="أدخل كلمة السر" required>

        <button class="btn btn-primary switch-admin-btn" style="width:70%">
          تسجيل الدخول
        </button>

        <div id="error_list_modal" class="alert alert-danger p-2 mt-3 d-none">
          <div id="errors_modal" class="mb-0 ps-3 text-danger"></div>
        </div>

      </div>
    `,
    centerVertical: true,
    closeButton: false,
    buttons: {
        cancel: {
            label: 'إلغاء',
            className: 'btn-secondary'
        }
    },
  });

}

export function closeSideBar(){
    const sidebar = document.getElementById('sidebar');
    const offcanvas = bootstrap.Offcanvas.getOrCreateInstance(sidebar);
    offcanvas.hide();
}

export async function SwitchToAdmin(url , password) {
  if(password === '' || password === ' '){
    displayModalError('يجب إدخال كلمة السر');
    return;
  }
  const adminId = getAdminId();
  
  try{
    const res = await fetch(url + `/login-as-admin?admin_id=${adminId}`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ admin_password: password }),
    });

    const data = await res.json();

    if (res.status === 200) {
      setAuthToken("auth", data.token);
      window.location.href = '../../admin/category/home.html';
      return;
    }
    else if(res.status === 403){
     displayModalError(data.message);
    }
    else {
      displayModalError(data.message);
    }
  }catch(err){
    displayModalError(err.message);
  }
}

function displayModalError(message) {
  const errorListModal = document.getElementById('error_list_modal');
  const errorMessageModal = document.getElementById('errors_modal');
  errorListModal.classList.remove('d-none');
  errorMessageModal.textContent = message;
}