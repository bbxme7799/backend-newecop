import { BaseErrorException } from "./base-error.exception.js";

export class NotFoundRequestException extends BaseErrorException {
  statusCode = 404;
  constructor() {
    super("Route not found.");
  }
  serializeError() {
    return { message: "Not found." };
  }
}