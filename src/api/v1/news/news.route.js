import express from "express";
import {
  createNews,
  getNews,
  updateNews,
  deleteNews,
  searchNews,
} from "./news.controller.js";
import { validateRequestMiddleware } from "../../../middlewares/validate-request.middleware.js";
// import {
//   SigninSchema,
//   SignupSchema,
// } from "./auth.schema.js";
const router = express.Router();

// Route to get all news
router.get("/", getNews);
router.get("/search", searchNews);
router.post("/create", createNews); // Create a new News
router.get("/:id", getNews); // Read a specific News by ID
router.put("/:id", updateNews); // Update a specific News by ID
router.delete("/:id", deleteNews); // Delete a specific News by ID

export { router as newsRoute };
