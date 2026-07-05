// import { contextBridge, ipcRenderer } from "electron";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
    printInvoice: (html) => ipcRenderer.invoke('print-invoice', html)
});




