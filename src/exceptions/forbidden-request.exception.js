import { BaseErrorException } from "./base-error.exception.js";

export class ForbiddenRequestException extends BaseErrorException {
  statusCode = 403;
  constructor() {
    super("Forbidden resource.");
  }
  serializeError() {
    return { message: "Forbidden rsource." };
  }
}