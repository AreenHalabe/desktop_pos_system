 import { url } from "./urlEndPoint.js";
 import { getAuthToken } from "../component/auth.js";
 import { bootboxError } from "../component/bootbox.js";


let categoriesData = [];
let itemsData = [];

export async function loadItemsAndCategoriesTree() {

    // قراءة البيانات من الذاكرة المشتركة
    const cachedData = await window.electronAPI.getPosTreeCache();

    if (cachedData.categoriesData.length > 0 && cachedData.itemsData.length > 0) {
        console.log("Loading categories and items from cache...");
        categoriesData = cachedData.categoriesData;
        itemsData = cachedData.itemsData;
        return {
            categoriesData,
            itemsData
        };
    }
    console.log("Loading categories and items from API...");
    await Promise.all([
        loadCategoriesTree(),
        loadItemsTree()
    ]);

    if (categoriesData.length > 0 && itemsData.length > 0) {
        await window.electronAPI.setPosTreeCache({
            categoriesData,
            itemsData
        });
    }

    return {
        categoriesData,
        itemsData
    };
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
        }
        else {
            bootboxError(data.message);
        }

    } catch (err) {
        bootboxError("حدث خطأ في الاتصال : " + err.message);
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
        }

        else {
            bootboxError(data.message);
        }

    } catch (err) {
        bootboxError("حدث خطأ في الاتصال : " + err.message);
    }
}