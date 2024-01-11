import cron from "node-cron";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import puppeteer from "puppeteer";
import path from "path";
import dotenv from "dotenv";
import fs from "fs/promises";
import sharp from "sharp"

dotenv.config();

const removeElements = async (page, selectors) => {
  for (const selector of selectors) {
    await page.evaluate((sel) => {
      const elements = document.querySelectorAll(sel);
      elements.forEach((element) => element.remove());
    }, selector);
  }
};

const scrapeLinks = async (url) => {
  const unwantedUrl = 'https://thn.news'
  const browser = await puppeteer.launch({
    headless: 'new',
  });
  const page = await browser.newPage();
  await page.goto(url);

  // Scroll down 3 times, waiting for some time between scrolls
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    // await page.waitForTimeout(1000);
  }

  let hasNextPage = true;
  let allLinks = [];

  while (hasNextPage) {
    const links = await page.$$eval(".story-link", (anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href"))
    );

    // Filter out unwanted links
    const filteredLinks = links.filter(link => !link.includes(unwantedUrl));

    allLinks = allLinks.concat(filteredLinks);
    console.log("🚀 ~ file: hackerNewFetchAlltime.js:35 ~ scrapeLinks ~ allLinks:", allLinks);

    // Scroll down 3 times, waiting for some time between scrolls
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      // await page.waitForTimeout(1000);
    }

    const nextPageButton = await page.$("#Blog1_blog-pager-older-link");

    if (nextPageButton) {
      await page.waitForSelector("#Blog1_blog-pager-older-link");
      await Promise.all([
        page.click("#Blog1_blog-pager-older-link"),
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      ]);
    } else {
      hasNextPage = false;
    }
  }

  await browser.close();
  return allLinks;
};

const downloadImage = async (imageUrl, folderPath) => {
  try {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const webpBuffer = await sharp(response.data).webp().toBuffer();
    const fileNameWithoutExtension = generateUniqueId();
    const webpFilePath = path.join(folderPath, `${fileNameWithoutExtension}.webp`);
    await fs.writeFile(webpFilePath, webpBuffer);
    console.log(`Downloaded image: ${fileNameWithoutExtension}.webp`);
    return `${fileNameWithoutExtension}.webp`;
  } catch (error) {
    console.error(`Failed to download image from ${imageUrl}: ${error.message}`);
    return null;
  }
};

const scrapeArticleContent = async (link) => {
  const browser = await puppeteer.launch({
    headless: 'new',
  });

  try {
    const page = await browser.newPage();
    await page.goto(link);

    await page.waitForSelector(".story-title");
    await page.waitForSelector(".articlebody.clear.cf");


    const title = await page.evaluate(() => {
      const titleElement = document.querySelector(".story-title");
      return titleElement ? titleElement.innerText : "";
    });

    const author = await page.evaluate(() => {
      const authorElements = document.querySelectorAll(".postmeta .author");
      return authorElements.length > 1 ? authorElements[1].innerText.trim() : "";
    });

    const pTags = await page.evaluate(() => {
      const pTagsElement = document.querySelector(".postmeta .p-tags");
      return pTagsElement ? pTagsElement.innerText.trim() : "";
    });

    const postmetaElement = await page.$(".postmeta");
    const dateElement = await postmetaElement.$(".author");
    const date = await dateElement.evaluate((node) => node.textContent.trim());

    const imgLinksInSeparator = await page.$$eval(
      ".separator a img",
      (imgs) =>
        imgs
          .filter((_, index) => index === 0)
          .map((img) => {
            const parentAnchor = img.closest("a");
            return parentAnchor ? img.getAttribute("src") : null;
          })
          .filter((src) => src)
    );

    const moduleDir = path.dirname(new URL(import.meta.url).pathname);
    const imageFolder = path.join("images");

    const downloadedImages = await Promise.allSettled(
      imgLinksInSeparator.map(async (imageUrl) => {
        try {
          const downloadedImageFilename = await downloadImage(imageUrl, imageFolder);
          if (downloadedImageFilename) {
            console.log(`Downloaded image: ${downloadedImageFilename}`);
            return downloadedImageFilename;
          } else {
            console.error(`Failed to download image from ${imageUrl}`);
            return null;
          }
        } catch (error) {
          console.error(`Failed to download image from ${imageUrl}: ${error.message}`);
          return null;
        }
      })
    );

    const successfulDownloads = downloadedImages
  .filter((result) => result.status === "fulfilled")
  .map((result) => {
    const fileName = path.basename(result.value);
    const parsed = path.parse(fileName);
    return parsed.name; // นี่คือชื่อไฟล์โดยไม่รวมนามสกุล
  });


    console.log("Downloaded Images:", successfulDownloads);

    const articleContent = await page.evaluate(() => {
      const contentElement = document.querySelector(".articlebody.clear.cf");

      if (!contentElement) return "";

      const elementsToRemove = [
        ...contentElement.querySelectorAll(".check_two.clear.babsi, .cf.note-b, .editor-rtfLink"),
      ];

      elementsToRemove.forEach((element) => element.remove());

      return contentElement.textContent;
    });

    await browser.close();

    return {
      title,
      date,
      author,
      pTags,
      imgLinksInSeparator: successfulDownloads,
      contentEn: articleContent,
    };
  } catch (error) {
    console.error("An error occurred:", error.message);
    await browser.close();
    return {
      title: "",
      date: "",
      author: "",
      pTags: "",
      imgLinksInSeparator: [],
      contentEn: "",
    };
  }
};

