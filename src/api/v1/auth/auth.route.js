import express from "express";
import {
  signin,
  signout,
  signup,
  verifyEmail,
  requestPasswordReset,
  resetPassword
} from "./auth.controller.js";
import { validateRequestMiddleware } from "../../../middlewares/validate-request.middleware.js";
import {
  SigninSchema,
  SignupSchema,
} from "./auth.schema.js";
const router = express.Router();


  // Route to request password reset
router.post(
    "/resetpassword/request",
    // validateRequestMiddleware({ body: ResetPasswordSchema }),
    requestPasswordReset,
  );

router.post("/resetpassword",
// validateRequestMiddleware({ body: ResetPasswordSchema }),
resetPassword
);

router.post(
  "/signin",
  validateRequestMiddleware({ body: SigninSchema }),
  signin
);
router.post(
  "/signup",
  validateRequestMiddleware({ body: SignupSchema }),
  signup
);

router.get("/verify/:email", verifyEmail);

router.post("/signout", signout);

export { router as authRoute };