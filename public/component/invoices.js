

export async function printInvoiceFromCashier(newOrder) {
    const order = {
        inv_num: newOrder.inv_num.split('-')[1],
        time: getCurrentTime(),
        date: getCurrentDate(),
        payment_method: newOrder.paymentMethod,
        type: newOrder.orderType,
        total_amount: newOrder.totalPrice - newOrder.discount,
        discount: newOrder.discount,
        note: newOrder.note,
        table_num: newOrder.tableNum,
        phone_num: newOrder.phoneNum,
        address: newOrder.address,
        items: []
    };

    order.items = newOrder.items.map(item => (
        {
            name: formatItemName(item),
            unit: `${item.price} ₪`,
            qty: item.qty,
            total: `${item.price * item.qty} ₪`
        }
    ));
    await printInvoice(order);
}

export async function handelOrderDatabeforPrinting(order) {
    const orderPrinting = {
        inv_num: order.invoice_num.split('-')[1],
        time: order.time,
        date: order.date,
        payment_method: order.payment_method,
        type: order.type,
        total_amount: order.total_price,
        discount: order.discount,
        note: '',
        table_num: order?.table_num ?? '',
        phone_num: '',
        address: '',
        items: []
    };

    orderPrinting.items = order.items.map(item => (
        {
            name: formatItemName(item, false),
            unit: `${item.price} ₪`,
            qty: item.quantity,
            total: `${item.price * item.quantity} ₪`
        }
    ));


    await printInvoice(orderPrinting);
}


