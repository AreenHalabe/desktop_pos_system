
import { setAuthToken, setAdminId } from "../../component/auth.js";
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

    if(!urlEndPoint){
        const port = await window.electronAPI.getPort();
        setPortNumber(port);

        // urlEndPoint = `http://localhost:${port}`;
    }

    

    urlEndPoint = `http://localhost:${3000}`;

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


            window.location.href = './cashier/order/index.html';
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

    if (e.target.closest('.admin-login-btn')) {
        bootboxLogin();
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

    const dialog = bootbox.dialog({
        title: `
            <div class="admin-modal-title">
                <span>
                    <i class="fas fa-user-shield"></i>
                    تسجيل دخول الإدارة
                </span>
            </div>
        `,

        message: `
            <form id="admin-login-form">

                <div class="input-group mb-3">
                    <input
                        type="text"
                        class="form-control"
                        id="adminUsername"
                        name="username"
                        placeholder="اسم المستخدم"
                        autocomplete="username"
                        required
                    >

                    <span class="input-group-text">
                        <i class="fas fa-user"></i>
                    </span>
                </div>

                <div class="password-wrapper">

                    <i
                        class="fas fa-eye toggle-password"
                        data-target="adminPassword">
                    </i>

                    <div class="input-group mb-3">

                        <input
                            type="password"
                            class="form-control"
                            id="adminPassword"
                            name="password"
                            placeholder="كلمة سر الإدارة"
                            autocomplete="current-password"
                            required
                        >

                        <span class="input-group-text">
                            <i class="fas fa-lock"></i>
                        </span>

                    </div>

                </div>

                <div
                    id="error_list_modal"
                    class="alert alert-danger p-2 mt-3 d-none"
                >
                    <div
                        id="errors_modal"
                        class="mb-0 ps-3 text-danger">
                    </div>
                </div>

                <button
                    type="submit"
                    id="adminLoginBtn"
                    class="admin-modal-login-btn w-100"
                >
                    <i class="fas fa-right-to-bracket"></i>
                    تسجيل الدخول
                </button>

            </form>
        `,

        centerVertical: true,
        closeButton: false,

        buttons: {
            cancel: {
                label: 'إلغاء',
                className: 'btn-secondary'
            }
        }
    });

    // الآن dialog موجود
    dialog.on('shown.bs.modal', function () {

        const adminLoginForm =
            document.getElementById('admin-login-form');

        adminLoginForm.addEventListener("submit", async (e) => {

            // مهم جداً
            e.preventDefault();
            
            const loginBtn = document.getElementById('adminLoginBtn');

            disableLoginButton(loginBtn);

            
            const username =
                document.getElementById("adminUsername").value.trim();

            const password =
                document.getElementById("adminPassword").value;

            const formdata = {
                name: username,
                password: password
            };

            clearModalErrors();


            if(!urlEndPoint){
                const port = await window.electronAPI.getPort();
                setPortNumber(port);

                // urlEndPoint = `http://localhost:${port}`;
            }

            

            urlEndPoint = `http://localhost:${3000}`;

            try {

                const res = await fetch(
                    urlEndPoint + `/login-as-admin`,
                    {
                        method: 'POST',

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify(formdata)
                    }
                );

                const data = await res.json();

                if (res.status === 200) {

                    setAuthToken("auth", data.token);
                    setAdminId(data.id);

                    window.location.href =
                        './admin/category/home.html';

                    return;
                }

                displayModalError(data.message);

            } catch (err) {

                displayModalError(err.message);

            }finally {
                enableLoginButton(loginBtn);
            }

        });

    });
}
