import { showAuthExpired, setActiveNavLink} from "../../../component/bootbox.js";
import{ displayLoader, hiddeLoader, displayError, observer, displayContainer, hiddeContainer } from "./shared-functionality.js";
import { url, urlServer } from "../../../api/urlEndPoint.js";
import {getAuthToken , removeAuthToken} from "../../../component/auth.js";


const header            = document.querySelector("site-header");
const tableCard         = document.getElementById('tableCard');
const headerSummeryCard = document.getElementById('headerSummeryCard');

const topLeastSellingItemsCard = document.getElementById('topLeastSellingItemsCard');
const leastSellingCard         = document.getElementById('leastSellingCard');
const topSellingCard           = document.getElementById('topSellingCard');
const analysesAndInsightsCard  = document.getElementById('analysesAndInsightsCard');
let currentPage ;
let itemsPerPage = 15;
let totalItems;
let totalPages;

let dataAnalysis = [];

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
    logoutFrom.addEventListener("submit" , async function(e) {
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


document.addEventListener("DOMContentLoaded", async function() {
    displayLoader();
    await loadItemsAnalysis();
    hiddeLoader();
});


document.querySelectorAll(".reveal").forEach(el => {
  observer.observe(el);
});


document.addEventListener("click", async function (e) {

    if(e.target.closest('.prevBtn')) {
        prevPage();
    }
    else if(e.target.closest('.nextBtn')) {
        nextPage();
    }
});


async function loadItemsAnalysis() {
    try{
        const res = await fetch(urlServer + `/reports/items-selling-details` ,{
            method: 'GET',
                headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });

        const data = await res.json();

        if(res.status === 401){
            showAuthExpired(data.message);
        }
        else if(res.status === 200){
            if(data.item_analysis.length === 0){
                renderItemsTable([]);
                return;
            }
            handelTotalPage(data.item_analysis.length);
            setHeaderSummry(data.item_analysis);
            dataAnalysis = data.item_analysis;
            renderItemsTable(data.item_analysis);

            drowingPieChartFroItemBySales(topSellingCard, data.item_analysis);
            drowingPieChartFroItemBySales(leastSellingCard, data.item_analysis, false);
            displayContainer(topLeastSellingItemsCard);
            setAnalysesAndInsights(data.item_analysis);
            return;
        }
        else{
            displayError(data.message);
        }
    }catch(err){
        displayError(err.message);
    }
}

function setHeaderSummry(data){
    const length = data.length;
    const totalRevenue = document.getElementById('totalRevenue');

    const topSellingItemName  = document.getElementById('topSellingItemName');
    const topSellingItemValue = document.getElementById('topSellingItemValue');

    const leastSellingItemName  = document.getElementById('leastSellingItemName');
    const leastSellingItemValue = document.getElementById('leastSellingItemValue');
    
    totalRevenue.textContent = `${data[0].total_revenue} ₪`;

    topSellingItemName.textContent  = data?.[0]?.name ?? "لا يوجد بيانات";
    topSellingItemValue.textContent = data?.[0]?.quantity 
        ? `${data[0].quantity} طلب`
        : "";

    leastSellingItemName.textContent = data?.[data?.length - 1]?.name ?? "لا يوجد بيانات";

    leastSellingItemValue.textContent = data?.[data?.length - 1]?.quantity !== undefined
        ? `${data[data.length - 1].quantity} طلب`
        : "";

    displayContainer(headerSummeryCard);
    
}

function setAnalysesAndInsights(items){
     const length = items.length;
     if(length === 0 ){
        displayContainer(analysesAndInsightsCard);
     }
    const topItemDemand   = document.getElementById('topItemDemand');
    const leastItemDemand = document.getElementById('leastItemDemand');
    const highRevLowDem   = document.getElementById('highRevLowDem');
    const highDemLowRev   = document.getElementById('highDemLowRev');
   

    const avgQty               = getAvgQty(items);
    const avgRevenue           = getAvgRevenue(items);
    const highRevLowDemandItem = getHighRevenueLowDemand(items, avgQty, avgRevenue);
    const highDemandLowRevItem = getHighDemandLowRevenue(items, avgQty, avgRevenue);

    topItemDemand.textContent   = `${items[0].name} (${items[0].quantity} طلب)`;
    leastItemDemand.textContent = `${items[length - 1].name} (${items[length - 1].quantity} طلب)`;

    highRevLowDem.innerHTML = highRevLowDemandItem
    ? `
        <span class="text-muted">
        ${highRevLowDemandItem.name}
        
            -
            
        (${highRevLowDemandItem.quantity} طلب • ${highRevLowDemandItem.total_sales} ₪)
        </span>
    `
    : `<span class="text-muted">لا توجد منتجات بإيراد مرتفع وطلب منخفض، مما يدل على أداء متوازن للمنتجات.</span>`;


    highDemLowRev.innerHTML = highDemandLowRevItem
    ? `
        <span class="text-muted">
        ${highDemandLowRevItem.name}

            -

          (${highDemandLowRevItem.quantity} طلب • ${highDemandLowRevItem.total_sales} ₪)
        
        </span>
    `
    : `<span class="text-muted">لا توجد منتجات بطلب مرتفع وإيراد منخفض، مما يشير إلى تسعير مناسب.</span>`;


    displayContainer(analysesAndInsightsCard);
}


function getAvgQty(items){
    if(items.length === 0) return 0;
    const avgQty = items.reduce((sum, i) => sum + i.quantity, 0) / items.length;
    return avgQty;
}
function getAvgRevenue(items){
    if(items.length === 0) return 0;
    const avgRevenue = items[0].total_revenue / items.length;
    return avgRevenue;
}
function getHighRevenueLowDemand(items, avgQty, avgRevenue){
    const highRevenueLowDemand = items.find(i =>
        i.total_sales > avgRevenue && i.quantity < avgQty
    );
    return highRevenueLowDemand;
} 
function getHighDemandLowRevenue(items, avgQty, avgRevenue){
    const highDemandLowRevenue = items.find(i =>
        i.quantity > avgQty && i.total_sales < avgRevenue
    );
    return highDemandLowRevenue;
} 







function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderItemsTable(dataAnalysis);
    }
}
function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        renderItemsTable(dataAnalysis);
    }
}
function handelTotalPage(numOfItems){
    if(numOfItems == 0) return;
    currentPage = 1;
    totalItems = numOfItems;
    totalPages = Math.ceil(totalItems / itemsPerPage);
}
function updatePagination() {
    const pageInfo = document.getElementById('pageInfo');
    // تحديث معلومات الصفحة
    pageInfo.textContent = `صفحة ${currentPage} من ${totalPages}`;
    
    // إخفاء/إظهار الأسهم
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages;
}


