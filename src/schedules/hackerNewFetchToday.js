import cron from "node-cron";
import puppeteer from "puppeteer";
import path from "path";
import axios from "axios";
import fs from "fs/promises"; // Assuming you are using Node.js version 14.0.0 or later
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();
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

const removeElements = async (page, selector) => {
  await page.evaluate((sel) => {
    const elements = document.querySelectorAll(sel);
    elements.forEach((element) => element.remove());
  }, selector);
};

// Add this utility function to generate a unique ID
const generateUniqueId = () => {
  return "_" + Math.random().toString(36).substr(2, 9);
};

const scrapeArticleData = async (browser, link) => {
  try {
    const page = await browser.newPage();
    await page.goto(link);


   // Scroll down 3 times, waiting for some time between scrolls
   for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });

    // Wait for a short time to allow content to load or for animations to complete
    await page.waitForTimeout(1000);
  }
  await removeElements(page, ".icon-font.icon-calendar");
  await removeElements(page, ".right-box");
  await removeElements(page, ".below-post-box.cf");
  await removeElements(page, ".footer-stuff.clear.cf");
  await removeElements(page, ".email-box");
  await removeElements(page, ".header.clear");

    await page.waitForSelector(".story-title");
    await page.waitForSelector(".articlebody.clear.cf");

    const title = await page.evaluate(() => {
      const titleElement = document.querySelector(".story-title");
      return titleElement ? titleElement.innerText : "";
    });

    const author = await page.evaluate(() => {
      const authorElements = document.querySelectorAll(".postmeta .author");
      return authorElements.length > 1
        ? authorElements[1].innerText.trim()
        : "";
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
      (imgs) => {
        return imgs
          .filter((_, index) => index === 0)
          .map((img) => {
            const parentAnchor = img.closest("a");
            if (parentAnchor) {
              return img.getAttribute("src");
            }
          })
          .filter((src) => src);
      }
    );

    const imageFolder = path.join("images"); // Change this path accordingly

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

    const mainBoxContent = await page.evaluate(() => {
      const mainBoxElement = document.querySelector('.main-box.clear');
  
      if (!mainBoxElement) return "";
  
      // Remove unnecessary elements
      const unnecessaryElements = mainBoxElement.querySelectorAll('.check_two.clear.babsi, .cf.note-b, .editor-rtfLink');
      unnecessaryElements.forEach((element) => element.remove());
  
      // Extract text content from all paragraphs excluding <a> tags
      const paragraphTexts = Array.from(mainBoxElement.querySelectorAll('p'), (p) => {
        // Remove <a> tags from the innerHTML
        const withoutATags = p.innerHTML.replace(/<a\b[^>]*>.*?<\/a>/g, '');
        return `<p>${withoutATags.trim()}</p>`;
      });
  
      // Concatenate paragraphs into a single string
      return paragraphTexts.join('');
    });
  

    const articleData = {
      id: generateUniqueId(),
      category: "Home",
      title,
      date,
      author,
      pTags,
      imgLinks: successfulDownloads,
      contentEn: mainBoxContent,
      ref: link,
    };

    console.log("Scraped Article Data:", articleData);

    // อ่านข้อมูลจากไฟล์ scrapedData.json
    const jsonFilePath = path.join("src/schedules", "scrapedData.json");
       // Check if the file exists
       await fs.access(jsonFilePath);

       // File exists, read existing JSON data
       const existingData = await fs.readFile(jsonFilePath, "utf-8");
       const jsonData = JSON.parse(existingData);
    // เช็คว่า articleData.title และ articleData.date มีอยู่ใน scrapedData หรือไม่
      const isTitleExist = jsonData.some(data => data.title === articleData.title);
      const isDateExist = jsonData.some(data => data.date === articleData.date);

      if (isTitleExist && isDateExist) {
        console.log("Data already exists. Translation not needed.");
      } else {
        // Translate text
        const translatedTitle = await translateText(articleData.title);
        const translatedContent = await translateText(articleData.contentEn);
      
        const translatedArticleData = {
          ...articleData,
          titleTh: translatedTitle,
          contentTh: translatedContent,
        };
        console.log("Translated Article Data:", translatedArticleData);


        // Add the translated scraped data to the array
        scrapedData.push(translatedArticleData);
      }

    
    // await page.close();
  } catch (error) {
    console.error("An error occurred while scraping article data:", error);
  }
};

const saveAllToJson = async (allData) => {
  const jsonFilePath = path.join("src/schedules", "scrapedData.json");

  try {
    // Check if the file exists
    await fs.access(jsonFilePath);

    // File exists, read existing JSON data
    const existingData = await fs.readFile(jsonFilePath, "utf-8");

    let jsonData;
    try {
      jsonData = JSON.parse(existingData);
    } catch (parseError) {
      console.error("Error parsing existing JSON data:", parseError.message);
      jsonData = [];
    }

    // Check for duplicate data
    const isDuplicate = jsonData.some((existingItem) =>
      allData.some(
        (newItem) =>
          newItem.title === existingItem.title &&
          newItem.date === existingItem.date
      )
    );

    if (!isDuplicate) {
      // No duplicates, append new data
      jsonData.push(...allData);

      // Write the updated array back to the file
      await fs.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2));
      console.log(`Scraped data has been saved to ${jsonFilePath}`);
    } else {
      console.log("Duplicate data found, not saving to the file.");
    }
  } catch (error) {
    // File does not exist or other file-related error
    const jsonData = allData;

    // Write the array to the file
    await fs.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2));
    console.log(`Scraped data has been saved to ${jsonFilePath}`);
  }
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
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    await page.goto(url);
    await page.waitForSelector('.blog-posts.clear');

    const titles = await page.evaluate(() => {
      const titleElements = document.querySelectorAll('.home-title');
      return Array.from(titleElements, (element) => element.textContent);
    });
    // console.log("🚀 ~ file: hackerNewFetchToday.js:492 ~ titles ~ titles:", titles)

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
  } finally {
    await browser.close();
  }
};