const saveAllLinks = async () => {
  // const homepageLinks = await scrapeLinks("https://thehackernews.com/");
  const dataBreachLinks = await scrapeLinks("https://thehackernews.com/search/label/data%20breach");
  const cyberAttackLinks = await scrapeLinks("https://thehackernews.com/search/label/Cyber%20Attack");
  const vulnerabilityLinks = await scrapeLinks("https://thehackernews.com/search/label/Vulnerability");

  const allLinks = {
    // Home: homepageLinks,
    "Data Breach": dataBreachLinks,
    "Cyber Attack": cyberAttackLinks,
    Vulnerability: vulnerabilityLinks,
  };

  await  fs.writeFile("src/schedules/all_links.json", JSON.stringify(allLinks, null, 2));
  console.log("All links saved to all_links.json");
};

const generateUniqueId = () => "_" + Math.random().toString(36).substr(2, 9);

const scrapeAndSaveArticles = async () => {
  const allLinks = JSON.parse(await fs.readFile("src/schedules/all_links.json", "utf8"));
  console.log("🚀 ~ scrapeAndSaveArticles ~ allLinks:", allLinks);
  let index = 1;

  try {
    const articles = [];

    for (const category in allLinks) {
      const categoryLinks = allLinks[category];

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
        console.log(`Article ${index} saved to articles array`);
        index++;
      }
    }

    await fs.writeFile("src/schedules/article_data.json", JSON.stringify(articles, null, 2));
    console.log("All articles saved to article_data.json");
  } catch (error) {
    console.error("An error occurred:", error.message);
  }
};

const translateText = async (text, targetLanguage = "th") => {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  const translateApiUrl = "https://translation.googleapis.com/language/translate/v2";

  const textChunks = splitTextIntoChunks(text, 5000);

  try {
    const translations = await Promise.all(
      textChunks.map(async (chunk) => {
        const params = {
          key: apiKey,
          q: chunk,
          target: targetLanguage,
        };

        const response = await axios.post(translateApiUrl, null, { params });
        return response.data.data.translations[0].translatedText;
      })
    );

    const translatedText = translations.join(" ");
    console.log("🚀 ~ translateText ~ translatedText:", translatedText)
    return translatedText;
  } catch (error) {
    console.error("Translation error:", error.message);
    throw error;
  }
};


const splitTextIntoChunks = (text, chunkSize) => {
  const regex = new RegExp(`.{1,${chunkSize}}`, "g");
  return text.match(regex) || [];
};

const translateThai = async () => {
  const rawData = await fs.readFile("src/schedules/article_data.json", "utf8");
  const articles = JSON.parse(rawData);
  console.log("🚀 ~ translateThai ~ articles:", articles)
  const translatedArticles = [];

  for (const article of articles) {
    const titleEn = article.title;
    const contentEn = article.contentEn;

    const titleTh = await translateText(titleEn);
    const contentTh = await translateText(contentEn);

    article.titleTh = titleTh;
    article.contentTh = contentTh;

    translatedArticles.push(article);
  }

  await fs.writeFile("src/schedules/article_data.json", JSON.stringify(translatedArticles, null, 2), "utf8");
  console.log("Translation completed. Translated data saved to article_data.json");
};


const JsonPushToDB = async () => {
  const prisma = new PrismaClient();

  try {
    const rawData = await fs.readFile("src/schedules/article_data.json", "utf-8");
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

let isTaskRunning = false;

const startTask = async () => {
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