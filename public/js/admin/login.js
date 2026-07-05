
import { url } from "../../api/urlEndPoint.js";
import { getAuthToken, setAuthToken, setAdminId } from "../../component/auth.js";

const errorList    = document.getElementById('error_list');
const errorMessage = document.getElementById('errors');
const form         = document.getElementById('login-form');
const loginBtn          = document.getElementById('login-btn');
//const workerBase = 'http://127.0.0.1:8787';

let adminId ;

const loginModalEl = document.getElementById('loginModal');

loginModalEl.addEventListener('hidden.bs.modal', function () {
    enableLoginButton();
});



form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    disableLoginButton();
    const formdata = {
        name: form.name.value,
        password: form.password.value
    };
    
    try{
        const res = await fetch(url + '/login', {
            method: 'POST',
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(formdata),
            credentials: 'include'
        });
        const data = await res.json();
        
        if (res.status === 200) {
            //await checkAdminAuth(data.id , data.token);
            adminId = data.id;
            setAuthToken('user-auth',data.token);
            setAdminId(data.id);
            openRoleModal();
            return;
        }
        else if(res.status === 403){
            bootbox.alert({
                title: "⚠️ تنبيه",
                message: data.message,
                centerVertical: true,
                backdrop: true,
                className: "fs-6"
            });
        }
        else {
            errorList.style.display = 'block';
            errorMessage.innerHTML = data.message;
        }
    }
    catch(error){
        errorList.style.display = 'block';
        errorMessage.innerHTML = `${error.message}`;
    }finally{
        enableLoginButton();
    }

});



document.addEventListener('click', async function (e) {

    if(e.target.closest('#adminLoginBtn')){
        const adminPassword = document.getElementById('adminPassword').value.trim();
        await loginAsAdmin(adminPassword);
    };

    if(e.target.closest('.role-btn')){
        const btn = e.target.closest('.role-btn');
        if (!btn) return;
        
        const role = btn.getAttribute('data-role');

        if(role === "admin") {
            bootboxLogin();
        } else {
            window.location.href = './cashier/order/index.html';
        }

        const modal = bootstrap.Modal.getInstance(loginModalEl);
        modal.hide();

    }


});



async function checkAdminAuth(adminId , token) {
    try{
        const res = await fetch(`/api/admin/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: adminId }),
        });

        const data = await res.json();

        if(res.status === 200){

            setAuthToken('user-auth',token);
            setAdminId(adminId);
            openRoleModal();
            return ;
        }
        else{
            throw new Error(data.message);
        }

    }catch(err){
        errorList.style.display = 'block';
        errorMessage.innerHTML = `${err.message}`;
    }
}
    

function disableLoginButton() {
    loginBtn.disabled = true;
    loginBtn.innerHTML = 'جاري تسجيل الدخول...';
}

function enableLoginButton() {
    loginBtn.disabled = false;
    loginBtn.innerHTML = 'تسجيل الدخول';
}

function clearErrors() {
    errorMessage.innerHTML = '';
    errorList.style.display = 'none';
}

function openRoleModal(){
    const modal = new bootstrap.Modal(loginModalEl);
    modal.show();
}

function bootboxLogin() {
  bootbox.dialog({
    title: `
      <div class="d-flex justify-content-between align-items-center">
        <span class="fw-bold text-primary">
          <i class="bi bi-box-arrow-in-right ms-2"></i>
          تسجيل الدخول
        </span>
      </div>
    `,
    message: `
      <div class="text-center">

        <input type="password" id="adminPassword"  dir= ltr
               class="form-control  mb-3" 
               placeholder="أدخل كلمة سر الأدمن" required>

        <button id="adminLoginBtn" class="btn btn-primary w-100">
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

async function loginAsAdmin(adminPassword) {
    clearModalErrors();
    try{
        const res = await fetch(url + `/login-as-admin?admin_id=${adminId}`, {
            method: 'POST',
            body: JSON.stringify({ admin_password: adminPassword }),
            headers: {
                "Content-Type": "application/json"
            },
            credentials: 'include',
        });

        const data = await res.json();

        if (res.status === 200) {
            setAuthToken("auth", data.token);
            window.location.href = './admin/category/home.html';
            return;
        }
        else if(res.status === 403){
            bootbox.alert({
                title: "⚠️ تنبيه",
                message: data.message,
                centerVertical: true,
                backdrop: true,
                className: "fs-6"
            });

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

function clearModalErrors() {
    const errorListModal = document.getElementById('error_list_modal');
    const errorMessageModal = document.getElementById('errors_modal');
    errorMessageModal.textContent = '';
    errorListModal.classList.add('d-none');
}



const password = document.getElementById("password");
const toggle = document.getElementById("togglePassword");

toggle.addEventListener("click", () => {

    if (password.type === "password") {
        password.type = "text";
        toggle.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        password.type = "password";
        toggle.classList.replace("fa-eye-slash", "fa-eye");
    }

});