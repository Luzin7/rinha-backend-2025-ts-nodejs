export interface Controller {
  handle(...args: unknown[]): Promise<void>;
}
