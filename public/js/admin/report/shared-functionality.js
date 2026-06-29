export function displayLoader(){
    const loaderCard  = document.getElementById('loaderCard');
    loaderCard.classList.remove('d-none');
}
export function hiddeLoader(){
    const loaderCard  = document.getElementById('loaderCard');
    loaderCard.classList.add('d-none');
}


export function displayError(err){
    const errorDev  = document.getElementById('error-dev');
    const errorList = document.getElementById('error-list');
    errorDev.classList.remove('d-none');

    errorList.innerHTML += 
    `
        <li class="list-group-item list-group-item-danger">
            ${err}
        </li>
    `
}
export function hiddeError(){
    const errorDev  = document.getElementById('error-dev');
    const errorList = document.getElementById('error-list');
    errorDev.classList.add('d-none');
    errorList.innerHTML = '';
}

export function formatDateTimeForServer(dt) {
    return dt.replace('T', ' ') + ':00';
}
export function validateDateRange(startInput, endInput) {
  const startValue = startInput.value;
  const endValue = endInput.value;

  const start = new Date(startValue);
  const end = new Date(endValue);

  if (start > end) {
    displayError("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
    return {
      valid: false,
    };
  }

  return {
    valid: true
  };

}


export const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {

            if (entry.isIntersecting) {
            entry.target.classList.add("show");

            // إذا بدك يظهر مرة واحدة فقط
            observer.unobserve(entry.target);
            }

        });

    }, {
        threshold: 0.15 // متى يبدأ الظهور (15% من العنصر ظاهر)
    }
);


export function displayContainer(container){
    container.classList.remove('d-none');
    container.classList.add('fade-in');
}
export function hiddeContainer(container){
    container.classList.add('d-none');
    container.classList.remove('fade-in');
}


export function formatHour(time, displayMinutes = false) {
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




export function toUTC(dateString) {
  // نحوله لصيغة ISO قابلة للفهم
  const normalized = dateString.replace(" ", "T");

  // نعتبره وقت محلي (فلسطين) عبر بناء Date
  const localDate = new Date(normalized);

  // نحوله UTC
  return localDate.toISOString();
}


export function utcToPalestine(datetime) {
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


export function formatTimeOnly(dateString) {
    const safeDate = dateString.replace(' ', 'T');
    const date = new Date(safeDate);

    return date.toLocaleTimeString('en-PS', {
        timeZone: 'Asia/Hebron',
        hour: '2-digit',
        minute: '2-digit',
    });
}
export function formatDateOnly(dateString) {

    const safeDate = dateString.replace(' ', 'T');
    const date = new Date(safeDate);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}