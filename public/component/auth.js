
export function getAuthToken(role) {
  return sessionStorage.getItem(role);
}

export function setAuthToken(role , token) {
  sessionStorage.setItem(role, token);
}


export function removeAuthToken() {
  sessionStorage.removeItem('auth');
  sessionStorage.removeItem('user-auth');
  sessionStorage.removeItem('id');
}

export function setAdminId(id){
  sessionStorage.setItem('id' , id);
}
export function getAdminId(){
  return sessionStorage.getItem('id');
}
