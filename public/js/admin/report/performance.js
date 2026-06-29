import { showAuthExpired, setActiveNavLink } from "../../../component/bootbox.js";
import { displayLoader, hiddeLoader, hiddeError, displayError, validateDateRange, observer, formatDateTimeForServer, displayContainer, hiddeContainer, formatHour, toUTC } from "./shared-functionality.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";

const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');
const serchBtn = document.getElementById('searchBtn');

const header = document.querySelector("site-header");
const headerDateRange = document.getElementById('headerDateRange');
const filterDateRange = document.getElementById('filterDateRange');
const filterSection = document.getElementById('filterSection');
const headerSummeryCard = document.getElementById('headerSummeryCard');
const analysesAndInsightsCard = document.getElementById('analysesAndInsightsCard');
const lineChartCard = document.getElementById('lineChartCard');
const bestDayLineChartCard = document.getElementById('bestDayLineChartCard');
const topLeastSellingItemsCard = document.getElementById('topLeastSellingItemsCard');
const leastSellingCard = document.getElementById('leastSellingCard');
const topSellingCard = document.getElementById('topSellingCard');
let orderByHour;
let orderByDay;




class SiteHeader extends HTMLElement {
    async connectedCallback() {
        const res = await fetch('../component/header.html');
        this.innerHTML = await res.text();

        this.dispatchEvent(
            new CustomEvent("header:ready", {
                bubbles: true
            })
        );
    }
}
customElements.define("site-header", SiteHeader);
header.addEventListener("header:ready", () => {
    setActiveNavLink();

    const logoutFrom = document.getElementById('logoutForm');
    logoutFrom.addEventListener("submit", async function (e) {
        e.preventDefault();
        bootbox.confirm({
            title: "تسجيل الخروج",
            message: "هل أنت متأكد من تسجيل الخروج؟",
            buttons: {
                confirm: {
                    label: "نعم",
                },
                cancel: {
                    label: "إلغاء",
                },
            },
            callback: function (result) {
                if (!result) return;

                removeAuthToken();
                window.location.href = "../../mainWindow.html";
            },
        });
    });
});



startDate.addEventListener('input', checkInputs);
endDate.addEventListener('input', checkInputs);


document.addEventListener("DOMContentLoaded", async function () {
    displayLoader();
    let { from, to } = getCurrentAndLastWeekTimestamp();
    setHeaderCurrentDate(from.split(' ')[0], to.split(' ')[0]);

    from = toUTC(from);
    to = toUTC(to);

    await loadPerformanceAnalysis(from, to);
    displayContainer(headerDateRange);
    displayContainer(filterSection);
    hiddeLoader();

});


document.addEventListener("click", async function (e) {
    if (e.target.closest('.search-btn')) {
        hiddeError();
        const validation = validateDateRange(startDate, endDate);
        if (validation.valid) {
            hiddeAllContainer();
            displayLoader();
            hiddeError();
            await loadPerformanceAnalysis(toUTC(formatDateTimeForServer(startDate.value)), toUTC(formatDateTimeForServer(endDate.value)));
            hiddeLoader();
            hiddeContainer(headerDateRange);
            setDateTimeRange(formatDateTimeForFilter(startDate.value), formatDateTimeForFilter(endDate.value));
            return;
        }
    }
});





document.querySelectorAll(".reveal").forEach(el => {
    observer.observe(el);
});





async function loadPerformanceAnalysis(startDate, endDate) {
    try {
        const res = await fetch(urlServer + `/reports/performance-analysis`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
            body: JSON.stringify({
                from: startDate,
                to: endDate,
                timezone: 'Asia/Hebron'
            }),
        });

        const data = await res.json();
        if (res.status === 401) {
            showAuthExpired(data.message);
        }
        else if (res.status === 200) {
            orderByHour = data.ordersByHours;
            orderByDay = data.orderByDay;
            setHeaderSummery(data);
            setAnalysesAndInsights(data);
            drawingBarChartForOrdersByHour();
            drowingBarChartForOrderByDays();
            drowingPieChartFroItemBySales(topSellingCard, data.topSalesItems);
            drowingPieChartFroItemBySales(leastSellingCard, data.leastSalesItems);

            displayContainer(topLeastSellingItemsCard);
            return;
        }
        else {
            displayError(data.message);
        }
    } catch (err) {
        displayError(err.message);
    }
}


