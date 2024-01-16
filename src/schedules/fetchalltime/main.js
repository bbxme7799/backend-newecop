// main.js
import cron from "node-cron";
import fs from "fs/promises";
import { saveAllLinks, scrapeArticleContent,scrapeAndSaveArticles } from "./scraper.js";
import { downloadImage } from "./downloader.js";
import { translateText, translateThai } from "./translator.js";
import { JsonPushToDB, disconnectDatabase } from "./database.js";

let isTaskRunning = false;

export const startTask = async () => {
  if (!isTaskRunning) {
    isTaskRunning = true;
    try {
      // await saveAllLinks();
      // await scrapeAndSaveArticles();
      // await translateThai();
      await JsonPushToDB();
    } catch (error) {
      console.error("An error occurred:", error.message);
    } finally {
      isTaskRunning = false;
      await disconnectDatabase(); // Disconnect from the database when the task is done
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
