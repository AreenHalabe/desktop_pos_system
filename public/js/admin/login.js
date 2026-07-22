
// import { getAuthToken, setAuthToken, setAdminId } from "../../component/auth.js";
// import { setPortNumber} from "../../../env.js";
// const errorList    = document.getElementById('error_list');
// const errorMessage = document.getElementById('errors');
// const form         = document.getElementById('login-form');
// const loginBtn          = document.getElementById('login-btn');


// let adminId ;
// let urlEndPoint;
// const loginModalEl = document.getElementById('loginModal');

// loginModalEl.addEventListener('hidden.bs.modal', function () {
//     enableLoginButton();
// });



// form.addEventListener('submit', async (e) => {
//     e.preventDefault();
//     clearErrors();
//     disableLoginButton();
//     const formdata = {
//         name: form.name.value,
//         password: form.password.value
//     };

//     const port = await window.electronAPI.getPort();
//     setPortNumber(port);

//     const url = `http://localhost:${port}`;
    
//     try{
//         const res = await fetch(url + '/login-as-admin', {
//             method: 'POST',
//             headers: {
//                 "Content-Type": "application/json"
//             },
//             body: JSON.stringify(formdata),
//             credentials: 'include'
//         });
//         const data = await res.json();

        
//         if (res.status === 200) {
//             adminId = data.id;
//             setAuthToken('auth',data.token);
//             setAdminId(data.id);
//             window.location.href = './admin/category/home.html';
//             return;
//         }
//         else if(res.status === 403){
//             bootbox.alert({
//                 title: "⚠️ تنبيه",
//                 message: data.message,
//                 centerVertical: true,
//                 backdrop: true,
//                 className: "fs-6"
//             });
//         }
//         else {
//             errorList.style.display = 'block';
//             errorMessage.innerHTML = data.message;
//         }
//     }
//     catch(error){
//         errorList.style.display = 'block';
//         errorMessage.innerHTML = `${error.message}`;
//     }finally{
//         enableLoginButton();
//     }



// });






// function disableLoginButton() {
//     loginBtn.disabled = true;
//     loginBtn.innerHTML = 'جاري تسجيل الدخول...';
// }

// function enableLoginButton() {
//     loginBtn.disabled = false;
//     loginBtn.innerHTML = 'تسجيل الدخول';
// }

// function clearErrors() {
//     errorMessage.innerHTML = '';
//     errorList.style.display = 'none';
// }




// function displayModalError(message) {
//     const errorListModal = document.getElementById('error_list_modal');
//     const errorMessageModal = document.getElementById('errors_modal');
//     errorListModal.classList.remove('d-none');
//     errorMessageModal.textContent = message;
// }

// function clearModalErrors() {
//     const errorListModal = document.getElementById('error_list_modal');
//     const errorMessageModal = document.getElementById('errors_modal');
//     errorMessageModal.textContent = '';
//     errorListModal.classList.add('d-none');
// }



// const password = document.getElementById("password");
// const toggle = document.getElementById("togglePassword");

// toggle.addEventListener("click", () => {

//     if (password.type === "password") {
//         password.type = "text";
//         toggle.classList.replace("fa-eye", "fa-eye-slash");
//     } else {
//         password.type = "password";
//         toggle.classList.replace("fa-eye-slash", "fa-eye");
//     }

// });




import { getAuthToken, setAuthToken, setAdminId } from "../../component/auth.js";
import { setPortNumber } from "../../../env.js";
const errorList = document.getElementById('error_list');
const errorMessage = document.getElementById('errors');
const form = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');



let adminId;
let urlEndPoint;
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

    const port = await window.electronAPI.getPort();
    setPortNumber(port);

    urlEndPoint = `http://localhost:${port}`;

    try {
        const res = await fetch(urlEndPoint + '/login', {
            method: 'POST',
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(formdata),
        });
        const data = await res.json();


        if (res.status === 200) {
            adminId = data.id;
            // setAuthToken('auth',data.token);
            setAuthToken('user-auth', data.token);
            setAdminId(data.id);

            openRoleModal();

            //window.location.href = './admin/category/home.html';
            return;
        }
        else if (res.status === 403) {
            bootbox.alert({
                title: "⚠️ تنبيه",
                message: data.message,
                centerVertical: true,
                backdrop: true,
                className: "fs-6"
            });
        }
        else {
            enableLoginButton();
            errorList.style.display = 'block';
            errorMessage.innerHTML = data.message;
        }
    }
    catch (error) {
        enableLoginButton();
        errorList.style.display = 'block';
        errorMessage.innerHTML = `${error.message}`;
    }

});


document.addEventListener('click', async function (e) {

    if (e.target.closest('#adminLoginBtn')) {
        const adminPassword = document.getElementById('adminPassword').value.trim();
        await loginAsAdmin(adminPassword);
        return;
    };

    if (e.target.closest('.role-btn')) {
        const btn = e.target.closest('.role-btn');
        if (!btn) return;

        const role = btn.getAttribute('data-role');

        if (role === "admin") {
            bootboxLogin();
        } else {
            window.location.href = './cashier/order/index.html';
        }

        const modal = bootstrap.Modal.getInstance(loginModalEl);
        modal.hide();

        return;
    }

    if (e.target.closest('.toggle-password')) {
        const toggle = e.target.closest('.toggle-password');

        if (toggle) {
            const input = document.getElementById(toggle.dataset.target);

            if (input.type === "password") {
                input.type = "text";
                toggle.classList.replace("fa-eye", "fa-eye-slash");
            } else {
                input.type = "password";
                toggle.classList.replace("fa-eye-slash", "fa-eye");
            }
        }
    }


});


async function loginAsAdmin(adminPassword) {
    clearModalErrors();


    try {
        const res = await fetch(urlEndPoint + `/login-as-admin`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(
                {
                    id: adminId,
                    password: adminPassword
                }
            ),
        });

        const data = await res.json();

        if (res.status === 200) {
            setAuthToken("auth", data.token);
            window.location.href = './admin/category/home.html';
            return;
        }
        else if (res.status === 403) {
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
    } catch (err) {
        displayModalError(err.message);
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


function openRoleModal() {
    const modal = new bootstrap.Modal(loginModalEl);
    modal.show();
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
            <div class="password-wrapper">
                <i class="fas fa-eye toggle-password" data-target="adminPassword"></i>
                <div class="input-group mb-4">
                    <input type="password"  class="form-control" id="adminPassword" 
                        placeholder="كلمة سر الآدمن" autocomplete="current-password" required>
 
                    <span class="input-group-text">
                        <i class="fas fa-user-lock text-primary"></i>
                    </span>
                </div>
            </div>

           

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

//  <input type="password" id="adminPassword"  
//                 class="form-control mb-3" dir='ltr'
//                 placeholder="أدخل كلمة سر الأدمن" required></input>

