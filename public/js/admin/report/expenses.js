import { showAuthExpired, setActiveNavLink, bootboxError,} from "../../../component/bootbox.js";
import{ formatTimeOnly, formatDateOnly, utcToPalestine } from "./shared-functionality.js";
import { url } from "../../../api/urlEndPoint.js";

import {getAuthToken, removeAuthToken} from "../../../component/auth.js";

let expences = [];

let currentPage = 1;


// ========================================
// Elements
// ========================================

const expensesTableBody =
    document.getElementById('expensesTableBody');

const expensesTableWrapper =
    document.getElementById('expensesTableWrapper');

const expensesLoading =
    document.getElementById('expensesLoading');

const expensesEmpty =
    document.getElementById('expensesEmpty');

const expensesPagination =
    document.getElementById('expensesPagination');

const expensesPaginationWrapper =
    document.getElementById('expensesPaginationWrapper');


const header = document.querySelector("site-header");

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


document.addEventListener('DOMContentLoaded', async function () {
    await loadExpenses();
});

// ========================================
// Load Transactions
// ========================================

async function loadExpenses(page = 1) {

    try {

        currentPage = page;

        showLoading();
        const res = await fetch(url + `/expenses/report?page=${page}`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `${getAuthToken('auth')}`
            },
        });
    
        const result = await res.json();
    
        if (res.status === 401) {
            showAuthExpired(result.message);
        }
        else if (res.status === 200) {
            expences = result.data;
            renderExpenses(expences);
            renderPagination(result.pagination);
        }
        else{
            bootboxError(result.message);
            throw new Error(
                result.message || 'حدث خطأ أثناء جلب المصروفات'
            );
        }

    } catch (error) {
        bootboxError(error.message);
        showError();

    } finally {
        hideLoading();
    }
}


// ========================================
// Render Expenses
// ========================================

function renderExpenses(expenses) {

    expensesTableBody.innerHTML = '';

    if (!expenses || expenses.length === 0) {

        expensesTableWrapper.classList.add('d-none');

        expensesEmpty.classList.remove('d-none');

        return;
    }

    expensesTableWrapper.classList.remove('d-none');

    expensesEmpty.classList.add('d-none');


    const fragment = document.createDocumentFragment();


    expenses.forEach(expense => {

        const tr = document.createElement('tr');
        expense.date = formatDateOnly(utcToPalestine(expense.created_at));
        expense.time = formatTimeOnly(utcToPalestine(expense.created_at));
        tr.innerHTML = `
            <td class="nowrap-cell">${expense.date}</td>
            <td class="nowrap-cell">${expense.time}</td>

            <td>
                <span class="badge bg-secondary">
                    ${escapeHtml(expense.type ?? '-')}
                </span>
            </td>

            <td class="fw-semibold text-danger">
                ${Number(expense.amount)} ₪
            </td>

            
            <td class="text-start">
                ${escapeHtml(expense.note ?? '-')}
            </td>
        `;

        fragment.appendChild(tr);

    });


    expensesTableBody.appendChild(fragment);
}


// ========================================
// Pagination
// ========================================

