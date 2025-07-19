import { ServiceError } from '../../core/errors/ServiceError';

export class QueueError extends ServiceError {
  constructor(message: string = 'Error when trying to add job to queue') {
    super(message, 503);
  }
}

export class SummaryError extends ServiceError {
  constructor(message: string = 'Error when trying get payments summary') {
    super(message, 500);
  }
}

export class DatabaseError extends ServiceError {
  constructor(message: string = 'A database error occurred') {
    super(message, 500);
  }
}

export class PaymentProcessorError extends ServiceError {
  constructor(
    message: string = 'The external payment processor is unavailable',
  ) {
    super(message, 503);
  }
}

export class UnexpectedResultError extends ServiceError {
  constructor(
    message: string = 'An unexpected result was returned from a dependency',
  ) {
    super(message, 500);
  }
}
