export abstract class Controller<K = void> {
  abstract handle(...args: unknown[]): Promise<K>;
}
