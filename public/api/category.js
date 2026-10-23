 import { url } from "./urlEndPoint.js";
 import { getAuthToken , getAdminId} from "../component/auth.js";

 import { bootboxError } from "../component/bootbox.js";

export async function fetchCategories() {
  try {
      const res = await fetch(url + `/category/list?admin_id=${getAdminId()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (res.status != 200) {
        throw new Error(data.message);
      }
      return data;

    } catch (err) {
      bootboxError("حدث خطأ في الاتصال أثناء تحميل الفئات : " + err.message);
    }
}

export async function fetchMainCategories() {
  try {
      const res = await fetch( url + `/maincategory/list?admin_id=${getAdminId()}`, {
        method: 'GET',
        headers: {
            "Authorization": `${getAuthToken('auth')}`
        },
      });
      const data = await res.json();

      if (res.status != 200) {
        throw new Error(data.message);
      }
      
      return data;
    } catch (err) {
      bootboxError("حدث خطأ في الاتصال أثناء تحميل الفئات الرئيسية : " + err.message);
    }
}