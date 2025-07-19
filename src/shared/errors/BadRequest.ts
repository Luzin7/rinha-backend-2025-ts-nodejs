import { ServiceError } from '../../core/errors/ServiceError';

export class BadRequestError extends ServiceError {
  constructor(message: string = 'Bad request') {
    super(message, 400);
  }
}
