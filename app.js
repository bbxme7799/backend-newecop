import puppeteer from "puppeteer";
import * as util from "util";
import axios from "axios";
// import Bard from "bard-ai";
import path from "path";
import dotenv from "dotenv";
import fs from "fs/promises";
dotenv.config();

async function scrapeLinks(url) {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();
  await page.goto(url);

  let hasNextPage = true;
  let allLinks = [];

  while (hasNextPage) {
    const links = await page.$$eval(".story-link", (anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href"))
    );
    allLinks = allLinks.concat(links);

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
}

async function downloadImage(imageUrl, folderPath) {
  const imagePath = path.join(folderPath, path.basename(imageUrl));
  try {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    await fs.writeFile(imagePath, Buffer.from(response.data));
    return imagePath;
  } catch (error) {
    console.error(
      `Failed to download image from ${imageUrl}: ${error.message}`
    );
  }
}

async function scrapeArticleContent(link) {
  const browser = await puppeteer.launch({
    headless: "new", // Set to true for headless mode
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

    const moduleDir = path.dirname(new URL(import.meta.url).pathname);
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

    // Filter out only fulfilled promises (successful downloads)
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

    await browser.close();

    return {
      title: title,
      date,
      author,
      pTags,
      imgLinksInSeparator: successfulDownloads,
      contentEn: articleContent,
    };
  } catch (error) {
    console.error("An error occurred:", error.message);
    await browser.close();
    // Return default values or an empty object in case of an error
    return {
      title: "",
      date: "",
      author: "",
      pTags: "",
      imgLinksInSeparator: [],
      contentEn: "",
    };
  }
}

async function saveAllLinks() {
  const homepageLinks = await scrapeLinks("https://thehackernews.com/");
  const dataBreachLinks = await scrapeLinks(
    "https://thehackernews.com/search/label/data%20breach"
  );
  const cyberAttackLinks = await scrapeLinks(
    "https://thehackernews.com/search/label/Cyber%20Attack"
  );
  const vulnerabilityLinks = await scrapeLinks(
    "https://thehackernews.com/search/label/Vulnerability"
  );

  const allLinks = {
    Home: homepageLinks,
    "Data Breach": dataBreachLinks,
    "Cyber Attack": cyberAttackLinks,
    Vulnerability: vulnerabilityLinks,
  };

  fs.writeFileSync("all_links.json", JSON.stringify(allLinks, null, 2));
  console.log("All links saved to all_links.json");
}

async function scrapeAndSaveArticles() {
  const allLinks = JSON.parse(await fs.readFile("all_links.json", "utf8"));
  let index = 1;

  try {
    await fs.writeFile("article_data.json", "["); // Start JSON array

    for (const category in allLinks) {
      const categoryLinks = allLinks[category];

      for (const link of categoryLinks) {
        const articleContent = await scrapeArticleContent(link);
        const data = {
          id: index,
          category,
          title: articleContent.title,
          date: articleContent.date,
          author: articleContent.author,
          pTags: articleContent.pTags,
          imgLinks: articleContent.imgLinksInSeparator,
          contentEn: articleContent.contentEn,
          ref: link,
        };

        const formattedData = JSON.stringify(data, null, 2);
        await fs.appendFile("article_data.json", `${formattedData},\n`);

        console.dir(data, { depth: null, compact: false });
        console.log(`Article ${index} saved to article_data.json`);
        index++;
      }
    }

    await fs.appendFile("article_data.json", "]"); // End JSON array
    console.log("All articles saved to article_data.json");
  } catch (error) {
    console.error("An error occurred:", error.message);
  }
}

async function translteThai() {

}

// Usage
async function scrapeAndSaveAll() {
  // await saveAllLinks();
  //await scrapeAndSaveArticles();
  await translteThai();
}

scrapeAndSaveAll();
