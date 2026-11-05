 import { url } from "./urlEndPoint.js";
 import { getAuthToken } from "../component/auth.js";
 import { bootboxError } from "../component/bootbox.js";


 let categoriesData = [];
 let itemsData = [];


export async function loadItemsAndCategoriesTree() {

    if(categoriesData.length > 0 && itemsData.length > 0) {
        console.log("not loading");
        return {
            categoriesData,
            itemsData
        }
    }

    else {
        console.log("Loading categories and items tree...");
        await Promise.all([
            loadCategoriesTree(),
            loadItemsTree()
        ]);

        return {
            categoriesData,
            itemsData
        }
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