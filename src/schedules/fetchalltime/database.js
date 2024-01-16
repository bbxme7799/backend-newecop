// database.js
import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";

const prisma = new PrismaClient();


export  const JsonPushToDB = async () => {
    const prisma = new PrismaClient();
  
    try {
      const rawData = await fs.readFile("src/schedules/fetchalltime/article_data.json", "utf-8");
      const articles = JSON.parse(rawData);
  
      for (const article of articles) {
        const imgLinksString = article.imgLinks.join(", ").replace(/[\[\]]/g, "");
        const existingArticle = await prisma.news.findFirst({
          where: {
            title: article.title,
            date: article.date,
          },
        });
  
        if (!existingArticle) {
          await prisma.news.create({
            data: {
              category: article.category,
              title: article.title,
              date: article.date,
              author: article.author,
              pTags: article.pTags,
              imgLinks: imgLinksString,
              contentEn: article.contentEn,
              ref: article.ref,
              titleTh: article.titleTh,
              contentTh: article.contentTh,
            },
          });
        } else {
          console.log(`Skipping duplicate record: ${article.title} - ${article.date}`);
        }
      }
  
      console.log("Data import successful");
    } catch (error) {
      console.error("Error importing data:", error);
    } finally {
      await prisma.$disconnect();
    }
  };

  export const disconnectDatabase = async () => {
    await prisma.$disconnect();
  };