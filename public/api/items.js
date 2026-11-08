import { url } from "./urlEndPoint.js";
import { getAuthToken } from "../component/auth.js";
import { bootboxError } from "../component/bootbox.js";


let categoriesData = [];
let itemsData = [];

export async function loadItemsAndCategoriesTree() {

    const isNotFirstTime = getStatusUser() === 'true';

    if (isNotFirstTime) {
        console.log('loading items from cash.... ');
        const cachedData = getItemsAndCategoriesCache();

        if (cachedData) {
            categoriesData = cachedData.categoriesData;
            itemsData = cachedData.itemsData;
        }
        return { categoriesData, itemsData };
    }


    else{
        console.log('loading items from server.... ');
        const results = await Promise.all([
            loadCategoriesTree(),
            loadItemsTree()
        ]);
        if (results.every(result => result === true)) {
            setItemsAndCategories(itemsData, categoriesData);
            setStatusUser('true');
        } 

        return { categoriesData, itemsData };
    } 


    
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






function setStatusUser(status) {
    sessionStorage.setItem(
        "IS_FIRST_TIME",
        status
    );
}
function getStatusUser() {
    return sessionStorage.getItem("IS_FIRST_TIME");
}





export function clearItemsAndCategoriesCache() {
    localStorage.removeItem("ITEMS");
    localStorage.removeItem("CATEGORIES");
    sessionStorage.removeItem("IS_FIRST_TIME");
}