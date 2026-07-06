
import { url } from "../../api/urlEndPoint.js";
import { getAuthToken, setAuthToken, setAdminId } from "../../component/auth.js";

const errorList    = document.getElementById('error_list');
const errorMessage = document.getElementById('errors');
const form         = document.getElementById('login-form');
const loginBtn          = document.getElementById('login-btn');

let adminId ;




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
            adminId = data.id;
            setAuthToken('user-auth',data.token);
            setAdminId(data.id);
            window.location.href = './cashier/order/index.html';
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