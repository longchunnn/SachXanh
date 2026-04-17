export type StoreLike = {
  getState: () => unknown;
  dispatch: (action: unknown) => unknown;
};

let storeRef: StoreLike | null = null;

export function setStoreRef(store: StoreLike): void {
  storeRef = store;
}

export function getStoreRef(): StoreLike | null {
  return storeRef;
}
