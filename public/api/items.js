import { url } from "./urlEndPoint.js";
import { getAuthToken } from "../component/auth.js";
import { bootboxError } from "../component/bootbox.js";


let categoriesData = [];
let itemsData = [];
let customers = [];
export async function loadItemsAndCategoriesTree() {

    const isNotFirstTime = getStatusUser() === 'true';

    if (isNotFirstTime) {
        const cachedData = getItemsAndCategoriesCache();


        if (cachedData) {
            categoriesData = cachedData.categoriesData;
            itemsData = cachedData.itemsData;
        }

        return { categoriesData, itemsData };
    }


    const hasConnection = await hasInternetConnection();

    if (hasConnection) {
        const results = await Promise.all([
            loadCategoriesTree(),
            loadItemsTree()
        ]);
        console.log('loading from server .... ');

        if (results.every(result => result === true)) {
            setItemsAndCategories(itemsData, categoriesData);
            setStatusUser('true');
        } else {
            const cachedData = getItemsAndCategoriesCache();

            if (cachedData) {
                categoriesData = cachedData.categoriesData;
                itemsData = cachedData.itemsData;

            } else {
                bootboxError("فشل تحميل الأصناف والتصنيفات ولا توجد بيانات محلية.");
                return { categoriesData, itemsData };
            }
        }
    } else {
        const cachedData = getItemsAndCategoriesCache();

        if (cachedData) {
            categoriesData = cachedData.categoriesData;
            itemsData = cachedData.itemsData;
        } else {
            bootboxError("لا يوجد اتصال بالسيرفر ولا توجد بيانات محلية.");
            return { categoriesData, itemsData };
        }
    }




    return { categoriesData, itemsData };
}


export async function loadCustomers() {
    const isNotFirstTime = getStatusCustomers() === 'true';
    if (isNotFirstTime) {
        customers = getCustomerCash();
        return customers;
    }

    const hasConnection = await hasInternetConnection();

    if (hasConnection) {
       const result =  await loadCustomerInfo();
        console.log('loading customers from server .... ');
        if (result === true) {
            setCustomers(customers);
            setStatusCustomers('true');
        } else {
            customers = getCustomerCash();
        }
    } else {
        customers = getCustomerCash();
    }

    return customers;

}



async function loadCategoriesTree() {
    try {
        const res = await fetch(url + `/category/tree-for-supplier`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
        });
        const data = await res.json();

        if (res.status === 200) {
            categoriesData = data;
            document.getElementById("loadingMainCategory")?.remove();
            document.getElementById("loadingSubCategory")?.remove();
            return true;
        }
        else {
            bootboxError(data.message);
            return false;
        }

    } catch (err) {
        bootboxError("حدث خطأ في الاتصال : " + err.message);

        return false;
    }
}
async function loadItemsTree() {
    try {
        const res = await fetch(url + `/items/tree-for-cashier`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
        });
        const data = await res.json();

        if (res.status === 200) {
            itemsData = data;
            return true;
        }

        else {
            bootboxError(data.message);
            return false;
        }

    } catch (err) {
        bootboxError("حدث خطأ في الاتصال : " + err.message);
        return false;
    }
}
async function loadCustomerInfo() {
    try {
        const res = await fetch(url + `/customer/info`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('user-auth')}`
            },
        });
        const data = await res.json();

        if (res.status === 200) {
            customers = data.customers;
            return true;
        }

        else {
            bootboxError(data.message);
            return false;
        }

    } catch (err) {
        bootboxError("حدث خطأ في الاتصال : " + err.message);
        return false;
    }
}



export async function hasInternetConnection() {
    try {
        const response = await fetch(`${url}/test/connection`, {
            method: 'GET',
            cache: 'no-store',
            signal: AbortSignal.timeout(5000)
        });

        return response.ok ? true : false;

    } catch (error) {
        return false;
    }
}





export function setSessionId(sessionId) {
    localStorage.setItem(
        "SESSION_ID",
        sessionId
    );
}
export function getSessionId() {
    return localStorage.getItem("SESSION_ID");
}


function setItemsAndCategories(items, categories) {
    localStorage.setItem(
        "ITEMS",
        JSON.stringify(items)
    );

    localStorage.setItem(
        "CATEGORIES",
        JSON.stringify(categories)
    );
}
function getItemsAndCategoriesCache() {
    return {
        itemsData: JSON.parse(localStorage.getItem("ITEMS") || '[]'),
        categoriesData: JSON.parse(localStorage.getItem("CATEGORIES") || '[]')
    };
}




function setCustomers(customers) {
    localStorage.setItem(
        "CUSTOMERS",
        JSON.stringify(customers)
    );
}

function getCustomerCash() {
    return JSON.parse(localStorage.getItem("CUSTOMERS") || '[]');
}









function setStatusUser(status) {
    sessionStorage.setItem(
        "IS_FIRST_TIME",
        status
    );
}
function getStatusUser() {
    return sessionStorage.getItem("IS_FIRST_TIME");
}


function setStatusCustomers(status) {
    sessionStorage.setItem(
        "IS_LOADE_CUSTOMERS",
        status
    );
}
function getStatusCustomers() {
    return sessionStorage.getItem("IS_LOADE_CUSTOMERS");
}






export function clearItemsAndCategoriesCache() {
    localStorage.removeItem("ITEMS");
    localStorage.removeItem("CATEGORIES");
    sessionStorage.removeItem("IS_FIRST_TIME");
}

export function clearCustomersCash() {
    localStorage.removeItem("CUSTOMERS");
    sessionStorage.removeItem("IS_LOADE_CUSTOMERS");
}