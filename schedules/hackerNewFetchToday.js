import cron from "node-cron";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import puppeteer from "puppeteer";
import path from "path";
import dotenv from "dotenv";
import fs from "fs/promises";
dotenv.config();

const prisma = new PrismaClient();
export const hackerNewFetchToday = async () => {
  //every 1 minitue
  cron.schedule("*/ * * * *", async () => {
//   cron.schedule("0 0 * * *", async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
    
        // เข้าไปที่เว็บไซต์
        await page.goto('https://thehackernews.com/');
    
        // รอให้หน้าเว็บโหลดเสร็จ
        await page.waitForTimeout(5000);
    
        // ดึงข้อมูลจาก element ที่มี class "h-datetime"
        const dateTimeElement = await page.$('.h-datetime');
        const dateTimeText = await (dateTimeElement ? dateTimeElement.evaluate(node => node.innerText) : '');
        console.log("🚀 ~ file: hackerNewFetchToday.js:28 ~ //cron.schedule ~ dateTimeText:", dateTimeText)
    
        // ดึงวันที่และเวลาปัจจุบัน
        const currentDate = new Date();
        const currentDateTime = currentDate.toDateString(); // ตัดเวลาเวลาออก
        console.log("🚀 ~ file: hackerNewFetchToday.js:32 ~ //cron.schedule ~ currentDateTime:", currentDateTime)
    
        // เปรียบเทียบเวลา
        if (dateTimeText === currentDateTime) {
          console.log('เวลาตรงกัน');
        } else {
          console.log('เวลาไม่ตรงกัน');
        }
    
        await browser.close();
      } catch (error) {
        console.error('เกิดข้อผิดพลาด:', error);
      }

  });
};