function renderItemsTable(items){
    const tableBody = document.getElementById('items-table-body');

    if (items.length === 0) {
        tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>لا يوجد بيانات للعرض</p>
            </td>
        </tr>
        `;
        hiddenPaginationBtn();
        displayContainer(tableCard);
        return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = items.slice(start, end);

    tableBody.innerHTML='';

    let counter = (currentPage * 15) - (15);
    tableBody.innerHTML = pageItems.map(i => {
        
        return `
        <tr>
            <td class="text-center" >${(++counter).toString().padStart(3, '0')}</td>
            <td class="text-center">${i.name}</td>
            <td class="text-center">${i.quantity}</td>
            <td class="text-center">${i.total_sales} ₪</td>
            <td class="text-center">%${i.sales_percentage}</td>
        </tr>
        `;
    }).join('');

    updatePagination();
    displayPaginationBtn();
    displayContainer(tableCard);
}







function displayPaginationBtn(){
  const btnContainer = document.getElementById('paginationBtn');
  btnContainer.classList.remove('d-none');  
}
function hiddenPaginationBtn(){
    const btnContainer = document.getElementById('paginationBtn');
    btnContainer.classList.add('d-none');  
}



function drowingPieChartFroItemBySales(container, salesByItems, isTopItems = true){
    const pieChartContainer = container.querySelector('.pieChartContainer');
    const messageContainer  = container.querySelector('.messageContainer');
    const ctx               = container.querySelector('.pieChart');

    if(salesByItems.length === 0){
        hiddeContainer(pieChartContainer);
        displayContainer(messageContainer);
        return;
    }

    let labels, quantitiesItems;

    if(isTopItems){
        labels = salesByItems.slice(0, 5).map(item => item.name);
        quantitiesItems = salesByItems.slice(0, 5).map(item => item.quantity);
    }
    else{
        labels = salesByItems.slice(-5).map(item => item.name);
        quantitiesItems = salesByItems.slice(-5).map(item => item.quantity);
    }

   

    
   // const quantitiesItems = salesByItems.slice(0, 5).map(item => item.quantity);

    const quantities = salesByItems.map(item => item.quantity);
    const totalQuantity = quantities.reduce((sum, q) => sum + q, 0);

    Chart.getChart(ctx)?.destroy();
    
    new Chart(ctx, {
        type: "pie",

        data: {
            labels: labels,
            datasets: [{
                data: quantitiesItems,
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
                        afterLabel: function(context) {
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
                    formatter: function(value) {
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