function setHeaderSummery(data) {
    const totalOrder = document.getElementById('totalOrder');
    const completedOrder = document.getElementById('completedOrder');
    const deletedOrder = document.getElementById('deletedOrder');

    totalOrder.textContent = data.statisticsData.completed_orders + data.statisticsData.cancelled_orders;
    completedOrder.innerHTML = `<i class="fas fa-check-circle"></i> ${data.statisticsData.completed_orders} مكتملة`;
    deletedOrder.innerHTML = `<i class="fas fa-times-circle"></i> ${data.statisticsData.cancelled_orders} ملغية`;


    document.getElementById('totalSales').textContent = `${data.statisticsData.cash_revenue + data.statisticsData.card_revenue} ₪`;
    document.getElementById('cashSales').innerHTML = `<i class="fas fa-money-bill-wave"></i> ${data.statisticsData.cash_revenue} ₪ كاش`;
    document.getElementById('cardSales').innerHTML = `<i class="fas fa-credit-card"></i> ${data.statisticsData.card_revenue} ₪ بطاقة`;

    displayContainer(headerSummeryCard);
}
function setAnalysesAndInsights(data) {
    const delivaryOrders = document.getElementById('delivaryOrders');
    const tableOrders = document.getElementById('tableOrders');
    const avaDemand = document.getElementById('avaDemand');
    const topSellingItems = document.getElementById('topSellingItems');
    const leastSellingItems = document.getElementById('leastSellingItems');

    const details = data?.statisticsData;

    delivaryOrders.innerHTML = (details?.delivery_orders == null)
        ? `<span class="text-muted">لا توجد بيانات</span>`
        : `<span class="text-muted">${details.delivery_orders} طلب</span>
       <span class="text-muted">(${details.delivery_percentage ?? 0}%)</span>`;


    tableOrders.innerHTML = (details?.table_orders == null)
        ? `<span class="text-muted">لا توجد بيانات</span>`
        : `<span class="text-muted">${details.table_orders} طلب</span>
       <span class="text-muted">(${details.table_percentage ?? 0}%)</span>`;


    const topItem = data.topSalesItems?.length
        ? data.topSalesItems[0].name
        : 'لا يوجد بيانات';

    const leastItem = data.leastSalesItems?.length
        ? data.leastSalesItems[data.leastSalesItems.length - 1].name
        : 'لا يوجد بيانات';

    topSellingItems.innerHTML = `<span class="text-muted">${topItem}</span>`;
    leastSellingItems.innerHTML = `<span class="text-muted">${leastItem}</span>`;


    const { currentAvg, previousAvg } = computeAvgDemand(details);


    avaDemand.textContent = currentAvg > 0
        ? `${currentAvg} ₪ `
        : `لا يوجد بيانات`;


    setPeakHourAndBestDay();
    analysesAvgDemandOrder(currentAvg, previousAvg);
    setPersentageChange(details);
    displayContainer(analysesAndInsightsCard);
}
function setPeakHourAndBestDay() {
    const { peakHour, bestDay } = getPeakHourAndBestDay();
    const peakHourDev = document.getElementById('peakHour');
    const bestDayDev = document.getElementById('bestDay');
    peakHourDev.textContent = peakHour
        ? `الساعة ${formatHour(peakHour.hour)} (${peakHour.orders_count} طلب)`
        : "لا توجد بيانات";

    bestDayDev.textContent = bestDay
        ? `${bestDay.day_name} (${bestDay.total_sales} ₪)`
        : "لا توجد بيانات";
}
function getPeakHourAndBestDay() {
    const bestDay = orderByDay.length ?
        orderByDay.reduce((prev, current) => current.total_sales > prev.total_sales ? current : prev)
        : null;

    const peakHour = orderByHour.length ?
        orderByHour.reduce((prev, current) => current.orders_count > prev.orders_count ? current : prev)
        : null;

    return { peakHour, bestDay };
}



function computeAvgDemand(data) {
    if (!data) {
        return { currentAvg: 0, previousAvg: 0 };
    }

    const totalOrders = data.completed_orders + data.cancelled_orders;

    const currentAvg = totalOrders > 0
        ? ((data.card_revenue + data.cash_revenue) / totalOrders).toFixed(1)
        : 0;

    const previousAvg = data.previous_total_orders > 0
        ? ((data.previous_revenue) / data.previous_total_orders).toFixed(1)
        : 0;

    return { currentAvg, previousAvg };
}


