import { StatusCode } from "../HTTPSStatusCode/StatusCode.js";
import { pool, sql } from "../DataBaseConnections/dbconnection.js";
import { checkToken, SystemError } from "../shared/functionality.js";
import { z } from "zod";


export const getItem = async (req, res) => {
  const itemId = Number(req.query.item_id);

  try {
    const token = req.headers.authorization;
    if (!token) {
      throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
    }
    await checkToken(token);

    const itemResult = await pool.request()
      .input("id", itemId)
      .query(`
        SELECT *
        FROM items
        WHERE id = @id  
      `)
      ;
    const item = itemResult.recordset[0];



    if (item.price === null) {
      const variants = await getSizes(item.id);
      item.variants = variants;
    }

    return res.status(200).json({
      success: true,
      item: item,
    });

  } catch (e) {
    if (e?.originalError?.info?.message?.includes("Violation of UNIQUE KEY constraint")) {
      return res.status(409).json({
        message: "إسم الصنف موجود مسبقأ الرجاء إدخال إسم آخر"
      });
    }
    return res.status(e.status || 500).json({
      success: false,
      message: e.message || "حدث خطأ غير معروف",
    });
  }
}

export const addItem = async (req, res) => {
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;
  try {
    const token = req.headers.authorization;
    if (!token) {
      throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
    }
    const adminId = await checkToken(token);

    const body = req.body;

    const hasVariants = body.has_variants === "1";

    let variants = null;

    if (hasVariants) {
      variants = {
        size: body.variantsSize,
        price: body.variantsPrice
      };
    }

    const schema = buildProductSchema(hasVariants);

    const rawData = {
      name: body.name,
      category_id: body.category_id,
      price: body.price || null,
      barcode: body.barcode,
      hasVariants,
      variants
    };




    const validated = schema.safeParse(rawData);

    if (!validated.success) {
      const errors = validated.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));

      return res.status(400).json({
        success: false,
        errors,
      });
    }



    if(validated.data.barcode) {
      const item = await checkBarcode(validated.data.barcode);
      if (item) {
        throw new SystemError("خطأ : الباركود المدخل مُعرف لصنف آخر , الرجاء إدخال باركود مختلف ", 409);
      }
    }

    // 🔥 start transaction
    await transaction.begin();
    transactionStarted = true;

    const result = await transaction
      .request()
      .input("name", sql.NVarChar, validated.data.name)
      .input("category_id", sql.Int, validated.data.category_id)
      .input("price", sql.Int, validated.data.price)
      .input('barcode', sql.VarChar, validated.data.barcode)
      .input("admin_id", sql.Int, adminId)
      .query(`
        INSERT INTO items (name, category_id, price, barcode, admin_id)
        OUTPUT INSERTED.id
        VALUES (@name, @category_id, @price, @barcode, @admin_id)
      `)
      ;


    const itemId = result.recordset[0].id;

    if (hasVariants) {
      await insertSizes(itemId, rawData, transaction)
    }

    await transaction.commit();


    return res.status(200).json({
      success: true,
      message: "تم إنشاء الصنف بنجاح",
    });
  } catch (e) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
      } catch (err) {
        console.error(err);
      }
    }

    if (e?.originalError?.info?.message?.includes("Violation of UNIQUE KEY constraint")) {
      return res.status(409).json({
        message: "إسم الصنف موجود مسبقأ الرجاء إدخال إسم آخر"
      });
    }
    return res.status(e.status || 500).json({
      success: false,
      message: e.message || "حدث خطأ غير معروف",
    });
  }
}


