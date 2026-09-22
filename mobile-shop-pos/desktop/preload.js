const { contextBridge, ipcRenderer }=require('electron');
contextBridge.exposeInMainWorld('desktop',Object.freeze({
  backup: token=>ipcRenderer.invoke('pos:backup',token),
  restore: token=>ipcRenderer.invoke('pos:restore',token),
  print: ()=>ipcRenderer.invoke('pos:print')
}));
