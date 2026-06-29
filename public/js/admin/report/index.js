import { setActiveNavLink, showAuthExpired, bootboxSuccess, bootboxError } from "../../../component/bootbox.js";
import { getAuthToken, removeAuthToken } from "../../../component/auth.js";
import { displayContainer, displayError, observer, toUTC } from "../report/shared-functionality.js";
import { urlServer, url } from "../../../api/urlEndPoint.js";



const header = document.querySelector("site-header");
const barChartCard = document.getElementById('barChartCard');
const pieChartCard = document.getElementById('pieChartCard');

let salesByItems = [];
let orderByDay = [];
let prevRevenue = 0;
let prevTotalOrders = 0;

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

document.addEventListener('DOMContentLoaded', async function () {
  let { from, to } = getCurrentAndLastWeekTimestamp();

  from = toUTC(from);
  to = toUTC(to);

  await loadAnalysisData(from, to);

});



document.querySelectorAll(".reveal").forEach(el => {
  observer.observe(el);
});


async function loadAnalysisData(startDate, endDate) {
  try {
    const res = await fetch(urlServer + '/reports/home', {
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
      credentials: 'include',
    });

    const data = await res.json();

    if (res.status === 401) {
      showAuthExpired(data.message);
    }
    else if (res.status === 200) {
      prevRevenue = data.statisticsData?.previous_revenue;
      prevTotalOrders = data.statisticsData?.previous_total_orders;
      orderByDay = data.orders_by_day;
      salesByItems = data.top_sales_items;
    }
    else {
      displayError(data.message);
    }

  } catch (e) {
    displayError(e.message);
  } finally {
    setHeaderSummery();
    updateDashboardUI();
  }
}

function setHeaderSummery() {
  const { totalOrder, revenue, avgDemandOrder, topItem } = getCashSummery();

  document.getElementById('totalOrder').textContent = `${totalOrder}`;
  document.getElementById('totalSales').textContent = `${revenue} ₪`;
  document.getElementById('averageDemand').textContent = `${avgDemandOrder} ₪`;

  document.getElementById('topSellingItemName').textContent = `${topItem.name}`;
  document.getElementById('topSellingItemValue').textContent = `(${topItem.totalQty}) طلب`;

  const prevAvgDemandOrder = getPrevAvgOrderDemand();

  setOrderPersantageChange(totalOrder, prevTotalOrders);
  setRevenuePersantageChange(revenue, prevRevenue);

  setAvgDemandOrderPersantageChange(avgDemandOrder, prevAvgDemandOrder);

}

function getPrevAvgOrderDemand() {
  const prevAvg = prevTotalOrders === 0
    ? 0
    : (prevRevenue / prevTotalOrders).toFixed(2);
  return prevAvg;
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
      text: `تحسن بنسبة ${percent}% عن الأسبوع الماضي`,
      className: 'bg-success text-success',
      icon: 'fas fa-arrow-up text-success'
    };
  }

  if (change < 0) {
    return {
      ...result,
      text: `انخفاض بنسبة ${percent}% عن الأسبوع الماضي`,
      className: 'bg-danger text-danger',
      icon: 'fas fa-arrow-down text-danger'
    };
  }

  return {
    ...result,
    text: 'لا يوجد تغيير مقارنة بالاسبوع الماضي',
    className: 'bg-secondary text-secondary',
    icon: 'fas fa-arrow-right text-secondary'
  };
}

function setOrderPersantageChange(totalOrders, prevTotalOrder) {
  const orderChange = getComparisonData(totalOrders, prevTotalOrder);
  document.getElementById('orderChangeIcon').className = orderChange.icon + ' ' + orderChange.className.split(' ')[1];
  document.getElementById('orderChangeValue').className = orderChange.className.split(' ')[1];
  document.getElementById('orderChangeValue').textContent = orderChange.text;
}
function setRevenuePersantageChange(totalRevenue, prevRevenue) {
  const revenueChange = getComparisonData(totalRevenue, prevRevenue);
  document.getElementById('revenueChangeIcon').className = revenueChange.icon + ' ' + revenueChange.className.split(' ')[1];
  document.getElementById('revenueChangeValue').className = revenueChange.className.split(' ')[1];
  document.getElementById('revenueChangeValue').textContent = revenueChange.text;
}

function setAvgDemandOrderPersantageChange(currentAvg, prevAvg) {
  const data = getComparisonData(currentAvg, prevAvg);
  const className = data.className.split(' ');
  document.getElementById('avgText').className = className[1];
  document.getElementById('avgText').textContent = data.text;
  document.getElementById('iconAvg').className = data.icon;
}





function updateDashboardUI() {
  hiddeLoderChart(barChartCard);
  hiddeLoderChart(pieChartCard);

  if (salesByItems !== null && orderByDay !== null) {
    drowingBarChartForOrderByDays();
    drowingPieChartFroItemBySales();
  }
  else {
    displayMessageChart(barChartCard);
    displayMessageChart(pieChartCard);
  }
}

function getCashSummery() {
  let totalOrder = 0;
  let revenue = 0;
  let avgDemandOrder = 0;
  let topItem = {
    name: 'لا يوجد بيانات',
    totalQty: 0
  }

  if (orderByDay.length > 0) {
    for (const i of orderByDay) {
      totalOrder += i.orders_count;
      revenue += i.total_sales;
    }
    avgDemandOrder = totalOrder === 0
      ? 0
      : (revenue / totalOrder).toFixed(2);

    topItem.name = salesByItems[0].name;
    topItem.totalQty = salesByItems[0].quantity;
  }

  return {
    totalOrder,
    revenue,
    avgDemandOrder,
    topItem
  }

}

function hiddeLoderChart(parentContainer) {
  const loader = parentContainer.querySelector('.loader-chart');
  loader.classList.add('d-none');
}
function displayMessageChart(parentContainer) {
  const message = parentContainer.querySelector('.message-chart');
  message.classList.remove('d-none');
}
function displayChartContainer(parentContainer) {
  const chart = parentContainer.querySelector('.chart-div');
  chart.classList.remove('d-none');
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



function drowingBarChartForOrderByDays() {
  const days = orderByDay.map(item => item.day_name);
  const orders = orderByDay.map(item => item.orders_count);
  const sales = orderByDay.map(item => item.total_sales);

  const ctx = document.getElementById("barChart");

  if (days.length === 0) {
    const msgDiv = barChartCard.querySelector('.message-chart');
    displayContainer(msgDiv);
    return;
  }

  displayChartContainer(barChartCard);




  new Chart(ctx, {
    data: {
      labels: days,
      datasets: [
        {
          type: "bar",
          label: "",
          data: orders,
          backgroundColor: "rgba(33,150,243,0.7)",
          yAxisID: "yOrders",
          maxBarThickness: 30,
          hoverBackgroundColor: "#1565C0",
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
}
function drowingPieChartFroItemBySales() {
  const ctx = document.getElementById('pieChart');
  const labels = salesByItems.map(item => item.name);

  if (labels.length === 0) {
    const msgDiv = pieChartCard.querySelector('.message-chart');
    displayContainer(msgDiv);
    return;
  }
  displayChartContainer(pieChartCard);

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

}