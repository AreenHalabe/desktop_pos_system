export function showAuthExpired(message) {
  bootbox.confirm({
    title: "انتهت صلاحية الجلسة",
    message: message,
    centerVertical: true,
    closeButton: false,
    backdrop: 'static',
    keyboard: false,
    buttons: {
      confirm: {
        label: 'تسجيل الدخول',
        className: 'btn-primary'
      },
      cancel: {
        className: 'd-none'
      }
    },
    callback: function (result) {
      if (result) {
        window.location.href = '../../mainWindow.html';
      }
    }
  });
}


export function bootboxConfirm(e, options = {}) {
  e.preventDefault();

  const {
    message = 'هل أنت متأكد؟',
    loadingText = 'جاري التنفيذ...',
    onConfirm
  } = options;

  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const dataset = { ...btn.dataset };

  bootbox.confirm({
    title: '<i class="bi bi-exclamation-triangle text-danger"></i> تحذير',
    message: message,
    centerVertical: true,
    closeButton: false,
    buttons: {
      confirm: {
        label: 'نعم',
        className: 'btn-danger'
      },
      cancel: {
        label: 'إلغاء',
        className: 'btn-secondary'
      }
    },
    callback(result) {
      //  if (parentModal) {
      //   parentModal.classList.remove('dimmed');
      // }

      if (!result) return;

      // تعطيل الزر وتغيير النص مع Spinner
      // btn.disabled = true;
      // btn.innerHTML = `
      //       ${loadingText}
      //       <span class="spinner-border spinner-border-sm ms-1"></span>
      //   `;

      // استدعاء الفنكشن الممرر
      if (typeof onConfirm === 'function') {
        onConfirm({ ...dataset });
      }
    }
  });

  return false;
}


export function bootboxError(message = "حدث خطأ أثناء تنفيذ العملية") {
  bootbox.alert({
    title: `
      <div class="d-flex justify-content-between align-items-center">
        <span class="fw-bold text-danger">خطأ</span>
      </div>
    `,
    message: `
      <div class="text-center">
        <i class="bi bi-x-circle-fill text-danger" style="font-size:3rem;"></i>
        <p class="mt-1 mb-0 fw-semibold">${message}</p>
      </div>
    `,
    centerVertical: true,
    closeButton: false,
    buttons: {
      ok: {
        label: "إغلاق",
        className: "btn-danger px-4"
      }
    }
  });
}


export function bootboxSuccess(
  message = "تمت العملية بنجاح",
  onPrint = null,
  hasPrint = false,
  onClose = null,
) {
  bootbox.dialog({
    title: `
      <div class="d-flex justify-content-between align-items-center">
        <span class="fw-bold">نجاح العملية</span>
      </div>
    `,
    message: `
      <div class="text-center">
        <i class="bi bi-check-circle-fill text-success" style="font-size:3rem;"></i>
        <p class="mt-1 mb-0 fw-semibold">${message}</p>
      </div>
    `,
    centerVertical: true,
    closeButton: false,
    buttons: hasPrint
      ? {
        print: {
          label: "طباعة",
          className: "btn-primary px-4",
          callback:async function () {
            if (typeof onPrint === "function") {
             await onPrint();
            }
            setTimeout(() => {
              if (typeof onClose === "function") {
                onClose();
              }
            }, 100);

          }
        },
        cancel: {
          label: "إغلاق",
          className: "btn-secondary px-4",
          callback: function () {
            if (typeof onClose === "function") {
              onClose();
            }
          }
        }
      }
      : {
        ok: {
          label: "تم",
          className: "btn-success px-4",
          callback: function () {
            if (typeof onClose === "function") {
              onClose();
            }
          }
        }
      }
  });
}


export function setActiveNavLink() {
  const currentPath = window.location.pathname.replace(/\/$/, '');

  document.querySelectorAll('.nav-link').forEach(link => {
    const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/$/, '');

    link.classList.toggle('active', linkPath === currentPath);
  });
}

export function showError(errorBox, message) {
  if (errorBox.classList.contains('hidden')) {
    errorBox.classList.remove('hidden');
    errorBox.innerHTML = message;
  }
}

export function hiddeError(errorBox) {
  if (!errorBox.classList.contains('hidden')) {
    errorBox.innerHTML = '';
    errorBox.classList.add('hidden');
  }
}




let printLoaderDialog = null;

export function showPrintLoader(message = "جاري الطباعة...") {
  if (printLoaderDialog) return;

  printLoaderDialog = bootbox.dialog({
    closeButton: false,
    backdrop: true,
    centerVertical: true,
    message: `
        <div class="text-center py-4">
            <div class="spinner-border text-primary mb-3"
                  style="width:3rem;height:3rem;"
                  role="status">
            </div>

            <div class="fw-bold fs-5">
                ${message}
            </div>
        </div>
    `
  });
}

export function hidePrintLoader() {
  if (printLoaderDialog) {
     $('.bootbox.modal').modal('hide').remove();
    printLoaderDialog = null;
  }
}