const scrapedData = [];

export const hackerNewFetchToday = async () => {
  cron.schedule("*/1 * * * *", async () => {
    try {
      checkAndUpdateCategory('https://thehackernews.com/search/label/Cyber%20Attack', 'CyberAttack');
      checkAndUpdateCategory('https://thehackernews.com/search/label/Vulnerability', 'Vulnerability');   
      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();
      await page.waitForTimeout(1000);
      await page.goto("https://thehackernews.com/");


      

      // Remove unwanted elements
      await removeElements(page, ".icon-font.icon-calendar");
      await removeElements(page, ".right-box");
      await removeElements(page, ".below-post-box.cf");
      await removeElements(page, ".footer-stuff.clear.cf");
      await removeElements(page, ".email-box");
      await removeElements(page, ".header.clear");

       // Scroll down 3 times, waiting for some time between scrolls
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
  
      // Wait for a short time to allow content to load or for animations to complete
      await page.waitForTimeout(1000);
    }

      const dateTimeElement = await page.$(".h-datetime");
      const dateTimeText = await (dateTimeElement
        ? dateTimeElement.evaluate((node) => node.innerText)
        : "");

      const datesMatch = compareDates(dateTimeText);

      if (datesMatch) {
        const storyLinkElements = await page.$$(".story-link");
        const matchedLinks = [];

        for (const storyLinkElement of storyLinkElements) {
          const linkHref = await storyLinkElement.evaluate((node) =>
            node.getAttribute("href")
          );
          // console.log("🚀 linkHref:", linkHref)
          const linkDateTimeElement = await storyLinkElement.$(".h-datetime");
          const linkDateTimeText = await (linkDateTimeElement
            ? linkDateTimeElement.evaluate((node) => node.innerText)
            : "");
          const linkDatesMatch = compareDates(linkDateTimeText);

          if (linkDatesMatch) {
            matchedLinks.push(linkHref);
            // console.log(
            //   "🚀 ~ file: hackerNewFetchToday.js:243 ~ cron.schedule ~ matchedLinks:",
            //   matchedLinks
            // );
          }
        }

        if (matchedLinks.length > 0) {
          for (const matchedLink of matchedLinks) {
            // console.log("🚀 matchedLink:", matchedLink)
            await scrapeArticleData(browser, matchedLink);
          }
          
          await saveAllToJson(scrapedData);
          try {
            const jsonFilePath = path.join("src/schedules", "scrapedData.json");
            const jsonData = await fs.readFile(jsonFilePath, "utf-8");
            const scrapedData = JSON.parse(jsonData);
          
            // สร้าง Promise array โดยให้แต่ละ Promise เป็นการทำงานในลูป
            const promises = scrapedData.map(async (articleData) => {
              const imgLinksString = articleData.imgLinks.join(', ').replace(/[\[\]]/g, '');
          
              const existingArticle = await prisma.news.findFirst({
                where: {
                  title: {
                    equals: articleData.title,
                  },
                  date: {
                    equals: articleData.date,
                  },
                },
              });
          
              if (!existingArticle) {
                await prisma.news.create({
                  data: {
                    category: articleData.category,
                    title: articleData.title,
                    date: articleData.date,
                    author: articleData.author,
                    pTags: articleData.pTags,
                    imgLinks: imgLinksString,
                    contentEn: articleData.contentEn,
                    ref: articleData.ref,
                    titleTh: articleData.titleTh,
                    contentTh: articleData.contentTh,
                    ...(articleData.editorUsername && {
                      editor: {
                        connect: { username: articleData.editorUsername },
                      },
                    }),
                  },
                });
          
                console.log(`ข้อมูล "${articleData.title}" ได้ถูกเพิ่มลงใน MySQL แล้ว`);
              } else {
                console.log(`ข้อมูล "${articleData.title}" มีอยู่ใน MySQL แล้ว`);
              }
            });
          
            // รอให้ทุก Promise เสร็จสิ้น
            await Promise.all(promises);
          } catch (error) {
            console.error("เกิดข้อผิดพลาดในการอ่านไฟล์ JSON:", error);
          } finally {
            await prisma.$disconnect();
          }
          
        } else {
          console.log("No elements with class 'story-link' found.");
        }
      } else {
        // Perform actions when dates do not match
        // ...
      }
      await browser.close();
    } catch (error) {
      console.error("An error occurred:", error);
    }
  });
};
