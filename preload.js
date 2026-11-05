// import { contextBridge, ipcRenderer } from "electron";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
    printInvoice: (html) => ipcRenderer.invoke('print-invoice', html),
    getPort: () => ipcRenderer.invoke("get-port"),
    backupDatabase: () => ipcRenderer.invoke("backup-database"),
    previewInvoice: (invoiceContent) =>  ipcRenderer.invoke('preview-invoice', invoiceContent),

    getPosTreeCache: () => ipcRenderer.invoke('get-pos-tree-cache'),
    setPosTreeCache: (data) => ipcRenderer.invoke('set-pos-tree-cache', data),
    clearPosTreeCache: () => ipcRenderer.invoke('clear-pos-tree-cache'),
    
});




