import { BaseErrorException } from "./base-error.exception.js";

export class RequestValidationException extends BaseErrorException {
  statusCode = 400;
  errors
  constructor(errors) {
    super("Invalid request parameters");
    this.errors = errors;
    // Only because we are extending a built in class
    Object.setPrototypeOf(this, RequestValidationException.prototype);
  }

  serializeError() {
    return this.errors.errors.map((err) => {
      return { message: err.message, field: err.path.toString() };
    });
  }
}