function analysesAvgDemandOrder(currentAvg, prevAvg) {
    const data = getComparisonData(currentAvg, prevAvg);
    const className = data.className.split(' ');
    document.getElementById('avgBar').style.width = data.progress + '%';
    document.getElementById('avgBar').className = 'progress-bar ' + className[0];

    document.getElementById('avgText').className = className[1];
    document.getElementById('avgText').textContent = data.text;

    document.getElementById('iconAvg').className = data.icon;
}


function getComparisonData(currentAvg, previousAvg) {
    if (!previousAvg || previousAvg === 0) {
        return {
            text: 'لا يوجد بيانات سابقة للمقارنة',
            percent: 0,
            progress: 0,
            className: 'bg-secondary text-secondary',
            icon: 'fas fa-arrow-right text-secondary'
        };
    }
    else if (currentAvg === 0) {
        return {
            text: 'لا يوجد بيانات',
            percent: 0,
            progress: 0,
            className: 'bg-secondary text-secondary',
            icon: 'fas fa-arrow-right text-secondary'
        };
    }

    const change = ((currentAvg - previousAvg) / previousAvg) * 100;
    const percent = Math.abs(change).toFixed(1);
    let result = {
        percent,
        progress: Math.min(Math.abs(change), 100)
    };

    if (change > 0) {
        return {
            ...result,
            text: `تحسن بنسبة ${percent}% مقارنة بالفترة السابقة`,
            className: 'bg-success text-success',
            icon: 'fas fa-arrow-up text-success'
        };
    }

    if (change < 0) {
        return {
            ...result,
            text: `انخفاض بنسبة ${percent}% مقارنة بالفترة السابقة`,
            className: 'bg-danger text-danger',
            icon: 'fas fa-arrow-down text-danger'
        };
    }

    return {
        ...result,
        text: 'لا يوجد تغيير مقارنة بالفترة السابقة (أسبوع قبل تاريخ البداية)   ',
        className: 'bg-secondary text-secondary',
        icon: 'fas fa-arrow-right text-secondary'
    };
}


function setPersentageChange(data) {
    setOrderPersantageChange(data);
    setRevenuePersantageChange(data);
}

function setOrderPersantageChange(data) {
    const totalOrders = data.completed_orders + data.cancelled_orders;
    const orderChange = getComparisonData(totalOrders, data.previous_total_orders);
    document.getElementById('orderChangeIcon').className = orderChange.icon + ' ' + orderChange.className.split(' ')[1];
    document.getElementById('orderChangeValue').className = orderChange.className.split(' ')[1];
    document.getElementById('orderChangeValue').textContent = orderChange.text;
}

function setRevenuePersantageChange(data) {
    const totalRevenue = data.card_revenue + data.cash_revenue;
    const revenueChange = getComparisonData(totalRevenue, data.previous_revenue);
    document.getElementById('revenueChangeIcon').className = revenueChange.icon + ' ' + revenueChange.className.split(' ')[1];
    document.getElementById('revenueChangeValue').className = revenueChange.className.split(' ')[1];
    document.getElementById('revenueChangeValue').textContent = revenueChange.text;
}
function setHeaderCurrentDate(startDate, endDate) {
    document.getElementById('HeaderStartDate').textContent = startDate;
    document.getElementById('HeaderEndDate').textContent = endDate;
}

function setDateTimeRange(startRange, endRange) {
    document.getElementById('filterDateStart').textContent = startRange;
    document.getElementById('filterDateEnd').textContent = endRange;

    displayContainer(filterDateRange);
}

