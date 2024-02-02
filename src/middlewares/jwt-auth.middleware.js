import jwt from "jsonwebtoken";
import config from "../config/index.js";
import { NotAuthorizeRequestException } from "../exceptions/not-authorize-request.exception.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const jwtAuthMiddleware = async (req, res, next) => {
  if (!req.session?.jwt) {
    throw new NotAuthorizeRequestException();
  }

  try {
    const payload = jwt.verify(req.session.jwt, config.jwtSecretKey);
    console.log("🚀 payload:", payload);

    // ดึงข้อมูลผู้ใช้จากฐานข้อมูลโดยใช้ไอดีจาก JWT
    const user = await prisma.user.findUnique({
      where: {
        id: payload.id,
      },
    });

    if (!user) {
      throw new NotAuthorizeRequestException("User not found");
    }

    if (user.is_banned) {
      return res
        .status(403)
        .json({ message: "You are banned from the system." });
    }

    req.currentUser = payload;
    next();
  } catch (err) {
    console.log(err);
    throw new NotAuthorizeRequestException();
  }
};
