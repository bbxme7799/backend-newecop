import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
const prisma = new PrismaClient();
import bcrypt from "bcryptjs";
import config from "../../../config/index.js";
import { BadRequestException } from "../../../exceptions/bad-request.exception.js";
import crypto from "crypto";
import { NotAuthorizeRequestException } from "../../../exceptions/not-authorize-request.exception.js";
import nodemailer from "nodemailer";

export const sendVerificationEmail = async (
  email,
  username,
  verificationToken
) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    auth: {
      user: "bbrmforwork@gmail.com",
      pass: "dehihafodfvnluyj",
    },
  });

  const mailOptions = {
    from: "bbrmforwork@gmail.com",
    to: email,
    subject: "Verify Your Email",
    html: `
    <p>Dear ${username},</p>
    <p>Thank you for registering with our platform. Please click the following link to verify your email:</p>
    <a href="${process.env.BACKEND_URL_CSR}/users/signup/verify/?email=${email}&token=${verificationToken}">Verify Email</a>
    <p>If you didn't register, please ignore this email.</p>
  `,
  };

  await transporter.sendMail(mailOptions);
};

export const signup = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const eUser = await prisma.user.findFirst({
      where: { email: email },
    });

    if (eUser) {
      throw new BadRequestException("Email already used.");
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    // Generate a random verification token
    const verificationToken = crypto.randomBytes(20).toString("hex");

    const result = await prisma.user.create({
      data: {
        username: username,
        email: email,
        password: hash,
        is_verified: false,
        verificationToken: verificationToken, // Use the correct field name
      },
    });

    await sendVerificationEmail(email, username, verificationToken);

    const { password: _, ...newObj } = result;
    res.status(201).json({ user: newObj });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { email } = req.params;
    const { token } = req.query;
    const user = await prisma.user.findFirst({
      where: { email: email, verificationToken: token }, // เปรียบเทียบ token
    });

    if (!user) {
      return res
        .status(400)
        .json({ error: "User not found or invalid token." });
    }

    if (user.is_verified) {
      return res.status(200).json({ message: "Email already verified." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        is_verified: true,
        verificationToken: null, // อัปเดตค่า token เป็น null เมื่อยืนยันแล้ว
      },
    });

    res.status(200).json({ message: "Email verified successfully." });
  } catch (error) {
    console.error(error);
    next(error);
  }
};


export const signin = async (req, res, next) => {
    try {
      const { email, password } = req.body;
  
      const eUser = await prisma.user.findFirst({
        where: { email: email },
      });
  
      if (!eUser) {
        throw new BadRequestException("Invalid credentials");
      }
  
      const match = bcrypt.compareSync(password, eUser.password);
      if (!match) {
        throw new BadRequestException("Invalid Credentials");
      }
  
      if (!eUser.is_verified) {
        throw new BadRequestException("Email is not verified");
      }
  
      const userJwt = jwt.sign(
        {
          id: eUser.id,
          email: eUser.email,
          role: eUser.role,
          is_banned: eUser.is_banned,
        },
        config.jwtSecretKey
      );
  
      req.session = {
        jwt: userJwt,
      };
  
      const { password: _, ...newObj } = eUser;
      res.status(200).json({ message: "success" });
    } catch (error) {
      console.log(error);
      next(error);
    }
  };


export const signout = async (req, res, next) => {
  try {
    req.session = null;
    res.json({});
  } catch (error) {
    console.log(error);
    next(error);
  }
};