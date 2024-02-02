import { NotAuthorizeRequestException } from "../exceptions/not-authorize-request.exception.js";
import { ForbiddenRequestException } from "../exceptions/forbidden-request.exception.js";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const roleMiddleware = (roleToCheck) => {
  return async (req, res, next) => {
    try {
      const userId = req.currentUser.id;

      // ใช้ Prisma เพื่อดึงข้อมูลผู้ใช้จากฐานข้อมูล
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) {
        // ถ้าไม่พบข้อมูลผู้ใช้ ให้ส่งข้อผิดพลาด
        throw new NotAuthorizeRequestException("User not found");
      }

      const userRole = user.role; // ดึง Role จากข้อมูลผู้ใช้
      console.log("🚀 userRole:", userRole);

      if (userRole === roleToCheck) {
        // ผู้ใช้มี Role ตามที่ต้องการ ทำการผ่านไปยัง middleware/handler ถัดไป
        next();
      } else {
        // ผู้ใช้ไม่มี Role ที่ต้องการ ส่งข้อผิดพลาด
        throw new ForbiddenRequestException("Permission denied");
      }
    } catch (error) {
      // จัดการข้อผิดพลาดที่เกิดขึ้น
      console.error("Error in roleMiddleware:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };
};