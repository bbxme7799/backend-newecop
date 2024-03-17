import express from "express";
import {
  createNews,
  getNews,
  updateNews,
  deleteNews,
  searchNews,
  logView,
  getViewCount
} from "./news.controller.js";
import { validateRequestMiddleware } from "../../../middlewares/validate-request.middleware.js";
// import {
//   SigninSchema,
//   SignupSchema,
// } from "./auth.schema.js";
import { jwtAuthMiddleware } from "../../../middlewares/jwt-auth.middleware.js";
import { roleMiddleware } from "../../../middlewares/roleMiddleware.js";
const router = express.Router();

// Route to get all news
router.get("/", getNews);
router.get("/search", searchNews);
router.post('/logView', logView);
router.get('/views', getViewCount);


router.post("/create",jwtAuthMiddleware, roleMiddleware(1), createNews); // Create a new News
router.put("/:id",jwtAuthMiddleware, roleMiddleware(1), updateNews); // Update a specific News by ID
router.delete("/:id",jwtAuthMiddleware, roleMiddleware(1), deleteNews); // Delete a specific News by ID

export { router as newsRoute };
