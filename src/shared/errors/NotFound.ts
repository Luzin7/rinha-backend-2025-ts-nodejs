import { ServiceError } from '../../core/errors/ServiceError';

export class NotFoundError extends ServiceError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}
