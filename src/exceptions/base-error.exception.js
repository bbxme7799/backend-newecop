export class BaseErrorException extends Error {
    statusCode = 400;
    constructor(message) {
      super(message);
    }
    serializeError() {
      return { message: this.message };
    }
  }
  