import puppeteer from "puppeteer";
import fs  from "fs";
import axios  from "axios";
import Bard from "bard-ai";
import dotenv from 'dotenv';
dotenv.config();

import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 0;

process.setMaxListeners(30); // Increase the limit

async function scrapeLinks(url) {
  const browser = await puppeteer.launch({
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.goto(url);

  let hasNextPage = true;
  let allLinks = [];

  while (hasNextPage) {
    const links = await page.$$eval('.story-link', anchors => anchors.map(anchor => anchor.getAttribute('href')));
    allLinks = allLinks.concat(links);

    const nextPageButton = await page.$('#Blog1_blog-pager-older-link');
    if (nextPageButton) {
      await page.waitForSelector('#Blog1_blog-pager-older-link');
      await Promise.all([
        page.click('#Blog1_blog-pager-older-link'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      ]);
    } else {
      hasNextPage = false;
    }
  }

  await browser.close();
  return allLinks;
}

async function scrapeArticleContent(link) {
  const browser = await puppeteer.launch({
    headless: 'new',  // Set to true for headless mode
  });

  try {
    const page = await browser.newPage();
    await page.waitForTimeout(3000); // รอ 1 วินาที
    await page.goto(link);

    await page.waitForSelector('.story-title');
    await page.waitForSelector('.articlebody.clear.cf');

    const title = await page.$eval('.story-title', title => title.innerText);

    const postmetaElement = await page.$('.postmeta');
    const dateElement = await postmetaElement.$('.author');
    const date = await dateElement.evaluate(node => node.textContent.trim());

    const authorElement = await postmetaElement.$$('.author').then(nodes => nodes[1]);
    const author = await authorElement.evaluate(node => node.textContent.trim());

    let pTags = '';

    try {
      const pTagsElement = await postmetaElement.$('.p-tags');

      if (pTagsElement) {
        pTags = await pTagsElement.evaluate(node => node.textContent.trim());
      } else {
        console.error('p-tags element not found.');
      }
    } catch (error) {
      console.error('An error occurred:', error.message);
      pTags = ''; // Set pTags to an empty string or any default value
    }

    const imgLinksInSeparator = await page.$$eval('.separator a img', imgs => {
      return imgs.map(img => {
        const parentAnchor = img.closest('a');
        if (parentAnchor) {
          return img.getAttribute('src');
        }
      }).filter(src => src);
    });

    const articleContent = await page.evaluate(() => {
      const contentElement = document.querySelector('.articlebody.clear.cf');
      const paragraphs = contentElement.querySelectorAll('p');

      const checkTwoElements = contentElement.querySelectorAll('.check_two.clear.babsi');
      checkTwoElements.forEach(element => element.remove());

      const CfElements = contentElement.querySelectorAll('.cf.note-b');
      CfElements.forEach(element => element.remove());

      const editorElements = contentElement.querySelectorAll('.editor-rtfLink');
      editorElements.forEach(element => element.remove());

      const content = Array.from(paragraphs).map(p => p.innerText).join('\n');

      return content;
    });

    console.log("title =>", title)
    console.log('Date:', date);
    console.log('Author:', author);
    console.log('P-Tags:', pTags);
    console.log("Image Links in Separator:", imgLinksInSeparator);
    console.log("articleContent =>", articleContent);
    await page.waitForTimeout(2000); // รอ 1 วินาที
    await browser.close();
    return {
      title: title,
      date,
      author,
      pTags,
      imgLinksInSeparator: imgLinksInSeparator,
      contentEn: articleContent
    };
  } catch (error) {
    console.error('An error occurred:', error.message);
    await browser.close();
    // Return default values or an empty object in case of an error
    return {
      title: '',
      date: '',
      author: '',
      pTags: '',
      imgLinksInSeparator: [],
      contentEn: ''
    };
  }
}



async function saveAllLinks() {
  const homepageLinks = await scrapeLinks('https://thehackernews.com/');
  const dataBreachLinks = await scrapeLinks('https://thehackernews.com/search/label/data%20breach');
  const cyberAttackLinks = await scrapeLinks('https://thehackernews.com/search/label/Cyber%20Attack');
  const vulnerabilityLinks = await scrapeLinks('https://thehackernews.com/search/label/Vulnerability');

  const allLinks = {
    'Home': homepageLinks,
    'Data Breach': dataBreachLinks,
    'Cyber Attack': cyberAttackLinks,
    'Vulnerability': vulnerabilityLinks
  };

  fs.writeFileSync('all_links.json', JSON.stringify(allLinks, null, 2));
  console.log('All links saved to all_links.json');
}

async function saveArticleData() {
  const allLinks = JSON.parse(fs.readFileSync('all_links.json', 'utf8'));
  const articleData = {};
  let index = 1;

  try {
    for (const category in allLinks) {
      const categoryLinks = allLinks[category];

      // Create an array to store promises for each article
      const articlePromiseArray = [];

      for (const link of categoryLinks) {
        // Process the promise as soon as it resolves
        const articlePromise = scrapeArticleContent(link).then((articleContent) => {
          articleData[index] = {
            category,
            title: articleContent.title,
            date: articleContent.date,
            author: articleContent.author,
            pTags: articleContent.pTags,
            contentEn: articleContent.contentEn,
            ref: link,
          };
          index++;
        });

        articlePromiseArray.push(articlePromise);
      }

      // Wait for all promises in the current category to resolve before moving to the next category
      await Promise.all(articlePromiseArray);
    }

    fs.writeFileSync('article_data.json', JSON.stringify(articleData, null, 2));
    console.log('Article data saved to article_data.json');
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
}





async function scrapeAndSaveAll() {
  // await saveAllLinks();
  await saveArticleData();
}

scrapeAndSaveAll();
