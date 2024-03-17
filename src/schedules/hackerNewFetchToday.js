import cron from "node-cron";
import puppeteer from "puppeteer";
import path from "path";
import axios from "axios";
import fs from "fs/promises"; // Assuming you are using Node.js version 14.0.0 or later
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import cheerio from 'cheerio';

const prisma = new PrismaClient();
const SCROLL_CHUNK_SIZE = 5000;
const SCROLL_ITERATIONS = 3;
const compareDates = (dateTimeText) => {
  const dateTimeComponents = dateTimeText.match(/(\w{3}) (\d{2}), (\d{4})/);
  if (dateTimeComponents) {
    const monthMap = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };

    const month = monthMap[dateTimeComponents[1]];
    const day = parseInt(dateTimeComponents[2], 10);
    const year = parseInt(dateTimeComponents[3], 10);

    const dateTimeObject = new Date(year, month, day);
    console.log("Converted DateTime:", dateTimeObject);

    // Get current date in the same format
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Compare dates
    if (dateTimeObject.getTime() === currentDate.getTime()) {
      console.log("Dates match");
      return true;
    } else {
      console.log("Dates do not match");
      return false;
    }
  } else {
    console.error("Failed to parse date from dateTimeText");
    return false;
  }
};


// Add this utility function to generate a unique ID
const generateUniqueId = () => {
  return "_" + Math.random().toString(36).substr(2, 9);
};

