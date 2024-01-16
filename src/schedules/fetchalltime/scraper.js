import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { downloadImage } from "./downloader.js";
import cheerio from "cheerio";
import axios from "axios";
export const unwantedUrl = 'https://thn.news';
export const imagePath = 'images';
export const allLinksPath = 'src/schedules/fetchalltime/all_links.json';
export const articleDataPath = 'src/schedules/fetchalltime/article_data.json';


export const saveAllLinks = async () => {
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
  
    await  fs.writeFile(allLinksPath, JSON.stringify(allLinks, null, 2));
    console.log("All links saved to all_links.json");
  };

export  const scrapeLinks = async (url) => {
    const unwantedUrl = 'https://thn.news'
    const browser = await puppeteer.launch({
      headless: "new",
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

  export const scrapeArticleContent = async (link) => {
    try {
        const response = await axios.get(link);
        const $ = cheerio.load(response.data);

        const title = $(".story-title a").text().trim();
        const author = $(".postmeta .author").eq(1).text().trim();
        const pTags = $(".postmeta .p-tags").text().trim();
        const date = $("meta[itemprop='datePublished']").attr("content").trim();
        const imgLinksInSeparator = [];
        // console.log("🚀 ~ scrapeArticleContent ~ imgLinksInSeparator:", imgLinksInSeparator)
        const firstImgLink = $(".separator a img[data-src]").attr("data-src");

        // Check if the firstImgLink exists before pushing it to the array
        if (firstImgLink) {
            imgLinksInSeparator.push(firstImgLink);
        }

        const successfulDownloads = await Promise.allSettled(
            imgLinksInSeparator.map(async (imageUrl) => {
                try {
                    const downloadedImageFilename = await downloadImage(imageUrl, "images");
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

        const successfulFileNamesWithoutExtension = successfulDownloads
            .filter((result) => result.status === "fulfilled" && result.value)
            .map((result) => {
                const fileName = path.basename(result.value);
                const parsed = path.parse(fileName);
                return parsed.name; // This is the file name without the extension
            });
            // ให้ลบ elements ที่มี class เป็น "cf note-b"
        $('.cf.note-b').remove();
        $('gg-2.cf').remove();
        $('logo-area.cf').remove();
        $('top-bar-box.cf').remove();
        $('v-container').remove();
        $('below-post-box.cf').remove();
        $('footer.cf').remove();

        // Extracting article content from specific div and p tags
      //   const articleContent = $(".articlebody.clear.cf p").map((index, p) => {
      //     return $.html(p).trim();
      // }).get().join('\n');
      // Remove class "cf note-b" and extract text content within .articlebody.clear.cf
      let articleContent = '';
      $(".articlebody.clear.cf").removeClass("cf.note-b").each((index, element) => {
          articleContent +=  $(element).text().trim() + '\n';
      });


        console.log("🚀 ~ articleContent ~ articleContent:", articleContent)

        return {
            title,
            date,
            author,
            pTags,
            imgLinksInSeparator: successfulFileNamesWithoutExtension,
            contentEn: articleContent,
        };
    } catch (error) {
        console.error("An error occurred:", error.message);
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

  const generateUniqueId = () => "_" + Math.random().toString(36).substr(2, 9);


  export const scrapeAndSaveArticles = async () => {
    const allLinks = JSON.parse(await fs.readFile(allLinksPath, "utf8"));
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
  
      await fs.writeFile("src/schedules/fetchalltime/article_data.json", JSON.stringify(articles, null, 2));
      console.log("All articles saved to article_data.json");
    } catch (error) {
      console.error("An error occurred:", error.message);
    }
  };