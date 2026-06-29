import { body, query } from "express-validator";
import { DateTime } from "luxon";
import { StatusCode } from "../HTTPSStatusCode/StatusCode.js";
import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError, buildTreeOfOrders } from "../shared/functionality.js";
import { getOrderAndItemsBySession } from "../shared/api.js";


export const getWeklyAnalysis = async(req , res) =>{
    try {
        const token = req.headers.authorization;
        if (!token){
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const body = req.body;

        const [
            ordersByDay,
            salesByItems,
            statisticsData
        ] = await Promise.all([
            getOrderByDay(body.from, body.to, body.timezone, adminId),
            getTopLeastSalesItems(body.from, body.to, adminId),
            getPreviousAnalysis(body.from, adminId)
        ]);
        
        return res.status(200).json({
            orders_by_day : ordersByDay,
            top_sales_items : salesByItems.slice(0, 5),
            statisticsData  : statisticsData,
        });

    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}


export const getFinancialAnalysis = async(req , res) =>{
    try {
        const token = req.headers.authorization;
        if (!token){
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const body = req.body;

        const sessions = await getSessionsDetails(body.from, body.to, adminId);

        return res.status(200).json({
            sessions
        });

    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}



export const getTransactionsForSessions = async(req , res) => {
    try {
        const token = req.headers.authorization;
        if (!token){
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const body = req.body;

        const sessionIds = body.session_ids;

        let transactions = [];

        if(sessionIds && sessionIds.length > 0){
            const request = pool.request();
            const params = sessionIds.map((id, index) => {
                const paramName = `id${index}`;
                request.input(paramName, sql.Int, id);
                return `@${paramName}`;
            });
            const result = await request
                .query(`
                    SELECT
                        amount,
                        type,
                        note,
                        created_at,
                        session_id
                    FROM transactions
                    WHERE session_id IN (${params.join(',')})
                    ORDER BY created_at DESC;
                `)
            ;
            transactions = result.recordset;
        }

        return res.status(200).json({
            transactions
        });

    } catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}

export const getItemsSellingAnalysis = async(req , res) => {
    try{

        const token = req.headers.authorization;
        if (!token){
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const row = await pool.request()
            .input('admin_id', sql.Int, adminId)
            .query(`
                SELECT
                    i.id,
                    ISNULL(i.name, N'عنصر محذوف') AS name,
                    ISNULL(SUM(oi.quantity), 0) AS quantity,
                    ISNULL(SUM(oi.price * oi.quantity), 0) AS total_sales,

                    ROUND(
                        ISNULL(SUM(oi.price * oi.quantity), 0) * 100.0 /
                        NULLIF(
                            SUM(SUM(oi.price * oi.quantity)) OVER (),
                            0
                        ),
                    2) AS sales_percentage,

                    SUM(SUM(oi.price * oi.quantity)) OVER () AS total_revenue

                FROM orders o
                INNER JOIN order_items oi
                    ON oi.order_id = o.id
                INNER JOIN items i
                    ON i.id = oi.item_id

                WHERE i.admin_id = @admin_id
                    AND o.status = N'مكتمل'
                GROUP BY i.id, i.name
                ORDER BY quantity DESC;
            `)
        ;
        const itemsAnalysis = row.recordset;

        return res.status(200).json({
            item_analysis : itemsAnalysis
        });

    }catch(e){
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}


export const getOrderAnalysis = async(req , res) => {
    try {
        const token = req.headers.authorization;
        if (!token){
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);
        const body = req.body;
        const from = body.from;
        const to   = body.to;

         const [
          orderDetails,
          orders
        ] = await Promise.all([
          getOrderDetails(from, to, adminId),
          loadOrders(from, to, 'مكتمل', adminId, 10, 0)
        ]);

        let mapItems = [];

        if(orders.length > 0){
          const orderIds = orders.map(o => o.id);
          const items    = await getItemsByOrders(orderIds);
          mapItems = mapItemByOrder(items, orders);
        }


        return res.status(200).json({
            orderDetails,
            mapItems
        });
    }catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }

}
export const loadMoreOrdersAnalysis = async(req , res) =>{
    try {
        const token = req.headers.authorization;
        if (!token){
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const body = req.body;
        const from       = body.from;
        const to         = body.to;
        let currentPage  = Number(body.page); 
        const status     = body.status;
        const totalOrder = Number(body.totalOrder);

        const limit      = 10;
        const totalPage = Math.ceil(totalOrder / limit);
        const offset    = (currentPage - 1) * limit;

        if(currentPage > totalPage){
          currentPage = totalPage;
        }
        let mapItems = [];
        const orders = await loadOrders(from, to, status, adminId, limit, offset);

        if(orders.length > 0){
          const orderIds = orders.map(o => o.id);
          const items    = await getItemsByOrders(orderIds);
          mapItems = mapItemByOrder(items, orders);
        }


        return res.status(200).json({
            mapItems,
            pagination:{
              total_page: totalPage,
              current_page : currentPage
            }
        });


    }catch (e) {
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}


export const getPerformanceAnalysis = async(req , res) =>{
    try {
        const token = req.headers.authorization;
        if (!token){
            throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
        }
        const adminId = await checkToken(token);

        const body = req.body;
        const from       = body.from;
        const to         = body.to;
        const timezone   = body.timezone;
        const [
          ordersByHours,
          orderByDay,
          salesByItems,
          statisticsData,
        ] = await Promise.all([
          getOrdersByHours(from, to, timezone, adminId),
          getOrderByDay(from, to, timezone, adminId),
          getTopLeastSalesItems(from, to, adminId),
          getDashboardMetrics(from, to, adminId)
        ]);

        return res.status(200).json({
            ordersByHours   : ordersByHours,
            orderByDay      : orderByDay,
            topSalesItems   : salesByItems.slice(0, 5),
            leastSalesItems : salesByItems.slice(-5),
            statisticsData  : statisticsData,
        });
       

    }catch(e){
        return res.status(e.status || 500).json({
            success: false,
            message: e.message || "حدث خطأ غير معروف",
        });
    }
}



async function getOrderByDay(from, to, timezone, adminId) {
    const row = await pool.request()
        .input('from', sql.DateTime2, from)
        .input('to', sql.DateTime2, to)
        .input('status' , 'مكتمل')
        .input('admin_id', sql.Int, adminId)
        .query(`
            SELECT 
                id,
                created_at,
                total_price
            FROM orders
            WHERE 
                created_at BETWEEN @from AND @to
                AND status = @status
                AND admin_id = @admin_id
            ORDER BY created_at;
        `)
    ;

    const grouped = groupOrdersByDay(row.recordset, timezone);

    return grouped;
}


async function getTopLeastSalesItems(from, to, adminId) {
    const result = await pool.request()
        .input('from', sql.DateTime2, from)
        .input('to', sql.DateTime2, to)
        .input('status', 'مكتمل')
        .input('admin_id', sql.Int, adminId)
        .query(`
            SELECT 
                ISNULL(i.name, N'عنصر محذوف') AS name,
                ISNULL(SUM(oi.quantity), 0) AS quantity,
                ROUND(
                    SUM(SUM(oi.quantity)) OVER (),
                    0
                ) AS total_qty
            FROM orders o
                INNER JOIN order_items oi
                    ON oi.order_id = o.id
                LEFT JOIN items i
                    ON i.id = oi.item_id
            WHERE o.created_at BETWEEN @from AND @to
                AND o.admin_id = @admin_id
                AND o.status = @status
            GROUP BY i.id, i.name
            ORDER BY quantity DESC
        `)
    ;

    return result.recordset;
}

async function getPreviousAnalysis(from, adminId) {

    const prevStartDate = previousUTC(from , 8);
    const prevEndDate   = previousUTC(from , 1);

    const result = await pool.request()
        .input('previousFrom', sql.DateTime, prevStartDate)
        .input('previousTo', sql.DateTime, prevEndDate)
        .input('status', 'مكتمل')
        .input('adminId', sql.Int, adminId)
        .query(`
            SELECT
                ISNULL(
                    SUM(
                        CASE
                            WHEN created_at BETWEEN @previousFrom AND @previousTo
                            AND status = @status
                            THEN total_price
                            ELSE 0
                        END
                    ),
                    0
                ) AS previous_revenue,

                COUNT(
                    CASE
                        WHEN created_at BETWEEN @previousFrom AND @previousTo
                        THEN 1
                    END
                ) AS previous_total_orders
            FROM orders
            WHERE admin_id = @adminId;
        `)
    ;

    return result.recordset[0];
}


async function getSessionsDetails(from, to, adminId) {
    const result = await pool.request()
    .input('admin_id', sql.Int, adminId)
    .input('from', sql.DateTime2, from)
    .input('to', sql.DateTime2, to)
    .query(`
        SELECT
            cs.id AS session_id,
            cs.opening_cash,
            cs.expected_cash,
            cs.actual_cash,
            cs.difference,
            cs.open_at,
            cs.closed_at,

            ISNULL(o.cash_sales, 0) AS cash_sales,
            ISNULL(o.card_sales, 0) AS card_sales,

            ISNULL(t.cash_out, 0) AS cash_out,
            ISNULL(t.cash_in, 0) AS cash_in,

            ISNULL(o.completed_orders_count, 0) AS completed_orders_count,
            ISNULL(o.canceled_orders_count, 0) AS canceled_orders_count
        FROM cash_sessions cs

        LEFT JOIN (
            SELECT
                session_id,
                SUM(CASE WHEN payment_method = N'كاش' AND status = N'مكتمل' THEN total_price ELSE 0 END) AS cash_sales,
                SUM(CASE WHEN payment_method = N'بطاقة' AND status = N'مكتمل' THEN total_price ELSE 0 END) AS card_sales,
                SUM(CASE WHEN status = N'مكتمل' THEN 1 ELSE 0 END) AS completed_orders_count,
                SUM(CASE WHEN status = N'ملغي' THEN 1 ELSE 0 END) AS canceled_orders_count
            FROM orders
            GROUP BY session_id
        ) o ON o.session_id = cs.id

        LEFT JOIN (
            SELECT
                session_id,
                SUM(CASE WHEN type = N'سحب' THEN amount ELSE 0 END) AS cash_out,
                SUM(CASE WHEN type = N'إضافة' THEN amount ELSE 0 END) AS cash_in
            FROM transactions
            GROUP BY session_id
        ) t ON t.session_id = cs.id

        WHERE cs.admin_id = @admin_id
          AND cs.open_at >= @from
          AND cs.open_at <= @to
          AND (
                cs.closed_at IS NULL
                OR cs.closed_at <= @to
              )
        ORDER BY cs.open_at ASC
    `);

    return result.recordset;
}


async function loadOrders(from, to, status, adminId, limit, offset){
    const result = await pool.request()
        .input('from', sql.DateTime2, from)
        .input('to', sql.DateTime2, to)
        .input('status', sql.NVarChar, status)
        .input('admin_id', sql.Int, adminId)
        .input('limit', sql.Int, limit)
        .input('offset', sql.Int, offset)
        .query(`
            SELECT *
            FROM orders
            WHERE created_at BETWEEN @from AND @to
                AND status = @status
                AND admin_id = @admin_id
            ORDER BY created_at DESC
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `)
    ;

    return result.recordset;
}



async function getOrderDetails(from, to, adminId) {
    const result = await pool.request()
    .input('from', sql.DateTime2, from)
    .input('to', sql.DateTime2, to)
    .input('admin_id', sql.Int, adminId)
    .query(`
        SELECT
            SUM(
                CASE
                    WHEN created_at BETWEEN @from AND @to
                         AND status = N'مكتمل'
                         AND payment_method = N'كاش'
                    THEN total_price
                    ELSE 0
                END
            ) AS cash_revenue,

            SUM(
                CASE
                    WHEN created_at BETWEEN @from AND @to
                         AND status = N'مكتمل'
                         AND payment_method = N'بطاقة'
                    THEN total_price
                    ELSE 0
                END
            ) AS card_revenue,

            COUNT(
                CASE
                    WHEN created_at BETWEEN @from AND @to
                         AND status = N'مكتمل'
                    THEN 1
                END
            ) AS completed_orders,

            COUNT(
                CASE
                    WHEN created_at BETWEEN @from AND @to
                         AND status = N'ملغي'
                    THEN 1
                END
            ) AS cancelled_orders
        FROM orders
        WHERE admin_id = @admin_id
    `);

    return result.recordset[0];
}


async function getItemsByOrders(orderIds) {
    const request = pool.request();

    const params = orderIds.map((id, index) => {
        const name = `id${index}`;
        request.input(name, sql.Int, id);
        return `@${name}`;
    });

    const result = await request.query(`
        SELECT 
            io.*,
            i.name AS item_name
        FROM order_items io
        LEFT JOIN items i 
            ON io.item_id = i.id
        WHERE io.order_id IN (${params.join(',')})
    `);

    return result.recordset;
}


async function getOrdersByHours(from, to, timezone, adminId) {
    const row = await pool.request()
        .input('from', sql.DateTime2, from)
        .input('to', sql.DateTime2, to)
        .input('admin_id', sql.Int, adminId)
        .query(`
            SELECT 
                id,
                created_at,
                total_price
            FROM orders
            WHERE 
                created_at BETWEEN @from AND @to
                AND status = N'مكتمل'
                AND admin_id = @admin_id
            ORDER BY created_at;
        `)
    ;

    const grouped = groupOrdersByHour(row.recordset, timezone);

    return grouped;
}



async function getDashboardMetrics(from, to, adminId) {
    const dayDiff = getDaysDiff(from , to);

    const previosFrom = previousUTC(from, dayDiff);
    const previosTo   = previousUTC(from, 1);

    const row = await pool.request()
    .input('from', sql.DateTime2, from)
    .input('to', sql.DateTime2, to)
    .input('previousFrom', sql.DateTime2, previosFrom)
    .input('previousTo', sql.DateTime2, previosTo)
    .input('admin_id', sql.Int, adminId)
    .query(`
        SELECT
            SUM(CASE 
                WHEN created_at BETWEEN @from AND @to 
                 AND type = N'طاولة' 
                THEN 1 ELSE 0 
            END) AS table_orders,

            SUM(CASE
                WHEN created_at BETWEEN @from AND @to 
                 AND type = N'سفري' 
                THEN 1 ELSE 0 
            END) AS delivery_orders,

            CAST(
                SUM(CASE 
                    WHEN type = N'سفري' 
                     AND created_at BETWEEN @from AND @to 
                    THEN 1 ELSE 0 
                END) * 100.0
                / NULLIF(
                    SUM(CASE 
                        WHEN created_at BETWEEN @from AND @to 
                        THEN 1 ELSE 0 
                    END),
                0)
            AS INT) AS delivery_percentage,

            CAST(
                SUM(CASE 
                    WHEN type = N'طاولة' 
                     AND created_at BETWEEN @from AND @to 
                    THEN 1 ELSE 0 
                END) * 100.0
                / NULLIF(
                    SUM(CASE 
                        WHEN created_at BETWEEN @from AND @to 
                        THEN 1 ELSE 0 
                    END),
                0)
            AS INT) AS table_percentage,

            SUM(CASE 
                WHEN created_at BETWEEN @from AND @to 
                 AND status = N'مكتمل'
                 AND payment_method = N'كاش'
                THEN total_price ELSE 0 
            END) AS cash_revenue,

            SUM(CASE 
                WHEN created_at BETWEEN @from AND @to 
                 AND status = N'مكتمل'
                 AND payment_method = N'بطاقة'
                THEN total_price ELSE 0 
            END) AS card_revenue,

            COUNT(CASE 
                WHEN created_at BETWEEN @from AND @to 
                 AND status = N'مكتمل'
                THEN 1 END
            ) AS completed_orders,

            COUNT(CASE 
                WHEN created_at BETWEEN @from AND @to 
                 AND status = N'ملغي'
                THEN 1 END
            ) AS cancelled_orders,

            SUM(CASE 
                WHEN created_at BETWEEN @previousFrom AND @previousTo 
                 AND status = N'مكتمل'
                THEN total_price ELSE 0 
            END) AS previous_revenue,

            COUNT(CASE 
                WHEN created_at BETWEEN @previousFrom AND @previousTo 
                THEN 1 END
            ) AS previous_total_orders

        FROM orders
        WHERE admin_id = @admin_id;
    `);

    return row.recordset[0];
}


function groupOrdersByDay(rows, userTimezone) {
  const resultMap = {};

  for (const row of rows) {
    // 1. نحول من UTC إلى وقت المستخدم
    const localTime = DateTime
      .fromISO(row.created_at.toISOString(), { zone: "utc" })
      .setZone(userTimezone);

    // 2. نطلع اسم اليوم
    const dayKey = localTime.setLocale('ar').toFormat('cccc');
    // أو localTime.toFormat('cccc')

    // 3. grouping
    if (!resultMap[dayKey]) {
      resultMap[dayKey] = {
        day_name: dayKey,
        orders_count: 0,
        total_sales: 0
      };
    }

    resultMap[dayKey].orders_count += 1;
    resultMap[dayKey].total_sales += Number(row.total_price);
  }

  return Object.values(resultMap);
}



function groupOrdersByHour(rows, userTimezone) {
  const resultMap = {};

  for (const row of rows) {
    // UTC → user timezone
    const localTime = DateTime
      .fromJSDate(row.created_at, { zone: "utc" })
      .setZone(userTimezone);

    // نطلع الساعة
    const hourKey = localTime.toFormat('HH'); // 00 - 23

    if (!resultMap[hourKey]) {
      resultMap[hourKey] = {
        hour: hourKey,
        orders_count: 0,
        total_sales: 0
      };
    }

    resultMap[hourKey].orders_count += 1;
    resultMap[hourKey].total_sales += Number(row.total_price);
  }

  return Object.values(resultMap).sort((a, b) => a.hour - b.hour);
}

function mapItemByOrder(items, orders){
  if(orders.length === 0) return;

  const itemsMap = {};

  items.forEach(i => {
    if (!itemsMap[i.order_id]) {
      itemsMap[i.order_id] = [];
    }
    itemsMap[i.order_id].push(i);
  });

  const ordersWithItems = orders.map(order => ({
    ...order,
    items: itemsMap[order.id] || []
  }));

  return ordersWithItems;
}


function getDaysDiff(from, to) {
    const start = new Date(from);
    const end = new Date(to);

    const diffTime = end - start;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}



function previousUTC(utcDateString, days) {
  const date = new Date(utcDateString);

  // نحسب بالـ UTC مباشرة
  date.setUTCDate(date.getUTCDate() - days);

  return date.toISOString();
}