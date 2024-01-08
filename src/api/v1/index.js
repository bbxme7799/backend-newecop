import express from "express";
import { authRoute } from "./auth/auth.route.js";
import { newsRoute } from "./news/news.route.js";
// import { productsRoute } from "./products/products.route.js";
// import { usdRoute } from "./usd/usd.route.js";
// import { cartsRoute } from "./carts/carts.route.js";
// import { usersRoute } from "./users/users.route.js";
// import { ordersRoute } from "./orders/orders.route.js";
// import { blogRoute } from "./blog/blog.route.js";
// import { toupRouter } from "./topup/topup.route.js";
// import { transactoinsRouter } from "./transactions/transactions.route.js";

const router = express.Router();

router.use("/auth", authRoute);
router.use("/news", newsRoute);
// router.use("/carts", cartsRoute);
// router.use("/products", productsRoute);
// router.use("/usd", usdRoute);
// router.use("/users", usersRoute);
// router.use("/orders", ordersRoute);
// router.use("/blog", blogRoute);
// router.use("/topup", toupRouter);
// router.use("/transactoins", transactoinsRouter);

export default router;