function drawingBarChartForOrdersByHour() {
    hiddeBarChartMessage(lineChartCard);
    const hours = orderByHour.map(item => formatHourTo12(item.hour));
    const orders = orderByHour.map(item => item.orders_count);

    if (orders.length === 0 && hours.length === 0) {
        displayBarChartMessage(lineChartCard);
        displayContainer(lineChartCard);
        return;
    }

    // احذف الشارت القديم إذا موجود
    Chart.getChart("lineChart")?.destroy();

    const ctx = document.getElementById("lineChart");

    new Chart(ctx, {
        type: "bar",
        data: {
            labels: hours,
            datasets: [
                {
                    label: '',
                    data: orders,
                    maxBarThickness: 30,     // أقصى عرض مسموح
                    borderColor: "rgba(54,162,235,0.7)",
                    backgroundColor: "rgba(54,162,235,0.7)",
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: "#1565C0",
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,


            interaction: {
                mode: "index",
                intersect: false
            },

            plugins: {
                tooltip: {
                    rtl: false,
                    textDirection: 'ltr',
                    bodyAlign: "right",
                    displayColors: false,
                    titleFont: { size: 14 },
                    bodyFont: { size: 14 },
                    callbacks: {
                        label: function (context) {
                            return "عدد الطلبات: " + context.parsed.y;
                        }
                    }
                },
                legend: {
                    position: "top",
                    labels: {
                        font: { size: 16 },
                        color: "#000000",
                        usePointStyle: false, // تأكد أنه false
                        boxWidth: 0,          // يلغي عرض المربع
                        boxHeight: 0
                    }
                },
                datalabels: {
                    color: 'black',
                    anchor: 'end',
                    align: 'top',
                    textAlign: 'center',
                    font: { size: 12, weight: 'bold' },
                    formatter: function (value) {
                        return value; // عرض عدد الطلبات فقط
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "الفترة الزمنية (من ساعة إلى ساعة)",
                        font: { size: 17 },
                        color: "black"
                    },
                    ticks: {
                        callback: function (value) {
                            return '\u200E' + this.getLabelForValue(value);
                        }
                    },
                    grid: { display: false }
                },
                y: {
                    type: "linear",
                    position: "left",
                    title: {
                        display: true,
                        text: "عدد الطلبات",
                        font: { size: 17 },
                        color: "black"
                    },
                    grid: { color: "rgba(0,0,0,0.08)" }
                }
            }
        },
        plugins: [ChartDataLabels]
    });

    displayContainer(lineChartCard);

}
function drowingBarChartForOrderByDays() {

    const days = orderByDay.map(item => item.day_name);
    const orders = orderByDay.map(item => item.orders_count);
    const sales = orderByDay.map(item => item.total_sales);

    if (orders.length === 0 && days.length === 0 && sales.length === 0) {
        displayBarChartMessage(bestDayLineChartCard);
        displayContainer(bestDayLineChartCard);
        return;
    }



    // احذف الشارت القديم إذا موجود
    Chart.getChart("bestDayBarChartContainer")?.destroy();

    const ctx = document.getElementById("bestDayBarChartContainer");

    new Chart(ctx, {
        data: {
            labels: days,
            datasets: [
                {
                    type: "bar",
                    label: "",
                    data: orders,
                    backgroundColor: "rgba(76,175,80,0.7)",
                    yAxisID: "yOrders",
                    maxBarThickness: 30,
                    hoverBackgroundColor: "#2E7D32",
                    sales: sales
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                mode: "index",
                intersect: false
            },

            plugins: {
                tooltip: {
                    rtl: false,
                    textDirection: 'ltr',
                    bodyAlign: "right",
                    displayColors: false,
                    titleFont: { size: 14 },
                    bodyFont: { size: 14 },
                    callbacks: {
                        label: function (context) {
                            return "عدد الطلبات: " + context.parsed.y;
                        },
                        afterLabel: function (context) {
                            return "المبيعات: ₪ " + context.dataset.sales[context.dataIndex];
                        }
                    }
                },
                legend: {
                    position: "top",
                    labels: {
                        font: { size: 16 },
                        color: "#000000",
                        usePointStyle: false, // تأكد أنه false
                        boxWidth: 0,          // يلغي عرض المربع
                        boxHeight: 0
                    }
                },
                datalabels: {
                    color: 'black',
                    anchor: 'end',
                    align: 'top',
                    offset: 4,
                    textAlign: 'center',
                    font: { size: 12, weight: 'bold' },
                    formatter: function (value, context) {
                        return "₪ " + context.dataset.sales[context.dataIndex];
                    }
                }
            },

            scales: {
                x: {
                    title: {
                        display: true,
                        text: "أيام الأسبوع",
                        font: { size: 17 },
                        color: "black"
                    },
                    ticks: {
                        font: {
                            size: 18,
                            weight: 'bold'
                        },
                        callback: function (value) {
                            return '\u200E' + this.getLabelForValue(value);
                        }
                    },
                    grid: { display: false }
                },

                yOrders: {
                    type: "linear",
                    position: "left",
                    title: {
                        display: true,
                        text: "عدد الطلبات",
                        font: { size: 17 },
                        color: "black"
                    },
                    grid: { color: "rgba(0,0,0,0.08)" }
                }

            }
        },

        plugins: [ChartDataLabels]
    });
    displayContainer(bestDayLineChartCard);
    hiddeBarChartMessage(bestDayLineChartCard);
}



function drowingPieChartFroItemBySales(container, salesByItems) {
    const pieChartContainer = container.querySelector('.pieChartContainer');
    const messageContainer = container.querySelector('.messageContainer');
    const ctx = container.querySelector(".pieChart");

    if (salesByItems.length === 0) {
        hiddeContainer(pieChartContainer);
        displayContainer(messageContainer);
        return;
    }




    const labels = salesByItems.map(item => item.name);

    const quantities = salesByItems.map(item => item.quantity);
    const totalQuantity = salesByItems[0].total_qty;

    Chart.getChart(ctx)?.destroy();

    new Chart(ctx, {
        type: "pie",

        data: {
            labels: labels,
            datasets: [{
                data: quantities,
                backgroundColor: [
                    "#0dcaf0",
                    "#66BB6A",
                    "#FFA726",
                    "#AB47BC",
                    "#EF5350",
                ]
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {

                legend: {
                    position: "top",
                    labels: {
                        color: "#000000",
                        font: {
                            size: 15,
                            weight: 'bold'
                        }
                    }
                },

                tooltip: {
                    rtl: true,
                    bodyAlign: "right",
                    displayColors: false,
                    callbacks: {
                        label: () => null,
                        afterLabel: function (context) {
                            return "عدد الطلبات: " + context.raw;
                        }
                    }
                },

                datalabels: {
                    color: "#fff",
                    textAlign: "center",
                    font: {
                        weight: "bold",
                        size: 14
                    },
                    formatter: function (value) {
                        const percentage = ((value / totalQuantity) * 100).toFixed(1);
                        return percentage + "%\n" + value + " طلب";
                    }
                }
            }
        },

        plugins: [ChartDataLabels]
    });

    hiddeContainer(messageContainer);
    displayContainer(pieChartContainer);
}







function hiddeAllContainer() {
    hiddeContainer(headerSummeryCard);
    hiddeContainer(analysesAndInsightsCard);
    hiddeContainer(lineChartCard);
    hiddeContainer(bestDayLineChartCard);
    hiddeContainer(topLeastSellingItemsCard);
}



function checkInputs() {
    if (startDate.value !== "" && endDate.value !== "") {
        serchBtn.disabled = false;
    } else {
        serchBtn.disabled = true;
    }
}
function displayBarChartMessage(barContainer) {
    const messageDiv = barContainer.querySelector('#barChartMessage');
    const barChartCanvas = barContainer.querySelector('#barChartCanvas');
    const labelHeader = barContainer.querySelector('#labelHeader');
    barChartCanvas.classList.add('d-none');
    labelHeader.classList.add('d-none');


    messageDiv.classList.remove('d-none');
}
function hiddeBarChartMessage(barContainer) {
    const messageDiv = barContainer.querySelector('#barChartMessage');
    const barChartCanvas = barContainer.querySelector('#barChartCanvas');
    const labelHeader = barContainer.querySelector('#labelHeader');

    barChartCanvas.classList.remove('d-none');
    labelHeader.classList.remove('d-none');

    messageDiv.classList.add('d-none');
}





function formatHourTo12(hourString) {
    let start = parseInt(hourString, 10);
    let end = (start + 1) % 24;

    let start12 = start % 12 || 12;
    let end12 = end % 12 || 12;
    let period = end >= 12 ? "PM" : "AM";

    return `${start12}-${end12} ${period}`;
}


function getCurrentAndLastWeekTimestamp() {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Jerusalem",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const get = (type) => parts.find(p => p.type === type).value;

    const currentDate = `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;

    // بداية اليوم قبل 7 أيام
    const localDate = new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00`);
    localDate.setDate(localDate.getDate() - 7);

    const lastParts = formatter.formatToParts(localDate);
    const lastWeek = `${lastParts.find(p => p.type === "year").value}-${lastParts.find(p => p.type === "month").value}-${lastParts.find(p => p.type === "day").value}`;

    return {
        from: lastWeek + " 00:00:00",
        to: currentDate
    };
}

function formatDateTimeForFilter(dateString) {
    const safeDate = dateString.replace(' ', 'T');
    const date = new Date(safeDate);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day}`;


    return formattedDate;


}