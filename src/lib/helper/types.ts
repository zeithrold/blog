export type TaskProduct<
  T extends (...args: any[]) => (() => any),
> = Awaited<ReturnType<ReturnType<T>>>