export async function printInvoice(order) {


    const invoiceHTML = `
        <div id="invoice" class="invoice">
            <div style="width: 100%; text-align: center;">
                <h2 class="center">Coffee Corner</h2>
                <p class="center">0587003023</p>
                <small class="center">رام الله - إم الشرايط - حي تميم الداري</small>
            </div>

            <hr>

            <p class="inv-num" dir="rtl">
                <strong>رقم الطلب :&nbsp;</strong> 
                <span id="orderId"> ${order.inv_num} </span>
            </p>

            <div class="date-time-container">
                <div class="date-time">
                    <p>
                        <strong>التاريخ :</strong> 
                        <span id="date">${order.date}</span>
                    </p>
                    <p>
                        <strong>الوقت :</strong> 
                        <span id="time" dir="ltr">${order.time}</span>
                    </p>
                </div>
                
                <p>
                    <strong> طريقة الدفع : </strong> 
                    <span id="payment_method">${order.payment_method}</span>
                </p>

            </div>
            

            <table>
                <thead>
                    <tr>
                        <th>الصنف</th>
                        <th>الوحدة</th>
                        <th>الكمية</th>
                        <th>الإجمالي</th>
                    </tr>
                </thead>
                <tbody id="items">
                    ${order.items.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.unit}</td>
                            <td>${item.qty}</td>
                            <td>${item.total}</td>
                        </tr>
                    `).join("")}

                    <tr>
                        <td colspan="3" class="text-end">
                            <strong>المجموع</strong>
                        </td>
                        <td>
                            ${order.total_amount + order.discount} ₪
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="total-section">
                <div style="font-size: 12px;">
                    <span>الخصم : </span>
                    <span>${order.discount} ₪</span>
                </div>

                <div class="total-amount">
                    <p><strong>الإجمالي : </strong></p>
                    <p><strong>${order.total_amount} ₪</strong></p>
                </div>
            </div>

            <hr>

            ${handleOrderNote(order)}
            ${handleOrderType(order)}
            
        </div>
    `;
    await createHTMLOrder(invoiceHTML);


}

export async function printCashSummery(session, isSessionClosed = true) {
    let closeDate = session?.closed_at
        ? utcToPalestine(session.closed_at).split(' ')[0]
        : getCurrentDate()
        ;

    let closeTime = session?.closed_at
        ? formatHourForCashSession(utcToPalestine(session.closed_at).split(' ')[1], true)
        : formatHourForCashSessionCurrentTime(getCurrentTime())
        ;


    const cashHtml = `
            <div id="cashSummary" class="cash-summary">

                <h2 class="center">ملخص الصندوق</h2>
                <hr>
            

                <!-- معلومات الجلسة -->
                <div class="open-close-info">
                    <p>
                        <strong>وقت الفتح :</strong>
                        <span style="margin-top: 5px;">${utcToPalestine(session.open_at).split(' ')[0]} | ${formatHourForCashSession(utcToPalestine(session.open_at).split(' ')[1], true)}</span>
                    </p>

                    <p style="margin-top: 8px;">
                        <strong>وقت الإغلاق :</strong>
                        ${isSessionClosed
            ? `<span style="margin-top: 5px;">${closeDate} | ${closeTime}</span>`
            : `<span style="margin-top: 5px;">لم يتم إغلاقه</span>`
        }
                    </p>
                </div>


                <!-- التفاصيل المالية -->
                <div class="row-box">
                    <p><strong>كاش إفتتاحي</strong></p>
                    <span>${session?.opening_cash || 0} ₪</span>
                </div>

                <div class="row-box">
                    <p><strong>مبيعات كاش</strong></p>
                    <span>${session?.cash_sales || 0} ₪</span>
                </div>

                <div class="row-box">
                    <p><strong>مبيعات بطاقة</strong></p>
                    <span>${session?.card_sales || 0} ₪</span>
                </div>


                <div class="row-box">
                    <p><strong>معاملات مالية - إضافة</strong></p>
                    <span>+ ${session?.cash_in || 0} ₪</span>
                </div>

                <div class="row-box">
                    <p><strong>معاملات مالية - سحب</strong></p>
                    <span>- ${session?.cash_out || 0} ₪</span>
                </div>

                <hr>

                <div class="row-box">
                    <p><strong>الكاش المتوقع</strong></p>
                    <span>${session?.expected_cash || 0} ₪</span>
                </div>

                <div class="row-box">
                    <p><strong>الكاش عند الإغلاق</strong></p>
                    <span>${session?.actual_cash || 0} ₪</span>
                </div>

                <div class="row-box">
                    <p><strong>الفرق</strong></p>
                    <span>${session?.difference || session.actual_cash - session.expected_cash} ₪</span>
                </div>

            </div>

        `;
    await createHTMLCashSummary(cashHtml);



}

export async function printTransaction(transaction) {

    const transactionHTML = `
        <div id="financeInvoice" class="finance-invoice" dir="rtl">
            <h2 class="center">معاملة مالية</h2>


                <div class="date-time-container">
                    <p>
                        <strong>التاريخ :</strong> 
                        <span id="date">${transaction?.date || getCurrentDate()}</span>
                    </p>
                    <p>
                        <strong>الوقت :</strong> 
                        <span id="time" dir="ltr">${transaction?.time || getCurrentTime()}</span>
                    </p>
                </div>

            <hr>


            <div class="row-custom">

                <div class="col-6-custom center-box">
                    <p class="title">
                        <strong>نوع العملية</strong>
                    </p>
                    <span class="value">${transaction.type}</span>
                </div>

                <div class="col-6-custom center-box">
                    <p class="title">
                        <strong>القيمة</strong>
                    </p>
                    <span class="value">${transaction.amount} ₪</span>
                </div>

            </div>


            <div class="reson-box">
                <p>
                    <strong>السبب :</strong>
                    <span class="note">${transaction.note}</span>
                </p>
            </div>
            <hr>

            <h5 class="center">Coffee Corner</h5>
            
        </div>
    
    `
    await createHTMLTransaction(transactionHTML);

}


export async function generateStationInvoice(order) {
    if(order.items.length === 0) return;

    const invoiceHTML = `
        <div id="invoice" class="invoice">

            <div style="width: 100%; text-align: center;">
                <h3 class="center">${order.station}</h3>
            </div>

            ${order.inv_num ?
                `
                    <p class="inv-num" dir="rtl">
                        <strong>رقم الطلب :&nbsp;</strong>
                        <span>${order.inv_num}</span>
                    </p>
                `
                : ''
            }
            

            ${handleOrderType(order)}

            <hr>

            <table>
                <thead>
                    <tr>
                        <th>الصنف</th>
                        <th>الكمية</th>
                    </tr>
                </thead>

                <tbody>
                    ${order.items.map(item => `
                        <tr>
                            <td>${formatItemName(item)}</td>
                            <td>${item.qty}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>


            ${handleOrderNote(order)}
        

        </div>
    `;

    await createHTMLforInvoiceStation(invoiceHTML, order.printer_name);
}





function handleOrderType(order) {
    if (order.type === 'طاولة') {
        return `
            <div class="table-order">
                <p><strong>نوع الطلب : </strong> <span>طاولة</span></p>
                <p><strong>رقم الطاولة : </strong> <span>${order.table_num}</span></p>
            </div>
        `
    } else {
        return `
            <div class="delivery-order">
                <div class="delivery-info">
                    <p>
                        <strong>نوع الطلب :</strong>
                        <span>سفري</span>
                    </p>

                ${order.phone_num ?
                    `
                        <p>
                            <strong>الزبون :</strong>
                            <span>${order.phone_num}</span>
                        </p>
                    `
                    : ''
                }

                ${order.address ?
                    `
                        <p>
                            <strong>العنوان :</strong>
                            <span>${order.address}</span>
                        </p>
                    `
                    : ''
                }
                </div>

            </div>
        `
    }
}
function handleOrderNote(order) {
    if (order.note !== '') {
        return `
            <p>
                <strong>ملاحظات:</strong>
            </p>

            <p style="margin-top:5px;">
                ${order.note}
            </p>
        `
    }
    else {
        return '';
    }
}
function getCurrentTime() {
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Jerusalem'
    }).format(new Date());
}
function getCurrentDate() {
    const parts = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Jerusalem'
    }).formatToParts(new Date());

    const day = parts.find(p => p.type === 'day').value;
    const month = parts.find(p => p.type === 'month').value;
    const year = parts.find(p => p.type === 'year').value;

    return `${year}-${month}-${day}`;
}
function formatItemName(item, isFromCashier = true) {
    if (isFromCashier) {
        return item.sizeName
            ? `${item.name} - ${item.sizeName}`
            : item.name;
    }
    else {
        return item.size_name !== 'NaN'
            ? `${item.item_name} - ${item.size_name}`
            : item.item_name;
    }
}
function formatHourForCashSession(time, displayMinutes = false) {
    if (!time) return ''; // أو "—" أو أي قيمة افتراضية
    const [h, m] = time.split(":");

    let hour = parseInt(h, 10);
    let minutes = m !== undefined ? m : "00";

    let period = hour < 12 ? 'صباحًا' : 'مساءً';

    let hour12 = hour % 12;
    if (hour12 === 0) hour12 = 12;

    if (displayMinutes) {
        minutes = minutes.padStart(2, '0');
        return `${hour12}:${minutes} ${period}`;
    } else {
        return `${hour12}:00 ${period}`;
    }
}



