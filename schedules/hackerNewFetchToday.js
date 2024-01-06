import cron from "node-cron";
import puppeteer from "puppeteer";
import path from "path";
import axios from "axios";
import fs from "fs/promises"; // Assuming you are using Node.js version 14.0.0 or later

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


    // Scroll ไปจนถึงสุดของหน้า
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0;
      const distance = 100;
      const maxScrollAttempts = 100;

      const scrollInterval = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight || maxScrollAttempts <= 0) {
          clearInterval(scrollInterval);
          resolve();
        }

        maxScrollAttempts--;
      }, 100);
    });
  });

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
          const downloadedImagePath = await downloadImage(
            imageUrl,
            imageFolder
          );
          if (downloadedImagePath) {
            console.log(`Downloaded image: ${downloadedImagePath}`);
            return downloadedImagePath;
          } else {
            console.error(`Failed to download image from ${imageUrl}`);
            return null;
          }
        } catch (error) {
          console.error(
            `Failed to download image from ${imageUrl}: ${error.message}`
          );
          return null;
        }
      })
    );

    const successfulDownloads = downloadedImages
      .filter((result) => result.status === "fulfilled")
      .map((result) => {
        const imagePath = result.value;
        const imageName = path.basename(imagePath);
        console.log(`Downloaded image: ${imageName}`);
        return imageName;
      });

    console.log("Downloaded Images:", successfulDownloads);

    const articleContent = await page.evaluate(() => {
      const contentElement = document.querySelector(".articlebody.clear.cf");

      if (!contentElement) return "";

      const checkTwoElements = contentElement.querySelectorAll(
        ".check_two.clear.babsi"
      );
      checkTwoElements.forEach((element) => element.remove());

      const CfElements = contentElement.querySelectorAll(".cf.note-b");
      CfElements.forEach((element) => element.remove());

      const editorElements = contentElement.querySelectorAll(".editor-rtfLink");
      editorElements.forEach((element) => element.remove());

      return contentElement.textContent;
    });

    const articleData = {
      id: generateUniqueId(),
      category: "Home",
      title,
      date,
      author,
      pTags,
      imgLinks: successfulDownloads,
      contentEn: articleContent,
      ref: link,
    };

    console.log("Scraped Article Data:", articleData);

    // Translate text
    const translatedTitle = await translateText(title);
    const translatedContent = await translateText(articleContent);

    const translatedArticleData = {
      ...articleData,
      titleTh: translatedTitle,
      contentTh: translatedContent,
    };

    console.log("Translated Article Data:", translatedArticleData);

    // Add the translated scraped data to the array
    scrapedData.push(translatedArticleData);
    // await page.close();
  } catch (error) {
    console.error("An error occurred while scraping article data:", error);
  }
};

const saveAllToJson = async (allData) => {
  const jsonFilePath = path.join("schedules", "scrapedData.json");

  try {
    // Check if the file exists
    await fs.access(jsonFilePath);

    // File exists, read existing JSON data
    const existingData = await fs.readFile(jsonFilePath, "utf-8");
    const jsonData = JSON.parse(existingData);

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
    // File does not exist, create a new JSON file
    const jsonData = allData;

    // Write the array to the file
    await fs.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2));
    console.log(`Scraped data has been saved to ${jsonFilePath}`);
  }
};

const downloadImage = async (imageUrl, folderPath) => {
  const imagePath = path.join(folderPath, path.basename(imageUrl));

  try {
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    await fs.writeFile(imagePath, Buffer.from(response.data));

    console.log(`Downloaded image: ${imagePath}`);
    return imagePath;
  } catch (error) {
    console.error(
      `Failed to download image from ${imageUrl}: ${error.message}`
    );
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


const scrapedData = [];

export const hackerNewFetchToday = async () => {
  cron.schedule("*/1 * * * *", async () => {
    try {
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
            const jsonFilePath = path.join("schedules", "scrapedData.json");
            // อ่านข้อมูลจากไฟล์ JSON
            const jsonData = fs.readFileSync(jsonFilePath, "utf-8");

            // แปลงข้อมูล JSON เป็น Object
            const scrapedData = JSON.parse(jsonData);

            // เพิ่มข้อมูลลงใน MySQL ด้วย Prisma
            for (const articleData of scrapedData) {
              // ตรวจสอบว่าข้อมูลซ้ำหรือไม่
              const existingArticle = await prisma.news.findFirst({
                where: {
                  title: articleData.title,
                  date: articleData.date,
                },
              });

              if (!existingArticle) {
                // ถ้าไม่ซ้ำ, เพิ่มข้อมูลลงใน MySQL
                await prisma.news.create({
                  data: {
                    category: articleData.category,
                    title: articleData.title,
                    date: articleData.date,
                    author: articleData.author,
                    pTags: articleData.pTags,
                    imgLinks: articleData.imgLinks,
                    contentEn: articleData.contentEn,
                    ref: articleData.ref,
                    titleTh: articleData.titleTh,
                    contentTh: articleData.contentTh,
                    // ตรวจสอบว่าข้อมูล editorUsername มีค่าหรือไม่ ถ้ามีให้เพิ่ม editor ลงในข้อมูล
                    ...(articleData.editorUsername && {
                      editor: {
                        connect: { username: articleData.editorUsername },
                      },
                    }),
                  },
                });

                console.log(
                  `ข้อมูล "${articleData.title}" ได้ถูกเพิ่มลงใน MySQL แล้ว`
                );
              } else {
                console.log(
                  `ข้อมูล "${articleData.title}" มีอยู่ใน MySQL แล้ว ไม่ได้ทำการเพิ่ม`
                );
              }
            }
          } catch (error) {
            console.error("เกิดข้อผิดพลาดในการอ่านไฟล์ JSON:", error);
          } finally {
            // ปิดการเชื่อมต่อ Prisma Client เมื่อเสร็จสิ้น
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
