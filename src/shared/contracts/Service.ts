import { Either } from '../../core/errors/Either';
import { ServiceError } from '../../core/errors/ServiceError';

export abstract class Service<
  Request = unknown,
  Errors extends ServiceError | null = null,
  Response = null,
> {
  abstract execute(
    props: Request,
    ctx?: unknown,
  ): Promise<Either<Errors, Response>>;
}