export const updateItem = async (req, res) => {
  const itemId = Number(req.query.item_id);
  const transaction = new sql.Transaction(pool);
  try {
    const token = req.headers.authorization;
    if (!token) {
      throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
    }
    await checkToken(token);

    const body = req.body;

    const hasVariants = body.has_variants === "1";

    let variants = null;

    if (hasVariants) {
      variants = {
        size: body.variantsSize,
        price: body.variantsPrice
      };
    }

    const schema = buildProductSchema(hasVariants);

    const rawData = {
      name: body.name,
      category_id: body.category_id,
      price: body.price || null,
      barcode: body.barcode,
      hasVariants,
      variants
    };
    const validated = schema.safeParse(rawData);

    if (!validated.success) {
      const errors = validated.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));

      return res.status(400).json({
        success: false,
        errors,
      });
    }

    if(validated.data.barcode){
      const existId = await checkBarcode(validated.data.barcode);
      if (existId && existId !== itemId) {
        throw new SystemError("خطأ : الباركود المدخل مُعرف لصنف آخر , الرجاء إدخال باركود مختلف ", 409);
      }
    }

    await transaction.begin();


    await transaction.request()
      .input("name", sql.NVarChar, validated.data.name)
      .input("barcode", sql.NVarChar, validated.data.barcode)
      .input("category_id", sql.Int, validated.data.category_id)
      .input("price", sql.Int, validated.data.price)
      .input("id", sql.Int, itemId)
      .query(`
        UPDATE items
        SET name = @name, barcode = @barcode, category_id = @category_id, price = @price
        WHERE id = @id
      `)
      ;


    if (hasVariants) {
      const sizes = variants.size;
      const prices = variants.price;

      // 1️⃣ جلب النسخ الحالية
      const existingVariants = await getSizes(itemId, transaction);

      // 2️⃣ حذف النسخ الزائدة
      if (sizes.length < existingVariants.length) {
        await removeDuplicateCopies(sizes, existingVariants, transaction);
      }

      // 3️⃣ تحديث أو إضافة النسخ
      await updateOrCreateVariants(sizes, prices, existingVariants, itemId, transaction);
    }

    await transaction.commit();

    return res.status(StatusCode.Ok).json({
      message: "تم تعديل الصنف بنجاح"
    });

  } catch (e) {
    try {
      await transaction.rollback();
    } catch (err) {
      console.error(err);
    }


    if (e?.originalError?.info?.message?.includes("Violation of UNIQUE KEY constraint")) {
      return res.status(409).json({
        message: "إسم الصنف موجود مسبقأ الرجاء إدخال إسم آخر"
      });
    }

    return res.status(e.status || 500).json({
      success: false,
      message: e.message || "حدث خطأ غير معروف",
    });
  }
}


export const deleteItem = async (req, res) => {
  const itemId = Number(req.query.item_id);
  try {
    const token = req.headers.authorization;
    if (!token) {
      throw new SystemError("إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى", 401);
    }
    await checkToken(token);
    const result = await pool.request()
      .input("id", sql.Int, itemId)
      .query(`
        DELETE FROM items 
        WHERE id = @id
      `)
      ;
    return res.status(200).json({
      message: "تم حذف الصنف بنجاح"
    });

  } catch (e) {
    const status = e.status || 500;
    const message = e.message || "حدث خطأ غير معروف";
    return res.status(status).json({
      success: false,
      message: e.message || "حدث خطأ غير معروف"
    });
  }
}


export const filterItemsByCategory = async (req, res) => {
  const categoryId = Number(req.query.category_id);
  try {
    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({
        message: "إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى"
      });
    }

    await checkToken(token);

    const result = await pool.request().query(`
      SELECT * 
      FROM items
      WHERE category_id = ${categoryId}
    `);

    let items = result.recordset;

    if (items.length > 0) {
      items = await attachVariantsIfExist(items);
    }

    return res.status(200).json(items);

  } catch (e) {
    return res.status(e.status || 500).json({
      success: false,
      message: e.message || "حدث خطأ غير معروف"
    });
  }

}

