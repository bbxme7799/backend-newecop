import { ZodError } from "zod";
import { RequestValidationException } from "../exceptions/request-validation.exception.js";

export function validateRequestMiddleware(validators) {
  return async (req, res, next) => {
    try {
      if (validators.params) {
        req.params = await validators.params.parseAsync(req.params);
      }
      if (validators.body) {
        req.body = await validators.body.parseAsync(req.body);
      }
      if (validators.query) {
        req.query = await validators.query.parseAsync(req.query);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new RequestValidationException(error));
      } else {
        next(error);
      }
    }
  };
}