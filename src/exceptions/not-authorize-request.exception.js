import { BaseErrorException } from "./base-error.exception.js";

export class NotAuthorizeRequestException extends BaseErrorException {
  statusCode = 401;
  constructor() {
    super("Not authorize.");
  }
  serializeError() {
    return { message: "Not authorize." };
  }
}