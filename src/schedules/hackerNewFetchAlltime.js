import cron from "node-cron";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import puppeteer from "puppeteer";
import path from "path";
import dotenv from "dotenv";
import fs from "fs/promises";
import sharp from "sharp"
import { scrapeLinks, scrapeArticleContent } from "./fetchalltime/scraper.js";
import { downloadImage } from "./fetchalltime/downloader.js";
import { translateText, translateThai } from "./fetchalltime/translator.js";
import { JsonPushToDB, disconnectDatabase } from "./fetchalltime/database.js";

dotenv.config();

const removeElements = async (page, selectors) => {
  for (const selector of selectors) {
    await page.evaluate((sel) => {
      const elements = document.querySelectorAll(sel);
      elements.forEach((element) => element.remove());
    }, selector);
  }
};






const generateUniqueId = () => "_" + Math.random().toString(36).substr(2, 9);

const scrapeAndSaveArticles = async () => {
  const allLinks = JSON.parse(await fs.readFile("src/schedules/all_links.json", "utf8"));
  console.log("🚀 ~ scrapeAndSaveArticles ~ allLinks:", allLinks);
  let index = 1;

  try {
    const articles = [];

    for (const [category, categoryLinks] of Object.entries(allLinks)) {
      for (const link of categoryLinks) {
        const articleContent = await scrapeArticleContent(link);
        const data = {
          id: generateUniqueId(),
          category,
          title: articleContent.title,
          date: articleContent.date,
          author: articleContent.author,
          pTags: articleContent.pTags,
          imgLinks: articleContent.imgLinksInSeparator,
          contentEn: articleContent.contentEn,
          ref: link,
        };

        articles.push(data);
        console.dir(data, { depth: null, compact: false });
        console.log(`Article ${articles.length} saved to articles array`);
      }
    }

    await fs.writeFile("src/schedules/article_data.json", JSON.stringify(articles, null, 2));
    console.log("All articles saved to article_data.json");
  } catch (error) {
    console.error("An error occurred:", error.message);
  }
};



let isTaskRunning = false;

const startTask = async () => {
  if (!isTaskRunning) {
    isTaskRunning = true;
    try {
      //  await scrapeLinks();
      //await scrapeAndSaveArticles();
      // await translateThai();
      await JsonPushToDB();
    } catch (error) {
      console.error("An error occurred:", error.message);
    } finally {
      isTaskRunning = false;
    }
  } else {
    console.log("Task is already running. Skipping...");
  }
};

export const hackerNewFetchAlltime = async () => {
  // every 1 minute
  cron.schedule("*/1 * * * *", async () => {
    await startTask();
  });
};