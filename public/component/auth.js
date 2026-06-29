
export function getAuthToken(role) {
  return localStorage.getItem(role);
}

export function setAuthToken(role , token) {
  localStorage.setItem(role, token);
}


export function removeAuthToken() {
  localStorage.removeItem('auth');
  localStorage.removeItem('user-auth');
  localStorage.removeItem('id');
}

export function setAdminId(id){
  localStorage.setItem('id' , id);
}
export function getAdminId(){
  return localStorage.getItem('id');
}