function renderPagination(pagination) {

    expensesPagination.innerHTML = '';

    if (!pagination) {
        expensesPaginationWrapper.classList.add('d-none');
        return;
    }


    const {
        page,
        totalPages
    } = pagination;


    if (!totalPages || totalPages <= 1) {

        expensesPaginationWrapper.classList.add('d-none');

        return;
    }


    expensesPaginationWrapper.classList.remove('d-none');


    // Previous
    const previousLi =
        document.createElement('li');

    previousLi.className =
        `page-item ${page <= 1 ? 'disabled' : ''}`;


    previousLi.innerHTML = `
        <button
            class="page-link expenses-page-btn"
            data-page="${page - 1}"
            ${page <= 1 ? 'disabled' : ''}
        >
            <i class="fa-solid fa-chevron-right"></i>
            السابق
        </button>
    `;


    expensesPagination.appendChild(previousLi);


    // Page numbers

    const pages = getPaginationPages(
        page,
        totalPages
    );


    pages.forEach(pageNumber => {

        if (pageNumber === '...') {

            const li =
                document.createElement('li');

            li.className =
                'page-item disabled';

            li.innerHTML = `
                <span class="page-link">
                    ...
                </span>
            `;

            expensesPagination.appendChild(li);

            return;
        }


        const li =
            document.createElement('li');

        li.className =
            `page-item ${pageNumber === page
                ? 'active'
                : ''
            }`;


        li.innerHTML = `
            <button
                class="page-link expenses-page-btn"
                data-page="${pageNumber}"
            >
                ${pageNumber}
            </button>
        `;


        expensesPagination.appendChild(li);

    });


    // Next

    const nextLi =
        document.createElement('li');

    nextLi.className =
        `page-item ${page >= totalPages
            ? 'disabled'
            : ''
        }`;


    nextLi.innerHTML = `
        <button
            class="page-link expenses-page-btn"
            data-page="${page + 1}"
            ${page >= totalPages ? 'disabled' : ''}
        >
            التالي
            <i class="fa-solid fa-chevron-left"></i>
        </button>
    `;


    expensesPagination.appendChild(nextLi);
}


// ========================================
// Pagination Pages Generator
// ========================================

function getPaginationPages(
    current,
    total
) {

    const pages = [];

    if (total <= 7) {

        for (
            let i = 1;
            i <= total;
            i++
        ) {
            pages.push(i);
        }

        return pages;
    }


    pages.push(1);


    if (current > 4) {
        pages.push('...');
    }


    const start =
        Math.max(2, current - 2);

    const end =
        Math.min(total - 1, current + 2);


    for (
        let i = start;
        i <= end;
        i++
    ) {
        pages.push(i);
    }


    if (current < total - 3) {
        pages.push('...');
    }


    pages.push(total);


    return pages;
}


// ========================================
// Loading
// ========================================

function showLoading() {

    expensesLoading.classList.remove('d-none');

    expensesTableWrapper.classList.add('d-none');

    expensesEmpty.classList.add('d-none');

    expensesPaginationWrapper.classList.add('d-none');
}


function hideLoading() {

    expensesLoading.classList.add('d-none');
}


// ========================================
// Error
// ========================================

function showError() {

    expensesTableWrapper.classList.add('d-none');

    expensesEmpty.classList.remove('d-none');

    expensesEmpty.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation fs-1 mb-3 text-danger"></i>

        <div class="fw-semibold text-danger">
            حدث خطأ أثناء تحميل المصروفات
        </div>

        <button
            type="button"
            class="btn btn-outline-primary mt-3 expenses-retry-btn"
        >
            <i class="fa-solid fa-rotate-right ms-1"></i>
            إعادة المحاولة
        </button>
    `;

    expensesPaginationWrapper.classList.add('d-none');
}


// ========================================
// Escape HTML
// ========================================

function escapeHtml(value) {

    const div =
        document.createElement('div');

    div.textContent =
        String(value ?? '');

    return div.innerHTML;
}


// ========================================
// Events
// ========================================

document.addEventListener('click', async (e) => {
    // Pagination
    const pageButton =
        e.target.closest(
            '.expenses-page-btn'
        );


    if (pageButton) {

        if (pageButton.disabled) {
            return;
        }


        const page = Number(pageButton.dataset.page);


        if (
            !Number.isInteger(page) ||
            page < 1 ||
            page === currentPage
        ) {
            return;
        }


        await loadExpenses(page);

        return;
    }


    // Retry
    if (e.target.closest('.expenses-retry-btn')) {
        await loadExpenses(currentPage);
        return;
    }

    if (e.target.closest(".print-invoice-btn")) {
        const overlayLoader = document.getElementById('overlay_loader');
        if (expences.length == 0) return;
        try {
            overlayLoader.classList.remove('d-none');
            await printExpenses(expences);
        } catch (e) {
            bootboxError(e.message);
        } finally {
            overlayLoader.classList.add('d-none');
        }

        return;

    }

}
);


