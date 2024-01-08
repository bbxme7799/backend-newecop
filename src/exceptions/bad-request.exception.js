import { BaseErrorException } from "./base-error.exception.js";

export class BadRequestException extends BaseErrorException {
  statusCode = 400;
  constructor(message) {
    super(message);
  }
  serializeError() {
    return { message: this.message };
  }
}