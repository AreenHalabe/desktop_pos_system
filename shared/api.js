
export async function getTransactionsBySession(sessionId, pool, sql) {
    const result = await pool
        .request()
        .input('session_id', sql.Int, sessionId)
        .query(`
            SELECT * 
            FROM transactions 
            WHERE session_id = @session_id
            ORDER BY created_at DESC;
        `)
    ;
    return result.recordset;
}


export async function getOrderAndItemsBySession(sessionId, pool, sql) {

    const result = await pool
        .request()
        .input('session_id', sql.Int, sessionId)
        .query(`
            SELECT
                o.*,
                io.id AS order_item_id,
                io.order_id,
                io.item_id,
                io.quantity,
                io.price,
                io.size_name,
                io.discount_item,
                i.name AS item_name
            FROM orders o

            LEFT JOIN order_items io
                ON o.id = io.order_id

            LEFT JOIN Items i
                ON io.item_id = i.id

            WHERE o.session_id = @session_id
            OR (
                o.session_id IS NULL
                AND o.created_at >= DATEADD(DAY, -1, CAST(GETDATE() AS DATE))
                AND o.created_at < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
            )

            ORDER BY o.created_at DESC;
        `);

    return result.recordset;
}


export async function checkSession(adminId, pool, sql) {
    const session = await pool
        .request()
        .input("admin_id", sql.Int, adminId)
        .query(`
            SELECT TOP 1 *
            FROM cash_sessions
            WHERE closed_at IS NULL
            AND admin_id = @admin_id
        `)
        ;
    return session.recordset[0] || null;
}


export async function getCashSummery(sessionId, pool, sql) {
    const result = await pool
        .request()
        .input("session_id", sql.Int, sessionId)
        .query(`
            WITH orders_sum AS (
                SELECT
                    COALESCE(
                        SUM(
                            CASE
                                WHEN payment_method = N'كاش'
                                THEN amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS cash_sales,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN payment_method = N'بطاقة'
                                THEN amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS card_sales

                FROM order_payments

                WHERE session_id = @session_id
            ),
            transactions_sum AS (
                SELECT
                    SUM(CASE WHEN type = N'سحب' THEN amount ELSE 0 END) AS cash_out,
                    SUM(CASE WHEN type = N'إضافة' THEN amount ELSE 0 END) AS cash_in
                FROM transactions
                WHERE session_id = @session_id
            )
            SELECT *
            FROM orders_sum
            CROSS JOIN transactions_sum
        `);

    return result.recordset[0];
}
