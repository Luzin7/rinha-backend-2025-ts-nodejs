import { Either } from '../errors/Either';
import { ServiceError } from '../errors/ServiceError';

export interface Service<
  Request = unknown,
  Errors extends ServiceError | null = null,
  Response = null,
> {
  execute(props: Request, ctx?: unknown): Promise<Either<Errors, Response>>;
}