const scrapeArticleData = async (link) => {
  try {
    const response = await axios.get(link);
    const $ = cheerio.load(response.data);

    const simulateScrolling = async ($) => {
      for (let i = 0; i < SCROLL_ITERATIONS; i++) {
        $('body').append(`<div style="height:${SCROLL_CHUNK_SIZE}px;"></div>`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };
    await simulateScrolling($);

    removeUnwantedElements($);

    const { title, author, pTags, date, imgLinksInSeparator } = extractArticleInfo($);

    const isTitleExist = await prisma.news.findFirst({ where: { title } });
    const isDateExist = await prisma.news.findFirst({ where: { date } });

    if (isTitleExist && isDateExist) {
      console.log("Data already exists. Translation not needed.");
    } else {
      const imageFolder = path.join("images");
      const successfulDownloads = await downloadImages(imgLinksInSeparator, imageFolder);

      console.log("Downloaded Images:", successfulDownloads);

      const mainBoxContent = extractMainBoxContent($);
      const articleData = createArticleData(title, date, author, pTags, successfulDownloads, mainBoxContent, link);

      console.log("Scraped Article Data:", articleData);

      if (!isTitleExist || !isDateExist) {
        const translatedArticleData = await translateArticleData(articleData);
        console.log("Translated Article Data:", translatedArticleData);

        await prisma.news.create({
          data: {
            category: translatedArticleData.category,
            title: translatedArticleData.title,
            date: translatedArticleData.date,
            author: translatedArticleData.author,
            pTags: translatedArticleData.pTags,
            imgLinks: translatedArticleData.imgLinks.join(', '),
            contentEn: translatedArticleData.contentEn,
            ref: translatedArticleData.ref,
            titleTh: translatedArticleData.titleTh,
            contentTh: translatedArticleData.contentTh,
            editorUsername: translatedArticleData.editorUsername,
          },
        });

        console.log(`Scraped and translated data has been saved to the database`);
      }
    }
  } catch (error) {
    console.error("An error occurred while scraping article data:", error);
  }
};


const removeUnwantedElements = ($) => {
  $(".icon-font.icon-calendar, .right-box, .below-post-box.cf, .footer-stuff.clear.cf, .email-box, .header.clear").remove();
};

const extractArticleInfo = ($) => {
  const title = $(".story-title").text().trim();
  const author = $(".postmeta .author").eq(1).text().trim();
  const pTags = $(".postmeta .p-tags").text().trim();
  const date = $("meta[itemprop='datePublished']").attr("content").trim();
  const imgLinksInSeparator = [];
  const firstImgLink = $(".separator a img[data-src]").attr("data-src");

  if (firstImgLink) {
    imgLinksInSeparator.push(firstImgLink);
  }

  return { title, author, pTags, date, imgLinksInSeparator };
};


const downloadImages = async (imgLinks, imageFolder) => {
  const downloadedImages = await Promise.all(
    imgLinks.map(async (imageUrl) => {
      try {
        const downloadedImageFilename = await downloadImage(imageUrl, imageFolder);
        if (downloadedImageFilename) {
          console.log(`Downloaded image: ${downloadedImageFilename}`);
          return path.basename(downloadedImageFilename, path.extname(downloadedImageFilename));
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

  return downloadedImages.filter((fileName) => fileName !== null);
};

const extractMainBoxContent = ($) => {
  const mainBoxElement = $(".main-box.clear");

  if (!mainBoxElement.length) return "";

  mainBoxElement.find('.check_two.clear.babsi, .cf.note-b, .editor-rtfLink').remove();

  const paragraphTexts = mainBoxElement.find('p').map((index, p) => {
    const withoutATags = $(p).html().replace(/<a\b[^>]*>.*?<\/a>/g, '');
    return `<p>${withoutATags.trim()}</p>`;
  }).get();

  return paragraphTexts.join('');
};

const createArticleData = (title, date, author, pTags, imgLinks, contentEn, ref) => {
  return {
    id: generateUniqueId(),
    category: "Home",
    title,
    date,
    author,
    pTags,
    imgLinks,
    contentEn,
    ref,
  };
};

const translateArticleData = async (articleData) => {
  const translatedTitle = await translateText(articleData.title);
  const translatedContent = await translateText(articleData.contentEn);

  return {
    ...articleData,
    titleTh: translatedTitle,
    contentTh: translatedContent,
  };
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



async function translateText(text, targetLanguage = "th") {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  const translateApiUrl =
    "https://translation.googleapis.com/language/translate/v2";

  const textChunks = splitTextIntoChunks(text, 5000);

  const translations = await Promise.all(
    textChunks.map(async (chunk) => {
      const params = {
        key: apiKey,
        q: chunk,
        target: targetLanguage,
      };

      try {
        const response = await axios.post(translateApiUrl, null, { params });
        return response.data.data.translations[0].translatedText;
      } catch (error) {
        console.error("Translation error:", error.message);
        throw error;
      }
    })
  );

  const translatedText = translations.join(" ");

  return translatedText;
}

function splitTextIntoChunks(text, chunkSize) {
  const regex = new RegExp(`.{1,${chunkSize}}`, "g");
  return text.match(regex) || [];
}



const updateCategoryByTitle = async (title, newCategory) => {
  try {
    const existingArticle = await prisma.news.findFirst({
      where: { title },
    });

    if (existingArticle) {
      if (existingArticle.category !== newCategory) {
        await prisma.news.update({
          where: { id: existingArticle.id }, // Include the id field
          data: { category: newCategory },
        });

        // console.log(`Category updated for article "${title}"`);
      } else {
        console.log(`Category is already "${newCategory}" for article "${title}"`);
      }
    } else {
      console.log(`Article "${title}" not found`);
    }
  } catch (error) {
    console.error(`Error updating category for article "${title}":`, error);
  }
};



const checkAndUpdateCategory = async (url, expectedCategory) => {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const titles = $('.home-title').map((index, element) => $(element).text()).get();

    for (const title of titles) {
      const existingArticle = await prisma.news.findFirst({
        where: { title },
      });

      if (existingArticle) {
        await updateCategoryByTitle(title, expectedCategory);
      }
    }
  } catch (error) {
    console.error(`Error checking and updating category for ${url}:`, error);
  }
};

const scrapedData = [];

export const hackerNewFetchToday = async () => {
    cron.schedule('0 */2 * * *', async () => {
    try {
      const response = await axios.get("https://thehackernews.com/");
      const $ = cheerio.load(response.data);

      checkAndUpdateCategory('https://thehackernews.com/search/label/Cyber%20Attack', 'CyberAttack');
      checkAndUpdateCategory('https://thehackernews.com/search/label/Vulnerability', 'Vulnerability');

      $(".icon-font.icon-calendar, .right-box, .below-post-box.cf, .footer-stuff.clear.cf, .email-box, .header.clear").remove();


      const simulateScrolling = async ($) => {
        for (let i = 0; i < SCROLL_ITERATIONS; i++) {
          $('body').append(`<div style="height:${SCROLL_CHUNK_SIZE}px;"></div>`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      };

      simulateScrolling($);

      const dateTimeText = $(".h-datetime").text().trim();
      const datesMatch = compareDates(dateTimeText);

      if (datesMatch) {
        const matchedLinks = [];

        $(".story-link").each((index, storyLinkElement) => {
          const linkHref = $(storyLinkElement).attr("href");
          const linkDateTimeText = $(storyLinkElement).find(".h-datetime").text().trim();
          const linkDatesMatch = compareDates(linkDateTimeText);

          if (linkDatesMatch) {
            matchedLinks.push(linkHref);
          }
        });

        if (matchedLinks.length > 0) {
          const scrapedData = await Promise.all(matchedLinks.map(scrapeArticleData));
          const allData = scrapedData.filter(Boolean);

          if (allData.length > 0) {
            const existingData = await prisma.news.findMany();
            const uniqueData = allData.filter(newItem =>
              !existingData.some(existingItem =>
                newItem.title === existingItem.title && newItem.date === existingItem.date
              )
            );

            if (uniqueData.length > 0) {
              await prisma.news.createMany({
                data: uniqueData.map(articleData => ({
                  category: articleData.category,
                  title: articleData.title,
                  date: articleData.date,
                  author: articleData.author,
                  pTags: articleData.pTags,
                  imgLinks: articleData.imgLinks.join(', '),
                  contentEn: articleData.contentEn,
                  ref: articleData.ref,
                  titleTh: articleData.titleTh,
                  contentTh: articleData.contentTh,
                  editorUsername: articleData.editorUsername,
                })),
              });

              console.log(`Scraped data has been saved to the database`);
            } else {
              console.log("No unique data found, not saving to the database.");
            }
          } else {
            console.log("No valid data to scrape.");
          }
        } else {
          console.log("No elements with class 'story-link' found.");
        }
      } else {
        // Perform actions when dates do not match
        // ...
      }
    } catch (error) {
      console.error("An error occurred:", error);
    }
  });
};