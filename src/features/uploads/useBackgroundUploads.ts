import { useSyncExternalStore } from "react";

import { backgroundUploads } from "./uploadService";

const subscribe = backgroundUploads.subscribe.bind(backgroundUploads);
const getSnapshot = backgroundUploads.getSnapshot.bind(backgroundUploads);

export function useBackgroundUploads() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
