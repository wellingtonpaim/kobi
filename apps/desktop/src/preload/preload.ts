import { contextBridge, ipcRenderer } from 'electron';

import {
  CHANNELS,
  type CurrentDisplay,
  type KobiBridge,
  type Region,
  type ScreenPoint,
} from '../shared/api.js';

const bridge: KobiBridge = {
  moveTo: (topLeft: ScreenPoint) => {
    ipcRenderer.send(CHANNELS.moveTo, topLeft);
  },
  setInteractiveRegion: (regions: readonly Region[]) => {
    ipcRenderer.send(CHANNELS.setInteractiveRegion, regions);
  },
  setSilhouette: (silhouette: Region) => {
    ipcRenderer.send(CHANNELS.setSilhouette, silhouette);
  },
  setDiagnosticsArea: (area: Region | undefined) => {
    ipcRenderer.send(CHANNELS.setDiagnosticsArea, area);
  },
  dragStart: (cursor: ScreenPoint) => {
    ipcRenderer.send(CHANNELS.dragStart, cursor);
  },
  dragMove: (cursor: ScreenPoint) => {
    ipcRenderer.send(CHANNELS.dragMove, cursor);
  },
  dragEnd: (cursor: ScreenPoint) => ipcRenderer.invoke(CHANNELS.dragEnd, cursor),
  showMenu: () => {
    ipcRenderer.send(CHANNELS.showMenu);
  },
  planTour: () => ipcRenderer.invoke(CHANNELS.planTour),
  onStartTour: (listener) =>
    ipcRenderer.on(CHANNELS.startTour, () => {
      listener();
    }),
  onToggleDiagnostics: (listener) =>
    ipcRenderer.on(CHANNELS.toggleDiagnostics, () => {
      listener();
    }),
  onDisplayChanged: (listener) =>
    ipcRenderer.on(CHANNELS.displayChanged, (_, display: CurrentDisplay) => {
      listener(display);
    }),
  onWindowMoved: (listener) =>
    ipcRenderer.on(CHANNELS.windowMoved, (_, topLeft: ScreenPoint) => {
      listener(topLeft);
    }),
};

contextBridge.exposeInMainWorld('kobi', bridge);