function formatTimeOnly(dateString) {
    const safeDate = dateString.replace(' ', 'T');
    const date = new Date(safeDate);

    return date.toLocaleTimeString('en-PS', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDateOnly(dateString) {

    const safeDate = dateString.replace(' ', 'T');
    const date = new Date(safeDate);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}
function utcToPalestine(datetime) {
    const date = new Date(datetime);

    const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Hebron',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const parts = Object.fromEntries(
        formatter.formatToParts(date).map(({ type, value }) => [type, value])
    );

    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}


function formatHourForCashSessionCurrentTime(time) {
    if (!time) return '';

    // مثال: "2:30 PM"
    const [timePart, periodPart] = time.split(' ');

    const [h, m] = timePart.split(":");

    let hour = parseInt(h, 10);
    let minutes = m || "00";

    // تحديد صباحًا / مساءً
    let period = periodPart === 'AM' ? 'صباحًا' : 'مساءً';

    // تحويل لـ 12 ساعة (بس للتأكيد)
    let hour12 = hour % 12;
    if (hour12 === 0) hour12 = 12;


    minutes = minutes.padStart(2, '0');
    return `${hour12}:${minutes} ${period}`;

}



async function createHTMLOrder(invoiceHTML) {

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة</title>

        <style>
            ${getStyleForInvoice()}
        </style>
      </head>

      <body>
        ${invoiceHTML}
      </body>
    </html>
  `;
    await print(htmlContent);
}

function getStyleForInvoice() {
    return `
          body {
            display: flex;
            justify-content: center;
            margin: 0;
            font-family: Arial, sans-serif;
          }

          .invoice {
            width: 300px;
            padding: 10px;
          }

          .center {
            text-align: center;
          }

          .order-id {
            text-align: center;
            border: 1px solid black;
            padding: 5px;
            margin: 5px 0;
          }

          .info {
            display: flex;
            flex-direction: column;
            gap: 5px;
            margin-top: 5px;
          }

          .row-between {
            display: flex;
            justify-content: space-between;
          }

          .inv-num{
            display: flex;
            flex-direction:row;
            padding: 8px;
            justify-content: center;
            border: 1px solid black;
          }


          .date-time-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 12px;
          }

          .date-time {
            display: flex;
            justify-content: space-between;
          }


          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-top: 12px;
          }

          th {
            background: #000000;
            color: white;
            padding: 4px;
            text-align: center;
            font-weight: bold;
          }

          td {
            border-bottom: 1px dashed #000;
            padding: 4px;
            text-align: center;
          }

          .text-end{
            text-align: left;
            padding : 0;
          }

          .total-row td {
            font-weight: bold;
            border-top: 1px solid black;
          }

            .table-order {
                display: flex;
                justify-content: space-between;
                margin-top: 10px;
            }

            .delivery-order{
                display: flex;
                flex-direction: column;
                margin-top: 10px;
                gap: 4px;
            }

            .delivery-info {
                display: flex;
                flex-direction: column;
                gap: 7px;
            }


          p {
            margin: 0;
          }

          hr {
            margin: 6px 0;
          }

          .total-section{
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            font-size: 17px;
            margin-top: 20px;
          }

          .total-amount{
            display: flex;
            gap: 1px;
            margin-top: 4px;
          }

        @media print {
            @page {
                size: 80mm auto;
                margin: 0;
            }

            body {
                margin: 0;
                text-align: center;
            }

            #invoice {
                display: inline-block;
                width: 80mm;
                text-align: right; /* لأنه عربي */
            }

            th {
                background: #000000 !important;
                color: white !important;

                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    `
}

async function createHTMLforInvoiceStation(invoiceHTML, printerName) {
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة</title>

        <style>
            ${getStyleForInvoice()}
        </style>
      </head>

      <body>
        ${invoiceHTML}
      </body>
    </html>
  `;
}

