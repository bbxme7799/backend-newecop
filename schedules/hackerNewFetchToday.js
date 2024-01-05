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

export const hackerNewFetchToday = async () => {
  // every 1 minute
  cron.schedule("*/1 * * * *", async () => {
    try {
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.waitForTimeout(1000);
      // Go to the website
      await page.goto("https://thehackernews.com/");

      await page.evaluate(() => {
        const calendarElements = document.querySelectorAll(
          ".icon-font.icon-calendar"
        );
        calendarElements.forEach((element) => {
          element.remove();
        });
      });

      await page.evaluate(() => {
        const calendarElements = document.querySelectorAll(".right-box");
        calendarElements.forEach((element) => {
          element.remove();
        });
      });

      // Get data from the element with class "h-datetime"
      const dateTimeElement = await page.$(".h-datetime");
      const dateTimeText = await (dateTimeElement
        ? dateTimeElement.evaluate((node) => node.innerText)
        : "");
      console.log(
        "🚀 ~ file: hackerNewFetchToday.js:28 ~ //cron.schedule ~ dateTimeText:",
        dateTimeText
      );

      // Compare dates
      const datesMatch = compareDates(dateTimeText);

      // ...

      if (datesMatch) {
        console.log(
          "🚀 ~ file: hackerNewFetchToday.js:64 ~ cron.schedule ~ datesMatch:",
          datesMatch
        );

        // Get data from all elements with class "story-link"
        const storyLinkElements = await page.$$(".story-link");
        const matchedLinks = [];

        if (storyLinkElements.length > 0) {
          for (const storyLinkElement of storyLinkElements) {
            // Extract the href attribute value
            const linkHref = await storyLinkElement.evaluate((node) =>
              node.getAttribute("href")
            );
            console.log(
              "🚀 ~ file: hackerNewFetchToday.js:74 ~ cron.schedule ~ linkHref:",
              linkHref
            );

            // Compare dates of the link
            const linkDateTimeElement = await storyLinkElement.$(".h-datetime");
            const linkDateTimeText = await (linkDateTimeElement
              ? linkDateTimeElement.evaluate((node) => node.innerText)
              : "");

            const linkDatesMatch = compareDates(linkDateTimeText);

            if (linkDatesMatch) {
              console.log("Dates of the link match. Adding link to the array.");
              // Add the matched link to the array
              matchedLinks.push(linkHref);
            } else {
              console.log(
                "Dates of the link do not match. Skipping this link."
              );
            }
          }

          // Perform further actions with the array of matched links
          console.log("Matched links:", matchedLinks);

          // Now you can loop through the matchedLinks array and scrape data from each link
          for (const matchedLink of matchedLinks) {
            // Open a new page for each link
            const page = await browser.newPage();
            await page.goto(matchedLink);

            await page.waitForSelector(".story-title");
            await page.waitForSelector(".articlebody.clear.cf");

            const title = await page.evaluate(() => {
              const titleElement = document.querySelector(".story-title");
              return titleElement ? titleElement.innerText : "";
            });

            const author = await page.evaluate(() => {
              const authorElements =
                document.querySelectorAll(".postmeta .author");
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
            const date = await dateElement.evaluate((node) =>
              node.textContent.trim()
            );

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
            async function downloadImage(imageUrl, folderPath) {
              const imagePath = path.join(folderPath, path.basename(imageUrl));
              try {
                const response = await axios.get(imageUrl, {
                  responseType: "arraybuffer",
                });
                await fs.writeFile(imagePath, Buffer.from(response.data));
                return imagePath;
              } catch (error) {
                console.error(
                  `Failed to download image from ${imageUrl}: ${error.message}`
                );
              }
            }

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
              const contentElement = document.querySelector(
                ".articlebody.clear.cf"
              );

              if (!contentElement) return "";

              const checkTwoElements = contentElement.querySelectorAll(
                ".check_two.clear.babsi"
              );
              checkTwoElements.forEach((element) => element.remove());

              const CfElements = contentElement.querySelectorAll(".cf.note-b");
              CfElements.forEach((element) => element.remove());

              const editorElements =
                contentElement.querySelectorAll(".editor-rtfLink");
              editorElements.forEach((element) => element.remove());

              return contentElement.textContent;
            });

            // Create an object with the scraped data
            const articleData = {
              id: scrapedData.length + 1,
              title,
              date,
              author,
              pTags,
              imgLinks: successfulDownloads,
              contentEn: articleContent,
              ref: matchedLink, // You can add the source link as a reference
            };
            console.log("🚀 ~ file: hackerNewFetchToday.js:270 ~ cron.schedule ~ articleData:", articleData)

            // Close the page when done
            await page.close();
          }


          console.log(`Scraped data has been saved to ${scrapedData.data}`);
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