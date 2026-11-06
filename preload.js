// import { contextBridge, ipcRenderer } from "electron";
const { contextBridge, ipcRenderer } = require("electron");


contextBridge.exposeInMainWorld("electronAPI", {
    printInvoice: (html) => ipcRenderer.invoke('print-invoice', html),
    getPort: () => ipcRenderer.invoke("get-port"),
    previewInvoice: (invoiceContent) =>  ipcRenderer.invoke('preview-invoice', invoiceContent),

    mainWindowPath: () => ipcRenderer.invoke('get-main-window-path')
});