export const getMenueTree = async (req, res) => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({
        message: "إنتهت صلاحية الجلسة , الرجاء تسجيل الدخول مرة أخرى"
      });
    }

    const adminId = await checkToken(token);

    const result = await pool.request()
      .input('admin_id', sql.Int, adminId)
      .query(`
        SELECT
          mc.id   AS maincategory_id,
          mc.name AS maincategory_name,

          c.id    AS category_id,
          c.name  AS category_name,

          i.id    AS item_id,
          i.name  AS item_name,
          i.price AS item_price,
          i.station AS item_station,

          s.id    AS size_id,
          s.name  AS size_name,
          s.price AS size_price

        FROM Main_category mc
          JOIN admin a ON a.id = mc.admin_id AND a.status = 1
          JOIN categories c ON c.main_category_id = mc.id
          JOIN Items i ON i.category_id = c.id
          LEFT JOIN sizes s ON s.item_id = i.id
        WHERE 
          mc.admin_id = @admin_id
        ORDER BY mc.id, c.id, i.id, s.price ASC;
      `)
      ;

    const row = result.recordset;
    const menue = buildMenuTree(row);

    return res.status(200).json(menue);


  } catch (e) {
    return res.status(e.status || 500).json({
      success: false,
      message: e.message || "حدث خطأ غير معروف"
    });
  }

}




async function getSizes(itemId, transaction = null) {

  if (transaction) {
    const result = await transaction
      .request()
      .input("item_id", itemId)
      .query(`
        SELECT *
        FROM sizes
        WHERE item_id = @item_id
        ORDER BY price ASC
      `);
    return result.recordset;
  }
  else {
    const variantsResult = await pool
      .request()
      .input("item_id", itemId)
      .query(`
      SELECT * 
      FROM sizes 
      WHERE item_id = @item_id 
      ORDER BY price ASC
    `);

    const variants = variantsResult.recordset;
    return variants;
  }

}
async function removeDuplicateCopies(sizes, existingVariants, transaction) {
  const toDelete = existingVariants
    .slice(sizes.length)
    .map(v => v.id);

  for (const id of toDelete) {
    await transaction
      .request()
      .input("id", id)
      .query(`
                DELETE FROM sizes
                WHERE id = @id
            `);
  }
}
async function updateOrCreateVariants(sizes, prices, existingVariants, itemId, transaction) {
  for (let i = 0; i < sizes.length; i++) {

    if (existingVariants[i]) {
      await transaction
        .request()
        .input("name", sizes[i])
        .input("price", prices[i])
        .input("id", existingVariants[i].id)
        .query(`
                    UPDATE sizes
                    SET name = @name,
                        price = @price
                    WHERE id = @id
                `);
    } else {
      await transaction
        .request()
        .input("itemId", itemId)
        .input("name", sizes[i])
        .input("price", prices[i])
        .query(`
                    INSERT INTO sizes(item_id, name, price)
                    VALUES(@itemId, @name, @price)
                `);
    }
  }
}

async function attachVariantsIfExist(items) {
  const itemsWithVariants = items.filter(item => item.price === null);

  if (itemsWithVariants.length === 0) {
    return items;
  }

  const itemIds = itemsWithVariants.map(item => item.id).join(",");

  const result = await pool.request().query(`
      SELECT *
      FROM sizes
      WHERE item_id IN (${itemIds})
      ORDER BY price ASC
    `)
    ;

  const variants = result.recordset;

  const variantsMap = {};

  for (const variant of variants) {
    if (!variantsMap[variant.item_id]) {
      variantsMap[variant.item_id] = [];
    }
    variantsMap[variant.item_id].push(variant);
  }

  return items.map(item => ({
    ...item,
    variants: item.price === null
      ? (variantsMap[item.id] || [])
      : []
  }));


}


async function insertSizes(itemId, rawData, transaction) {
  const request = transaction.request();

  let values = [];

  for (let i = 0; i < rawData.variants.size.length; i++) {
    values.push(`
        (@item_id${i}, @name${i}, @price${i})
    `);

    request.input(`item_id${i}`, sql.Int, itemId);
    request.input(`name${i}`, sql.NVarChar, rawData.variants.size[i]);
    request.input(`price${i}`, sql.Int, rawData.variants.price[i]);
  }

  const query = `
    INSERT INTO sizes (item_id, name, price)
    VALUES ${values.join(", ")}
  `;

  await request.query(query);
}

async function checkBarcode(barcode) {
  const result = await pool
    .request()
    .input('barcode', barcode)
    .query(`
      SELECT id
      FROM items
      WHERE barcode = @barcode
    `);
  return result.recordset[0];
}


