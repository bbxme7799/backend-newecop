import { NotAuthorizeRequestException } from "../exceptions/not-authorize-request.exception.js";
import { ForbiddenRequestException } from "../exceptions/forbidden-request.exception.js";

export const roleMiddleware = (roleToCheck) => {
  return (req, res, next) => {
    const userRole = req.currentUser.role; // Assuming the authenticated user's role is stored in req.user.role
    console.log("🚀 userRole:", userRole);
    if (userRole === roleToCheck) {
      next(); // User has the required role, proceed to the next middleware/handler
    } else {
      res.status(403).json({ message: "Permission denied." }); // User doesn't have the required role
    }
  };
};