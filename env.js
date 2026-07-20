

export function getPortNumber() {

  return sessionStorage.getItem("PORT");

}

export function setPortNumber(port) {

  sessionStorage.setItem(
    "PORT",
    port
  );

}

