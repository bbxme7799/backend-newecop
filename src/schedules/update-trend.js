import axios from 'axios';
import cheerio from 'cheerio';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { PrismaClient } from "@prisma/client";

// URL ของเว็บไซต์
const url = 'https://thehackernews.com/';

const prisma = new PrismaClient();

// ฟังก์ชันสำหรับทำ HTTP request ด้วย Axios
async function fetchData(url) {
  try {
    const response = await axios.get(url);
    // ตรวจสอบว่า request สำเร็จหรือไม่
    if (response.status === 200) {
      return response.data;
    }
  } catch (error) {
    throw new Error('Error fetching data:', error);
  }
}

// ฟังก์ชันสำหรับใช้ Cherrio เพื่อแกะข้อมูลจาก HTML
function parseHTML(html) {
  const $ = cheerio.load(html);

  // ลบ elements ที่มี class="header clear"
  $('.header.clear').remove();

  // ลบ elements ที่มี class="left-box"
  $('.left-box').remove();

  // ลบ elements ที่มี class="below-post-box cf"
  $('.below-post-box.cf').remove();

  // ลบ elements ที่มี class="footer-stuff clear cf"
  $('.footer-stuff.clear.cf').remove();

  // ดึงข้อมูลจาก pop-title
  const titles = [];
  $('.pop-title').each((index, element) => {
    titles.push($(element).text());
  });


  console.log("🚀 ~ parseHTML ~ titles:", titles)
  // คืนค่า object ที่มี cleanedHTML และ titles
  return { cleanedHTML: $.html(), titles };
  
}

// ฟังก์ชันสำหรับค้นหาชื่อข่าวในตาราง news และอัพเดตในตาราง trend_new
async function searchAndSetTrending(titles) {
  try {
    for (const title of titles) {
      // ค้นหาข้อมูลในตาราง news
      const existingNews = await prisma.news.findFirst({
        where: {
          title: title,
        },
      });

      // ถ้าเจอข้อมูลในตาราง news
      if (existingNews) {
        // ทำการอัปเดตในตาราง news เป็น Trending News
        await prisma.news.update({
          where: {
            id: existingNews.id,
          },
          data: {
            trend_new: 'Trending News',
          },
        });

        console.log(`News "${title}" is now marked as Trending News in the database.`);
      }
    }
  } catch (error) {
    console.error('Error searching and updating:', error);
  }
}


// ฟังก์ชันสำหรับค้นหาและอัปเดต trend_new
async function searchAndResetTrending(titles) {
  try {
    // ค้นหาข้อมูลทั้งหมดที่มี trend_new เป็น "Trending News"
    const trendingNews = await prisma.news.findMany({
      where: {
        trend_new: 'Trending News',
      },
    });

    // ถ้ามีข่าวที่มี trend_new เป็น "Trending News"
    if (trendingNews.length > 0) {
      for (const news of trendingNews) {
        // ตรวจสอบว่าชื่อข่าวอยู่ใน titles หรือไม่
        const isTitleInTitles = titles.includes(news.title);

        // ถ้าชื่อไม่อยู่ใน titles ที่ได้รับมา
        if (!isTitleInTitles) {
          // ทำการอัปเดตเป็น "Normal"
          await prisma.news.update({
            where: {
              id: news.id,
            },
            data: {
              trend_new: 'Normal',
            },
          });

          console.log(`News "${news.title}" is now marked as Normal.`);
        }
      }
    }
  } catch (error) {
    console.error('Error searching and resetting Trending News:', error);
  }
}


// ฟังก์ชันหลักสำหรับทำงานทุก 1 นาที
export async function fetchDataAndSave() {
  try {
    const htmlData = await fetchData(url);
    const { cleanedHTML, titles } = parseHTML(htmlData);
     // ค้นหาและรีเซ็ต Trending News ที่มีเดือนของข่าวไม่ตรง
     await searchAndResetTrending(titles);

    await searchAndSetTrending(titles);
    console.log('Data saved to the database.');
  } catch (error) {
    console.error(error.message);
  }
}

// ตั้งค่า node-cron เพื่อทำงานทุก 1 นาที
cron.schedule('* * * * *', fetchDataAndSave);