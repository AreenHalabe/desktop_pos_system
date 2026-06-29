import { jwtVerify } from "jose";

export class SystemError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}



export async function checkToken(token){
  try{
    const secretKey  = process.env.SECRET_KEY;

    const secret = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(token, secret);
    const adminId = payload.adminId;
    return adminId;
  }catch(err){
    throw new SystemError('إنتهت صلاحية الدخول , الرجاء تسجيل الدخول مرة أخرى',401);
  }
}



export function buildTreeOfOrders(rows) {
  if (!rows || rows.length === 0) {
    return {
      complete_orders: [],
      deleted_orders: []
    };
  }

  const ordersMap = new Map();
  const completeOrders = [];
  const deletedOrders = [];

  for (const row of rows) {
    let order = ordersMap.get(row.id);

    if (!order) {
      order = {
        id: row.id,
        session_id: row.session_id,
        invoice_num: row.invoice_num,
        total_price: row.total_price,
        discount : row.discount,
        payment_method: row.payment_method,
        status: row.status,
        type: row.type,
        cancel_reason: row.cancel_reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
        items: []
      };

      ordersMap.set(row.id, order);



      if (row.status === "ملغي") {
        deletedOrders.push(order);
      }
      else{
        completeOrders.push(order);
      }


      
    }

    if (row.order_id) {
      order.items.push({
        order_item_id : row.order_item_id,
        order_id: row.order_id,
        item_id: row.item_id,
        item_name: row.item_name,
        quantity: row.quantity,
        price: row.price,
        size_name: row.size_name
      });
    }
  }

  return {
    complete_orders: completeOrders,
    deleted_orders: deletedOrders
  };
}