async function createHTMLCashSummary(cashHtml) {

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة</title>

        <style>
            body {
                display: flex;
                justify-content: center;
                margin: 0;
                font-family: Arial, sans-serif;
            }

            .cash-summary {
                width: 300px;
                padding: 10px;
            }

            .cash-summary {
                width: 300px;
                padding: 10px;
            }

            .cash-summary .center {
                text-align: center;
            }

            .cash-summary .row-box {
                border: 1px solid black;
                padding: 6px;
                margin-bottom: 5px;
                display: flex;
                justify-content: space-between;
                font-size: 14px;
            }

            .cash-summary p {
                margin: 0;
            }

            .open-close-info {
                text-align: center;
                margin-bottom: 13px;
                
            }


            .open-close-info p {
                display: flex;
                flex-direction: column;
            }
        
            hr{
                margin-top: 13px;
                margin-bottom: 13px;
            }



        

            @media print {
                @page {
                    size: 80mm auto;
                    margin: 0;
                }

                body {
                    margin: 0;
                    text-align: center;
                }

                #cash-summary {
                    display: inline-block;
                    width: 80mm;
                    text-align: right; 
                }
                    
            }
        </style>
      </head>

      <body>
        ${cashHtml}
      </body>
    </html>
  `;

    await print(htmlContent);
}
async function createHTMLTransaction(transactionHTML) {

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة</title>

        <style>
            body {
                display: flex;
                justify-content: center;
                margin: 0;
                font-family: Arial, sans-serif;
            }

        
            hr {
                margin-top: 13px;
                margin-bottom: 13px;
                border: none;
                border-top: 1px solid black;
            }

            .finance-invoice {
                width: 300px;
                padding: 10px;
            }

            .finance-invoice .center {
                text-align: center;
            }

            .finance-invoice p {
                margin: 0;
                font-size: 14px;
            }

            .finance-invoice .row {
                display: flex;
                justify-content: space-between;
                margin-top: 6px;
            }

            .finance-invoice .box {
                border: 1px solid black;
                padding: 6px;
                margin-top: 10px;
            }

            .finance-invoice .reson-box {
                padding: 6px;
                margin-top: 14px;
            }


            .date-time-container {
                display:flex;
                justify-content: space-between;
            }


            .row-custom {
                display: flex;
                flex-wrap: wrap;
            }

            /* col-6 */
            .col-6-custom {
                width: 50%;
            }

            /* d-flex flex-column align-items-center justify-content-center */
            .center-box {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }

            /* border-bottom border-dark p-1 */
            .title {
                border-bottom: 1px solid #000;
                padding: 0.25rem; /* = 4px */
                margin-bottom: 0.5rem; 
            }

            .value{
                padding-top: 10px;
                font-size: 17px;
            }
            .note{
                font-size: 18px;
            }

            @media print {
                @page {
                    size: 80mm auto;
                    margin: 0;
                }

                body {
                    margin: 0;
                    text-align: center;
                }

                #financeInvoice {
                    display: inline-block;
                    width: 80mm;
                    text-align: right; 
                }
                    
            }
        </style>
      </head>

      <body>
        ${transactionHTML}
      </body>
    </html>
  `;

    await print(htmlContent);
}



async function print(invoiceContent) {
    await window.electronAPI.printInvoice(invoiceContent);
}


