function buildMenuTree(rows) {
  const mainCategoriesMap = {};
  const itemsMap = {};

  if (!rows || rows.length === 0) {
    return { mainCategories: [], items: [] };
  }

  for (const row of rows) {

    /* ---------- Main Category ---------- */
    if (!mainCategoriesMap[row.maincategory_id]) {
      mainCategoriesMap[row.maincategory_id] = {
        id: row.maincategory_id,
        name: row.maincategory_name,
        categories: {}
      };
    }

    const mainCategory = mainCategoriesMap[row.maincategory_id];

    /* ---------- Category ---------- */
    if (!mainCategory.categories[row.category_id]) {
      mainCategory.categories[row.category_id] = {
        id: row.category_id,
        name: row.category_name
      };
    }

    /* ---------- Item (Global List) ---------- */
    if (!itemsMap[row.item_id]) {
      itemsMap[row.item_id] = {
        id: row.item_id,
        name: row.item_name,
        price: row.item_price,
        station: row.item_station,
        category_id: row.category_id,
        sizes: []
      };
    }

    const item = itemsMap[row.item_id];

    /* ---------- Sizes ---------- */
    if (row.size_id) {
      item.sizes.push({
        id: row.size_id,
        name: row.size_name,
        price: row.size_price
      });
    }
  }

  return {
    mainCategories: Object.values(mainCategoriesMap).map(mc => ({
      id: mc.id,
      name: mc.name,
      categories: Object.values(mc.categories)
    })),
    items: Object.values(itemsMap)
  };
}










function buildProductSchema(hasVariants) {
  return z.object({
    name: z
      .string()
      .min(1, "اسم المنتج مطلوب")
      .regex(/^[\p{L}\p{N}\s]+$/u, "الاسم يجب أن يحتوي على حروف أو أرقام فقط"),


    barcode: z.preprocess(
      (v) => {
        if (v === null || v === undefined || v === "") return null;
        return String(v);
      },
      z.string()
        .regex(/^\d+$/, "الباركود يجب أن يحتوي على أرقام فقط")
        .max(20, "الباركود يجب ألا يتجاوز 20 رقم")
        .nullable()
        .optional()
    ),

    category_id: z.preprocess(
      (val) => {
        if (val === null) return null;

        if (typeof val === "string") {
          const trimmed = val.trim();
          if (trimmed === "") return null;
          return Number(trimmed);
        }

        return val;
      },
      z.union([
        z.number({
          invalid_type_error: "الفئة يجب أن تكون رقم",
        }),
        z.null(),
      ]).refine((val) => val !== null, {
        message: "يجب إدخال الفئة للصنف",
      })
    ),

    hasVariants: z.boolean(),

    // -------- السعر --------
    price: hasVariants
      ? z.null().optional()
      : z.preprocess(
        (v) => {
          if (v === null || v === undefined || v === "") return null;
          return Number(v);
        },
        z.number()
          .int("السعر يجب أن يكون رقمًا صحيحًا")
          .positive("السعر يجب أن يكون رقمًا موجبًا")
          .nullable()
          .refine(v => v !== null, { message: "يجب إدخال سعر الصنف" })
      ),

    // -------- النسخ --------
    variants: hasVariants
      ? z.object({
        size: z
          .array(
            z.string()
              .min(1, "الحجم مطلوب")
              .regex(/^(?:[\u0600-\u06FF]|[A-Za-z0-9 ])+$/, "الحجم يجب أن يحتوي على حروف فقط")
          )
          .min(1, "يجب إضافة حجم واحد على الأقل"),

        price: z
          .array(
            z.coerce.number({
              invalid_type_error: "السعر يجب أن يكون رقمًا"
            })
              .int("السعر يجب أن يكون رقم صحيح")
              .positive("السعر يجب أن يكون رقم موجب")
          )
          .min(1, "يجب إضافة سعر واحد على الأقل")
      })
      : z.literal(null).or(z.undefined()),
  });
}


