const listeners: Record<string, Function[]> = {};

export const on = (event: string, fn: Function) => {
  (listeners[event] ||= []).push(fn);
};

export const emit = (event: string, data: any) => {
  (listeners[event] || []).forEach(fn => fn(data));
};
